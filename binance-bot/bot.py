"""
bot.py - Główna pętla bota Binance

Kluczowe cechy:
- Równoległe przetwarzanie wszystkich symboli (asyncio.Semaphore)
- Persystencja pozycji w pliku JSON (przeżywają restart)
- Aktywne monitorowanie SL/TP co każdą iterację
- Equity = wolne USDT + wartość otwartych pozycji
"""

import asyncio
import json
import logging
import math
import os
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import settings, get_base_url
from binance_client import BinanceClient
from strategy import TradingStrategy, Signal
from risk_management import RiskManager

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

POSITIONS_FILE = settings.POSITIONS_FILE  # "positions.json"


class BotStatus:
    STOPPED    = "stopped"
    RUNNING    = "running"
    PAUSED     = "paused"
    ERROR      = "error"


class TradingBot:
    def __init__(self):
        self.client: Optional[BinanceClient] = None
        self.strategy    = TradingStrategy()
        self.risk_manager = RiskManager()

        self.status    = BotStatus.STOPPED
        self.bot_mode  = settings.BOT_MODE
        self.budget    = settings.BUDGET
        self.target    = settings.TARGET

        self._task: Optional[asyncio.Task] = None
        self._loop_interval      = settings.LOOP_INTERVAL
        self._min_confidence     = 0.05
        self._max_position_hours = 48
        self._concurrent         = settings.CONCURRENT_REQUESTS  # равнолегло запытаний

        # Stan
        self.usdt_balance   = settings.BUDGET
        self.open_positions: List[Dict] = []
        self.trade_history:  List[Dict] = []
        self.last_analysis:  Dict[str, Dict] = {}   # symbol -> dane analizy (stabilna mapa)
        self.error_message  = ""
        self.started_at: Optional[datetime] = None
        self.iteration_count = 0

        # Paper trading state
        self._demo_balance   = settings.BUDGET
        self._demo_positions: List[Dict] = []
        self._demo_history:   List[Dict] = []
        self._demo_id        = 1

        # Załaduj zapisane pozycje przy starcie
        self._load_positions()

    # ── Persystencja pozycji ─────────────────────────────────────────────────

    def _save_positions(self):
        """Zapisuje otwarte pozycje do pliku JSON — przeżywają restart."""
        try:
            # Zapisz pozycje odpowiednie dla aktualnego trybu
            positions_to_save = (
                self._demo_positions if self.is_paper else self.open_positions
            )
            data = {
                "positions":     positions_to_save,
                "demo_balance":  self._demo_balance,
                "trade_history": self.trade_history[-200:],
                "saved_at":      datetime.now().isoformat(),
                "bot_mode":      self.bot_mode,
                "count":         len(positions_to_save),
            }
            with open(POSITIONS_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"❌ Błąd zapisu pozycji: {e}")

    def _load_positions(self):
        """
        Wczytuje pozycje z pliku JSON po restarcie.
        Działa dla WSZYSTKICH trybów (demo, real, paper).
        """
        if not os.path.exists(POSITIONS_FILE):
            return
        try:
            with open(POSITIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            positions    = data.get("positions", [])
            demo_balance = data.get("demo_balance", settings.BUDGET)
            history      = data.get("trade_history", [])
            saved_at     = data.get("saved_at", "?")
            saved_mode   = data.get("bot_mode", "")

            if positions:
                # Wczytaj pozycje dla wszystkich trybów
                self._demo_positions = positions  # paper trading
                self.open_positions  = positions.copy()  # real/demo Binance
                self._demo_balance   = demo_balance
                self.trade_history   = history
                logger.info(
                    f"📂 Wczytano {len(positions)} pozycji z pliku | "
                    f"Tryb zapisu: {saved_mode} | Zapisano: {saved_at}"
                )
                # Pokaż co zostało wczytane
                for pos in positions:
                    logger.info(
                        f"   ↳ {pos.get('symbol')} | "
                        f"qty={pos.get('quantity')} | "
                        f"cena_otwarcia={pos.get('open_price', 0):.4f} | "
                        f"id={pos.get('id')}"
                    )
        except Exception as e:
            logger.error(f"❌ Błąd wczytywania pozycji: {e}")

    # ── Właściwości ──────────────────────────────────────────────────────────

    @property
    def is_paper(self) -> bool:
        return self.bot_mode == "paper"

    @property
    def is_demo(self) -> bool:
        return self.is_paper

    # ── Start / Stop ─────────────────────────────────────────────────────────

    async def start(
        self,
        api_key: str = None,
        api_secret: str = None,
        mode: str = None,
        budget: float = None,
        target: float = None,
    ) -> Dict:
        if self.is_running:
            return {"success": False, "message": "Bot już działa!"}

        if mode:
            self.bot_mode = mode
        if budget:
            self.budget = budget
            # Ustaw balance tylko jeśli nie mamy wczytanych pozycji
            # (żeby nie nadpisać faktycznego salda)
            if not self.open_positions:
                self._demo_balance = budget
                self.usdt_balance  = budget
        if target:
            self.target = target

        logger.info(
            f"🚀 Start bota | Tryb: {self.bot_mode} | "
            f"Budżet: {self.budget} USDT | Cel: {self.target} USDT | "
            f"Symboli: {len(settings.SYMBOLS)}"
        )

        if not self.is_paper:
            self.client = BinanceClient(
                api_key=api_key or settings.BINANCE_API_KEY,
                api_secret=api_secret or settings.BINANCE_API_SECRET,
            )
            ok = await self.client.ping()
            if not ok:
                return {"success": False, "message": f"Brak połączenia ({self.client.base_url})"}
            if self.client.api_key:
                valid = await self.client.test_connectivity()
                if not valid:
                    return {"success": False, "message": "Nieprawidłowe klucze API"}
        else:
            logger.info("📄 Tryb PAPER — lokalna symulacja")
            self.client = None

        self.status          = BotStatus.RUNNING
        self.started_at      = datetime.now()
        self.error_message   = ""
        self.iteration_count = 0
        # Zresetuj dzienny licznik — nowy start = nowy dzień bazowy
        self.risk_manager._daily_start_balance = None
        self.risk_manager._today = __import__('datetime').date.today()

        self._task = asyncio.create_task(self._trading_loop())
        return {"success": True, "message": f"Bot uruchomiony ({self.bot_mode}) — {len(settings.SYMBOLS)} symboli"}

    async def stop(self) -> Dict:
        if not self.is_running:
            return {"success": False, "message": "Bot nie działa"}
        self.status = BotStatus.STOPPED
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self.client:
            await self.client.close()
        self._save_positions()
        n = len(self.open_positions) if not self.is_paper else len(self._demo_positions)
        logger.info(f"🛑 Bot zatrzymany — {n} pozycji zapisanych do {POSITIONS_FILE}")
        return {"success": True, "message": f"Bot zatrzymany | {n} pozycji zapisanych"}

    @property
    def is_running(self) -> bool:
        return self.status == BotStatus.RUNNING

    # ── Główna pętla ─────────────────────────────────────────────────────────

    async def _trading_loop(self):
        logger.info("♻️  Pętla tradingowa uruchomiona")
        while self.is_running:
            try:
                self.iteration_count += 1
                logger.info(
                    f"\n{'='*60}\n"
                    f"🔄 Iteracja #{self.iteration_count} | "
                    f"{datetime.now().strftime('%H:%M:%S')} | "
                    f"Symboli: {len(settings.SYMBOLS)}\n"
                    f"{'='*60}"
                )

                await self._update_state()

                if not await self._check_stop_conditions():
                    break

                # Krok 1: sprawdź otwarte pozycje (SL/TP/timeout)
                await self._check_open_positions()

                # Krok 2: analizuj wszystkie symbole RÓWNOLEGLE
                await self._run_cycle_parallel()

                # Zapisz pozycje co iterację
                self._save_positions()

                logger.info(f"⏳ Przerwa {self._loop_interval}s...")
                await asyncio.sleep(self._loop_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Błąd pętli: {e}", exc_info=True)
                self.error_message = str(e)
                self.status = BotStatus.ERROR
                await asyncio.sleep(15)
                if self.status == BotStatus.ERROR:
                    self.status = BotStatus.RUNNING

        logger.info("🏁 Pętla zakończona")

    # ── Równoległe przetwarzanie ──────────────────────────────────────────────

    async def _run_cycle_parallel(self):
        """
        Analizuje WSZYSTKIE symbole równolegle.
        Semaphore ogranicza liczbę jednoczesnych zapytań do API
        żeby nie przekroczyć limitów Binance (1200 req/min).
        """
        semaphore = asyncio.Semaphore(self._concurrent)

        async def analyze_with_sem(symbol: str):
            async with semaphore:
                try:
                    await self._analyze_and_trade(symbol)
                except Exception as e:
                    logger.debug(f"⚠️ {symbol}: {e}")

        # Uruchom wszystkie naraz
        tasks   = [analyze_with_sem(s) for s in settings.SYMBOLS]
        t_start = datetime.now()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = (datetime.now() - t_start).total_seconds()

        # Policz sygnały
        buys  = sum(1 for a in self.last_analysis.values() if a.get("signal") == "BUY")
        sells = sum(1 for a in self.last_analysis.values() if a.get("signal") == "SELL")
        holds = sum(1 for a in self.last_analysis.values() if a.get("signal") == "HOLD")
        errors = sum(1 for r in results if isinstance(r, Exception))

        logger.info(
            f"⚡ Analiza {len(settings.SYMBOLS)} symboli w {elapsed:.1f}s | "
            f"BUY:{buys} SELL:{sells} HOLD:{holds} | "
            f"Przeanalizowano: {len(self.last_analysis)} | Błędy: {errors}"
        )

    # ── Stan konta ────────────────────────────────────────────────────────────

    async def _update_state(self):
        """
        Equity = wolne USDT + wartość otwartych pozycji.
        Jeden request do /account, ceny pozycji z last_analysis (cache).
        """
        if self.is_paper:
            positions_value = 0.0
            for pos in self._demo_positions:
                symbol     = pos.get("symbol", "")
                qty        = pos.get("quantity", 0)
                last_price = pos.get("current_price", pos.get("open_price", 0))
                if symbol in self.last_analysis:
                    last_price = self.last_analysis[symbol].get("price", last_price)
                pos["current_price"]  = last_price
                pos["current_value"]  = round(qty * last_price, 4)
                pos["unrealized_pnl"] = round((last_price - pos.get("open_price", last_price)) * qty, 4)
                positions_value      += pos["current_value"]
            self.usdt_balance   = self._demo_balance + positions_value
            self.open_positions = self._demo_positions.copy()
            self.risk_manager.update_daily_balance(self.usdt_balance)
            logger.info(
                f"💰 Equity: {self.usdt_balance:.2f} USDT "
                f"(wolne: {self._demo_balance:.2f} + pozycje: {positions_value:.2f}) "
                f"| Pozycji: {len(self._demo_positions)}"
            )
            return

        try:
            # Pobierz WSZYSTKIE salda z konta jednym requestem
            all_balances = await self.client.get_all_balances()

            # Wolne + zablokowane USDT (OCO zlecenia blokują USDT)
            usdt_data  = all_balances.get("USDT", {})
            free_usdt  = float(usdt_data.get("free", 0))
            locked_usdt = float(usdt_data.get("locked", 0))
            total_usdt  = free_usdt + locked_usdt

            # Wartość wszystkich krypto w portfelu (przeliczona na USDT)
            # Używamy cen z last_analysis (cache) — zero dodatkowych requestów
            crypto_value = 0.0
            for asset, bal in all_balances.items():
                if asset in ("USDT", "BNB"):  # pomiń USDT i BNB (fee token)
                    continue
                total_qty = float(bal.get("total", 0))
                if total_qty <= 0:
                    continue
                sym   = asset + "USDT"
                price = self.last_analysis.get(sym, {}).get("price", 0)
                if price > 0:
                    val = total_qty * price
                    crypto_value += val
                    # Zaktualizuj otwarte pozycje
                    for pos in self.open_positions:
                        if pos.get("symbol") == sym:
                            open_p = pos.get("open_price", price)
                            pos["current_price"]  = float(price)
                            pos["current_value"]  = float(round(total_qty * price, 4))
                            pos["unrealized_pnl"] = float(round((price - open_p) * total_qty, 4))

            # Equity = USDT (free+locked) + wartość krypto
            self.usdt_balance = total_usdt + crypto_value
            self.risk_manager.update_daily_balance(self.usdt_balance)
            logger.info(
                f"💰 Equity: {self.usdt_balance:.2f} USDT "
                f"(USDT: {free_usdt:.2f} free + {locked_usdt:.2f} locked | "
                f"Krypto: {crypto_value:.2f}) | Pozycji: {len(self.open_positions)}"
            )
        except Exception as e:
            logger.error(f"Błąd aktualizacji stanu: {e}")

    # ── Warunki zatrzymania ───────────────────────────────────────────────────

    async def _check_stop_conditions(self) -> bool:
        if self.bot_mode == "goal" and self.usdt_balance >= self.target:
            logger.info(f"🎯 CEL OSIĄGNIĘTY! {self.usdt_balance:.2f} >= {self.target:.2f} USDT")
            self.status = BotStatus.STOPPED
            return False
        if self.risk_manager.is_daily_loss_exceeded(self.usdt_balance):
            self.status = BotStatus.PAUSED
            return False
        return True

    # ── Monitoring SL/TP ─────────────────────────────────────────────────────

    async def _check_open_positions(self):
        """Sprawdza SL, TP i timeout dla każdej otwartej pozycji."""
        positions = list(self.open_positions)
        if not positions:
            return
        logger.info(f"🔍 Monitoring {len(positions)} pozycji (SL/TP/timeout)...")

        for pos in positions:
            symbol     = pos.get("symbol")
            open_price = pos.get("open_price", 0)
            sl_price   = pos.get("stop_loss", 0)
            tp_price   = pos.get("take_profit", 0)
            open_time  = pos.get("open_time")

            # Pobierz aktualną cenę
            if self.is_paper:
                current_price = pos.get("current_price", open_price)
                current_price *= (1 + random.gauss(0, 0.002))
                pos["current_price"]   = current_price
                pos["current_value"]   = round(pos.get("quantity", 0) * current_price, 4)
                pos["unrealized_pnl"]  = round(
                    (current_price - open_price) * pos.get("quantity", 0), 4
                )
            else:
                try:
                    current_price = await self.client.get_ticker_price(symbol)
                    pos["current_price"]  = current_price
                    pos["current_value"]  = round(pos.get("quantity", 0) * current_price, 4)
                    pos["unrealized_pnl"] = round(
                        (current_price - open_price) * pos.get("quantity", 0), 4
                    )
                except Exception as e:
                    logger.warning(f"⚠️ {symbol}: Nie można pobrać ceny: {e}")
                    continue

            pnl_pct = ((current_price - open_price) / open_price * 100) if open_price > 0 else 0

            # Stop-Loss
            if sl_price > 0 and current_price <= sl_price:
                logger.warning(
                    f"🛑 {symbol}: STOP-LOSS! {current_price:.4f} <= {sl_price:.4f} ({pnl_pct:+.2f}%)"
                )
                await self._close_position(pos, f"Stop-Loss @ {current_price:.4f} ({pnl_pct:+.2f}%)")
                continue

            # Take-Profit
            if tp_price > 0 and current_price >= tp_price:
                logger.info(
                    f"🎯 {symbol}: TAKE-PROFIT! {current_price:.4f} >= {tp_price:.4f} ({pnl_pct:+.2f}%)"
                )
                await self._close_position(pos, f"Take-Profit @ {current_price:.4f} ({pnl_pct:+.2f}%)")
                continue

            # Timeout
            if open_time:
                try:
                    open_dt = datetime.fromisoformat(open_time)
                    if open_dt.tzinfo is None:
                        open_dt = open_dt.replace(tzinfo=timezone.utc)
                    now       = datetime.now(timezone.utc)
                    hours     = (now - open_dt).total_seconds() / 3600
                    max_hours = self._max_position_hours
                    if hours >= max_hours:
                        logger.warning(
                            f"⏰ {symbol}: Timeout {hours:.1f}h >= {max_hours}h ({pnl_pct:+.2f}%)"
                        )
                        await self._close_position(
                            pos, f"Timeout {hours:.1f}h ({pnl_pct:+.2f}%)"
                        )
                except Exception:
                    pass

    # ── Analiza pojedynczego symbolu ──────────────────────────────────────────

    async def _analyze_and_trade(self, symbol: str):
        """Analizuje jeden symbol i ewentualnie kupuje/sprzedaje."""
        if self.is_paper:
            candles  = self._generate_demo_candles(symbol)
            price    = candles[-1]["close"] if candles else 1.0
            lot_size = {"min_qty": 0.00001, "max_qty": 9000.0, "step_size": 0.00001}
        else:
            # Pobierz świece i cenę — get_klines zwraca [] dla złych symboli
            candles = await self.client.get_klines(
                symbol, interval=settings.KLINE_INTERVAL, limit=300
            )
            if not candles:
                return  # zły symbol lub błąd API — pomiń cicho

            price = await self.client.get_ticker_price(symbol)
            if price <= 0:
                logger.debug(f"⚠️ {symbol}: cena = 0, pomijam")
                return

            symbol_info = await self._get_symbol_info_cached(symbol)
            lot_size    = self.client.get_lot_size(symbol_info)

        result = self.strategy.analyze(symbol, candles)
        if result is None:
            return

        # Zaktualizuj mapę analiz — wszystko jako Python native types dla JSON
        self.last_analysis[symbol] = {
            "symbol":     str(symbol),
            "signal":     str(result.signal.value),
            "rsi":        float(result.rsi),
            "sma_short":  float(result.sma_short),
            "sma_long":   float(result.sma_long),
            "price":      float(result.current_price),
            "reason":     str(result.reason),
            "confidence": float(result.confidence),
            "timestamp":  datetime.now().isoformat(),
        }

        existing = [p for p in self.open_positions if p.get("symbol") == symbol]

        # SELL
        if existing and result.signal == Signal.SELL:
            for pos in existing:
                await self._close_position(pos, f"SELL: {result.reason}")
            return

        # BUY
        if result.signal != Signal.BUY:
            return
        if result.confidence < self._min_confidence:
            return

        free_usdt = self._demo_balance if self.is_paper else self.usdt_balance
        can_open, reason = self.risk_manager.can_open_position(
            self.open_positions, free_usdt, symbol
        )
        if not can_open:
            return

        pos_size = self.risk_manager.calculate_position_size(free_usdt, price, lot_size)
        if pos_size:
            await self._open_position(symbol, pos_size, price, result.reason)

    # ── Otwieranie / zamykanie ────────────────────────────────────────────────

    async def _open_position(self, symbol, pos_size, price, reason):
        record = {
            "id":             None,
            "symbol":         symbol,
            "side":           "BUY",
            "quantity":       pos_size.quantity,
            "open_price":     price,
            "usdt_value":     pos_size.usdt_value,
            "current_price":  price,
            "current_value":  pos_size.usdt_value,
            "unrealized_pnl": 0.0,
            "stop_loss":      pos_size.stop_loss_price,
            "take_profit":    pos_size.take_profit_price,
            "open_time":      datetime.now(timezone.utc).isoformat(),
            "reason":         reason,
            "status":         "open",
        }

        if self.is_paper:
            self._demo_balance      -= pos_size.usdt_value
            record["id"]             = f"DEMO-{self._demo_id}"
            self._demo_id           += 1
            self._demo_positions.append(record)
            self.open_positions      = self._demo_positions.copy()
            logger.info(
                f"📄 [PAPER] BUY {symbol} | qty={pos_size.quantity} | "
                f"{pos_size.usdt_value:.2f} USDT | wolne po: {self._demo_balance:.2f}"
            )
        else:
            try:
                # Sprawdź aktualne saldo USDT tuż przed zleceniem
                current_free = await self.client.get_balance("USDT")
                if current_free < pos_size.usdt_value * 1.01:  # 1% bufor na fees
                    logger.warning(
                        f"⛔ {symbol}: Niewystarczające saldo "
                        f"({current_free:.2f} USDT < {pos_size.usdt_value:.2f} USDT) — pomijam"
                    )
                    return

                order = await self.client.place_market_order(
                    symbol=symbol, side="BUY", quantity=pos_size.quantity
                )
                record["id"]     = order.get("orderId")
                record["status"] = order.get("status", "NEW")
                try:
                    await self.client.place_oco_order(
                        symbol=symbol, side="SELL",
                        quantity=pos_size.quantity,
                        price=pos_size.take_profit_price,
                        stop_price=pos_size.stop_loss_price * 1.001,
                        stop_limit_price=pos_size.stop_loss_price,
                    )
                except Exception as e:
                    logger.warning(f"⚠️ OCO nie ustawione dla {symbol}: {e}")
                self.open_positions.append(record)
            except Exception as e:
                logger.error(f"❌ Błąd otwarcia {symbol}: {e}")
                return

        self.trade_history.append({**record, "type": "OPEN"})
        self._save_positions()

    async def _close_position(self, position, reason):
        symbol     = position.get("symbol")
        open_price = position.get("open_price", 1.0)
        qty        = position.get("quantity", 0)

        if self.is_paper:
            close_price = position.get("current_price", open_price)
            pnl         = (close_price - open_price) * qty
            self._demo_balance += position.get("current_value", position.get("usdt_value", 0))
            self._demo_positions = [
                p for p in self._demo_positions if p.get("id") != position.get("id")
            ]
            self.open_positions = self._demo_positions.copy()
            logger.info(f"📄 [PAPER] SELL {symbol} | P&L: {pnl:+.4f} USDT | {reason}")
        else:
            try:
                await self.client.cancel_all_orders(symbol)
                await self.client.place_market_order(
                    symbol=symbol, side="SELL", quantity=qty
                )
                self.open_positions = [
                    p for p in self.open_positions if p.get("id") != position.get("id")
                ]
                logger.info(f"📉 SELL {symbol} | {reason}")
            except Exception as e:
                logger.error(f"❌ Błąd zamknięcia {symbol}: {e}")
                return

        self.trade_history.append({
            **position,
            "type":        "CLOSE",
            "close_reason": reason,
            "close_time":  datetime.now().isoformat(),
        })
        self._save_positions()

    # ── Symbol info cache ─────────────────────────────────────────────────────

    _symbol_info_cache: Dict[str, dict] = {}

    async def _get_symbol_info_cached(self, symbol: str) -> dict:
        if symbol not in self._symbol_info_cache:
            try:
                info = await self.client.get_symbol_info(symbol)
                TradingBot._symbol_info_cache[symbol] = info
            except Exception:
                return {}
        return TradingBot._symbol_info_cache.get(symbol, {})

    # ── Paper trading helpers ─────────────────────────────────────────────────

    def _generate_demo_candles(self, symbol: str) -> List[Dict]:
        base_prices = {
            "BTCUSDT": 67000, "ETHUSDT": 3500, "BNBUSDT": 580,
            "SOLUSDT": 175,   "XRPUSDT": 0.52, "ADAUSDT": 0.45,
            "DOGEUSDT": 0.12, "LTCUSDT": 85,   "MATICUSDT": 0.72,
            "DOTUSDT": 7.5,
        }
        base  = base_prices.get(symbol, random.uniform(0.1, 100))
        price = base
        candles = []
        for i in range(260):
            change = random.gauss(0, 0.018)
            price *= (1 + change)
            candles.append({
                "timestamp": i * 3600000,
                "open":   price * (1 + random.gauss(0, 0.003)),
                "high":   price * (1 + abs(random.gauss(0, 0.005))),
                "low":    price * (1 - abs(random.gauss(0, 0.005))),
                "close":  price,
                "volume": random.uniform(1000, 50000),
            })
        return candles

    # ── Dashboard ─────────────────────────────────────────────────────────────

    def get_dashboard_data(self) -> Dict[str, Any]:
        free_usdt       = self._demo_balance if self.is_paper else self.usdt_balance
        positions_value = sum(
            p.get("current_value", p.get("usdt_value", 0))
            for p in self.open_positions
        )
        progress = 0.0
        if self.target != self.budget:
            progress = (self.usdt_balance - self.budget) / (self.target - self.budget) * 100
            progress = max(0.0, min(100.0, progress))

        ds = self.risk_manager.get_daily_stats(self.usdt_balance)

        return {
            "status":           self.status,
            "bot_mode":         self.bot_mode,
            "binance_mode":     settings.BINANCE_MODE,
            "balance":          round(self.usdt_balance, 2),
            "free_usdt":        round(free_usdt, 2),
            "positions_value":  round(positions_value, 2),
            "balance_currency": "USDT",
            "budget":           self.budget,
            "target":           self.target,
            "progress_pct":     round(progress, 1),
            "open_positions":   self.open_positions,
            "positions_count":  len(self.open_positions),
            "trade_history":    self.trade_history[-50:],
            # Analiza jako lista posortowana po sygnale (BUY first)
            "last_analysis":    sorted(
                self.last_analysis.values(),
                key=lambda x: (x["signal"] != "BUY", x["signal"] != "SELL", x["symbol"])
            ),
            "iteration_count":  self.iteration_count,
            "started_at":       self.started_at.isoformat() if self.started_at else None,
            "error_message":    self.error_message,
            "daily_stats":      ds,
            "config": {
                "symbols":              settings.SYMBOLS,
                "symbols_count":        len(settings.SYMBOLS),
                "kline_interval":       settings.KLINE_INTERVAL,
                "stop_loss_pct":        settings.STOP_LOSS_PCT,
                "take_profit_pct":      settings.TAKE_PROFIT_PCT,
                "max_daily_loss_pct":   settings.MAX_DAILY_LOSS_PCT,
                "max_open_positions":   settings.MAX_OPEN_POSITIONS,
                "capital_per_trade_pct":settings.CAPITAL_PER_TRADE_PCT,
                "loop_interval":        settings.LOOP_INTERVAL,
                "concurrent_requests":  self._concurrent,
                "rsi_oversold":         self.strategy.rsi_oversold,
                "rsi_overbought":       self.strategy.rsi_overbought,
                "min_confidence":       self._min_confidence,
                "max_position_hours":   self._max_position_hours,
            },
        }
