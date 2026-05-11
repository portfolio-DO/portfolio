"""
risk_management.py - Zarządzanie ryzykiem dla Binance Spot
"""

import logging
import math
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Tuple

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class PositionSize:
    quantity: float
    usdt_value: float
    stop_loss_price: float
    take_profit_price: float
    risk_usdt: float


class RiskManager:

    def __init__(self):
        self.stop_loss_pct        = settings.STOP_LOSS_PCT / 100
        self.take_profit_pct      = settings.TAKE_PROFIT_PCT / 100
        self.max_daily_loss_pct   = settings.MAX_DAILY_LOSS_PCT / 100
        self.max_open_positions   = settings.MAX_OPEN_POSITIONS
        self.capital_per_trade_pct = settings.CAPITAL_PER_TRADE_PCT / 100
        self._daily_start_balance: Optional[float] = None
        self._today = date.today()

    def update_daily_balance(self, balance: float):
        today = date.today()
        if today != self._today or self._daily_start_balance is None:
            self._today = today
            self._daily_start_balance = balance
            logger.info(f"📅 Nowy dzień. Bilans startowy: {balance:.2f} USDT")

    def is_daily_loss_exceeded(self, current_balance: float) -> bool:
        if self._daily_start_balance is None:
            return False
        loss_pct = (self._daily_start_balance - current_balance) / max(self._daily_start_balance, 1)
        exceeded = loss_pct >= self.max_daily_loss_pct
        if exceeded:
            logger.warning(f"🚨 Dzienny limit strat! Strata: {loss_pct:.1%} >= limit {self.max_daily_loss_pct:.1%}")
        return exceeded

    def can_open_position(
        self,
        open_positions: List[Dict],
        usdt_balance: float,
        symbol: str,
    ) -> Tuple[bool, str]:
        """
        Sprawdza wszystkie warunki i loguje DOKŁADNIE dlaczego blokuje.
        """
        # Sprawdź limit pozycji
        if len(open_positions) >= self.max_open_positions:
            reason = f"Limit {self.max_open_positions} pozycji osiągnięty (otwarte: {len(open_positions)})"
            logger.info(f"⛔ {symbol}: {reason}")
            return False, reason

        # Sprawdź czy symbol już w portfelu
        existing = [p for p in open_positions if p.get("symbol") == symbol]
        if existing:
            reason = f"Pozycja na {symbol} już istnieje"
            logger.info(f"⛔ {symbol}: {reason}")
            return False, reason

        # Sprawdź dzienny limit strat
        if self.is_daily_loss_exceeded(usdt_balance):
            reason = "Dzienny limit strat przekroczony — bot czeka do jutra"
            logger.warning(f"⛔ {symbol}: {reason}")
            return False, reason

        # Sprawdź czy jest wystarczający kapitał
        capital = usdt_balance * self.capital_per_trade_pct
        # Binance wymaga minimum 5 USDT na transakcję (MIN_NOTIONAL)
        min_trade_usdt = 5.0
        if capital < min_trade_usdt:
            reason = (
                f"Za mało kapitału: {capital:.2f} USDT "
                f"({self.capital_per_trade_pct:.0%} z {usdt_balance:.2f}) "
                f"< minimum {min_trade_usdt} USDT"
            )
            logger.warning(f"⛔ {symbol}: {reason}")
            return False, reason

        logger.info(f"✅ {symbol}: Można otworzyć pozycję ({capital:.2f} USDT)")
        return True, "OK"

    def calculate_position_size(
        self,
        usdt_balance: float,
        current_price: float,
        lot_size: Dict,
    ) -> Optional[PositionSize]:
        """
        Oblicza wielkość pozycji. Loguje każdy krok.
        """
        if current_price <= 0:
            logger.error("❌ Cena = 0, nie można obliczyć pozycji")
            return None

        usdt_to_spend = usdt_balance * self.capital_per_trade_pct
        logger.info(f"💵 Kapitał na transakcję: {usdt_to_spend:.2f} USDT "
                    f"({self.capital_per_trade_pct:.0%} z {usdt_balance:.2f})")

        step = lot_size.get("step_size", 0.00001)
        min_qty = lot_size.get("min_qty", 0.00001)
        max_qty = lot_size.get("max_qty", 9000.0)

        raw_qty = usdt_to_spend / current_price
        precision = max(0, int(round(-math.log10(step), 0))) if step < 1 else 0
        quantity = round(math.floor(raw_qty / step) * step, precision)
        quantity = max(min_qty, min(max_qty, quantity))

        actual_value = quantity * current_price

        # Binance MIN_NOTIONAL = 5 USDT
        if actual_value < 5.0:
            logger.warning(
                f"❌ Wartość pozycji {actual_value:.4f} USDT < 5 USDT minimum."
            )
            return None

        # Zabezpieczenie: wartość nie może przekraczać dostępnego USDT
        # (z 10% buforem na fees i wahania ceny)
        max_allowed = usdt_balance * 0.99
        if actual_value > max_allowed:
            # Zmniejsz quantity żeby zmieścić się w budżecie
            safe_usdt = usdt_balance * self.capital_per_trade_pct * 0.95
            raw_qty2  = safe_usdt / current_price
            quantity  = round(math.floor(raw_qty2 / step) * step, precision)
            quantity  = max(min_qty, min(max_qty, quantity))
            actual_value = quantity * current_price
            logger.warning(
                f"⚠️ Zmniejszono pozycję do {actual_value:.2f} USDT "
                f"(limit budżetu: {max_allowed:.2f} USDT)"
            )
            if actual_value < 5.0:
                return None

        stop_loss    = round(current_price * (1 - self.stop_loss_pct), 8)
        take_profit  = round(current_price * (1 + self.take_profit_pct), 8)
        risk_usdt    = quantity * current_price * self.stop_loss_pct

        logger.info(
            f"📐 Pozycja: qty={quantity} | "
            f"wartość={actual_value:.2f} USDT | "
            f"SL={stop_loss:.6f} | TP={take_profit:.6f} | "
            f"ryzyko={risk_usdt:.2f} USDT"
        )
        return PositionSize(
            quantity=quantity,
            usdt_value=round(actual_value, 4),
            stop_loss_price=stop_loss,
            take_profit_price=take_profit,
            risk_usdt=round(risk_usdt, 4),
        )

    def get_daily_stats(self, current_balance: float) -> Dict:
        start   = self._daily_start_balance or current_balance
        pnl     = current_balance - start
        pnl_pct = (pnl / start * 100) if start > 0 else 0
        remaining = (start * self.max_daily_loss_pct) + pnl
        return {
            "start_balance":        round(start, 2),
            "current_balance":      round(current_balance, 2),
            "daily_pnl":            round(pnl, 2),
            "daily_pnl_pct":        round(pnl_pct, 2),
            "remaining_loss_budget":round(max(remaining, 0), 2),
            "daily_limit_pct":      settings.MAX_DAILY_LOSS_PCT,
            "limit_exceeded":       self.is_daily_loss_exceeded(current_balance),
        }
