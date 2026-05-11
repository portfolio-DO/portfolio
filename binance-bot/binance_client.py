"""
binance_client.py - Klient REST API Binance
Obsługuje autentykację HMAC-SHA256, pobieranie danych i składanie zleceń.

Dokumentacja oficjalna: https://binance-docs.github.io/apidocs/spot/en/
Testnet: https://testnet.binance.vision
"""

import asyncio
import hashlib
import hmac
import logging
import time
from typing import Dict, List, Optional
from urllib.parse import urlencode

import httpx

from config import settings, get_base_url

logger = logging.getLogger(__name__)


class BinanceClient:
    """
    Klient Binance Spot API (REST).
    Używa httpx do asynchronicznych zapytań HTTP.
    Autentykacja: HMAC-SHA256 (api_key + api_secret)
    """

    def __init__(self, api_key: str = None, api_secret: str = None):
        self.api_key = api_key or settings.BINANCE_API_KEY
        self.api_secret = api_secret or settings.BINANCE_API_SECRET
        self.base_url = get_base_url()
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Zwraca lub tworzy asynchroniczny klient HTTP."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers={
                    "X-MBX-APIKEY": self.api_key,
                    "Content-Type": "application/json",
                },
                timeout=30.0,
            )
        return self._client

    async def close(self):
        """Zamyka klienta HTTP."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def _sign(self, params: dict) -> dict:
        """
        Podpisuje parametry zapytania kluczem HMAC-SHA256.
        Wymagane dla endpointów TRADE i USER_DATA.
        """
        params["timestamp"] = int(time.time() * 1000)
        params["recvWindow"] = 5000
        query_string = urlencode(params)
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            query_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        params["signature"] = signature
        return params

    async def _get(self, endpoint: str, params: dict = None, signed: bool = False,
                  _retry: int = 0) -> dict:
        """Wykonuje zapytanie GET z automatycznym retry przy 429."""
        client = await self._get_client()
        p = params or {}
        if signed:
            p = self._sign(p)
        try:
            r = await client.get(endpoint, params=p)
            if r.status_code == 429:
                # Rate limit — poczekaj i spróbuj ponownie (max 2 razy)
                retry_after = int(r.headers.get("Retry-After", 2))
                wait = min(retry_after, 5)  # max 5 sekund czekania
                if _retry < 2:
                    logger.debug(f"⏳ 429 Rate limit na {endpoint}, czekam {wait}s...")
                    await asyncio.sleep(wait)
                    return await self._get(endpoint, params, signed, _retry + 1)
                else:
                    raise Exception(f"Binance API Error [429]: Rate limit exceeded")
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            error_body = e.response.json() if e.response.content else {}
            raise Exception(f"Binance API Error [{e.response.status_code}]: {error_body}")

    async def _post(self, endpoint: str, params: dict = None) -> dict:
        """Wykonuje podpisane zapytanie POST (dla zleceń)."""
        client = await self._get_client()
        p = self._sign(params or {})
        try:
            r = await client.post(endpoint, params=p)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            error_body = e.response.json() if e.response.content else {}
            raise Exception(f"Binance API Error [{e.response.status_code}]: {error_body}")

    async def _delete(self, endpoint: str, params: dict = None) -> dict:
        """Wykonuje podpisane zapytanie DELETE (anulowanie zleceń)."""
        client = await self._get_client()
        p = self._sign(params or {})
        try:
            r = await client.delete(endpoint, params=p)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            error_body = e.response.json() if e.response.content else {}
            raise Exception(f"Binance API Error [{e.response.status_code}]: {error_body}")

    # ── Publiczne endpointy (bez klucza) ────────────────────────────────────

    async def ping(self) -> bool:
        """Sprawdza połączenie z serwerem Binance."""
        try:
            await self._get("/api/v3/ping")
            return True
        except Exception:
            return False

    async def get_server_time(self) -> int:
        """Pobiera czas serwera Binance (ms)."""
        data = await self._get("/api/v3/time")
        return data["serverTime"]

    async def get_exchange_info(self, symbol: str = None) -> dict:
        """
        Pobiera informacje o parach tradingowych (filtry, limity lotów, itp.)
        Ważne dla poprawnego zaokrąglania wielkości zleceń.
        """
        params = {}
        if symbol:
            params["symbol"] = symbol
        return await self._get("/api/v3/exchangeInfo", params)

    async def get_ticker_price(self, symbol: str) -> float:
        """Pobiera aktualną cenę pary. Zwraca 0.0 jeśli symbol nie istnieje."""
        try:
            data = await self._get("/api/v3/ticker/price", {"symbol": symbol})
            price = float(data.get("price", 0))
            if price <= 0:
                logger.debug(f"⚠️ {symbol}: cena = {price}, pomijam")
                return 0.0
            return price
        except Exception:
            return 0.0

    # Cache złych symboli (klasa-level)
    _bad_symbols: set = set()

    async def get_klines(
        self,
        symbol: str,
        interval: str = "1h",
        limit: int = 300,
    ) -> List[Dict]:
        """Pobiera świece OHLCV. Zwraca [] dla nieistniejących symboli."""
        if symbol in BinanceClient._bad_symbols:
            return []
        # Małe opóźnienie żeby nie przekraczać rate limitów
        await asyncio.sleep(0.05)  # 50ms = max 20 req/s na goroutine
        try:
            raw = await self._get("/api/v3/klines", {
                "symbol": symbol,
                "interval": interval,
                "limit": limit,
            })
        except Exception as e:
            err = str(e)
            if "400" in err or "-1121" in err or "Invalid symbol" in err:
                BinanceClient._bad_symbols.add(symbol)
                logger.debug(f"⚠️ {symbol}: nieistniejący symbol — pomijam")
            else:
                logger.debug(f"⚠️ {symbol}: klines error: {e}")
            return []

        candles = []
        for k in raw:
            candles.append({
                "timestamp":    k[0],
                "open":         float(k[1]),
                "high":         float(k[2]),
                "low":          float(k[3]),
                "close":        float(k[4]),
                "volume":       float(k[5]),
                "close_time":   k[6],
                "quote_volume": float(k[7]),
                "trades":       int(k[8]),
            })
        return candles

    async def get_24h_stats(self, symbol: str) -> dict:
        """Pobiera statystyki 24h dla pary (zmiana %, wolumen, itp.)."""
        return await self._get("/api/v3/ticker/24hr", {"symbol": symbol})

    # ── Prywatne endpointy (wymagają klucza API) ────────────────────────────

    async def get_account(self) -> dict:
        """Pobiera informacje o koncie (salda, uprawnienia)."""
        return await self._get("/api/v3/account", signed=True)

    async def get_balance(self, asset: str = "USDT") -> float:
        """
        Pobiera wolne saldo dla danego aktywa.

        Args:
            asset: Symbol kryptowaluty (np. "USDT", "BTC", "ETH")

        Returns:
            Wolne saldo jako float
        """
        account = await self.get_account()
        balances = account.get("balances", [])
        for b in balances:
            if b["asset"] == asset:
                return float(b["free"])
        return 0.0

    async def get_all_balances(self) -> Dict[str, float]:
        """Zwraca słownik wszystkich niezerowych sald."""
        account = await self.get_account()
        result = {}
        for b in account.get("balances", []):
            free = float(b["free"])
            locked = float(b["locked"])
            total = free + locked
            if total > 0:
                result[b["asset"]] = {"free": free, "locked": locked, "total": total}
        return result

    async def get_open_orders(self, symbol: str = None) -> List[dict]:
        """Pobiera otwarte zlecenia (opcjonalnie filtruje po symbolu)."""
        params = {}
        if symbol:
            params["symbol"] = symbol
        return await self._get("/api/v3/openOrders", params, signed=True)

    async def get_order_history(self, symbol: str, limit: int = 50) -> List[dict]:
        """Pobiera historię zleceń dla danej pary."""
        return await self._get("/api/v3/allOrders", {
            "symbol": symbol,
            "limit": limit,
        }, signed=True)

    async def get_my_trades(self, symbol: str, limit: int = 50) -> List[dict]:
        """Pobiera historię transakcji dla pary."""
        return await self._get("/api/v3/myTrades", {
            "symbol": symbol,
            "limit": limit,
        }, signed=True)

    # ── Składanie i zarządzanie zleceniami ──────────────────────────────────

    async def place_market_order(
        self,
        symbol: str,
        side: str,       # "BUY" lub "SELL"
        quantity: float,
    ) -> dict:
        """
        Składa zlecenie rynkowe (natychmiastowe wykonanie po aktualnej cenie).

        Args:
            symbol: Para (np. "BTCUSDT")
            side: "BUY" lub "SELL"
            quantity: Ilość base asset (np. 0.001 BTC)

        Returns:
            Słownik z danymi zlecenia (orderId, status, fills, itp.)
        """
        params = {
            "symbol": symbol,
            "side": side,
            "type": "MARKET",
            "quantity": quantity,
        }
        result = await self._post("/api/v3/order", params)
        logger.info(
            f"📋 Zlecenie {side} {symbol} | Qty: {quantity} | "
            f"OrderID: {result.get('orderId')} | Status: {result.get('status')}"
        )
        return result

    async def place_limit_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        time_in_force: str = "GTC",  # Good Till Cancelled
    ) -> dict:
        """
        Składa zlecenie limit (wykonanie po określonej cenie lub lepszej).
        """
        params = {
            "symbol": symbol,
            "side": side,
            "type": "LIMIT",
            "timeInForce": time_in_force,
            "quantity": quantity,
            "price": price,
        }
        result = await self._post("/api/v3/order", params)
        logger.info(f"📋 Limit {side} {symbol} @ {price} | Qty: {quantity} | ID: {result.get('orderId')}")
        return result

    async def place_oco_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,         # Take-profit limit price
        stop_price: float,    # Stop-loss trigger price
        stop_limit_price: float,  # Stop-loss limit price
    ) -> dict:
        """
        OCO (One-Cancels-the-Other) — jednoczesne TP i SL.
        Gdy jedno się wykona, drugie jest automatycznie anulowane.
        Idealne do automatycznego zarządzania ryzykiem po otwarciu pozycji.
        """
        params = {
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "price": price,
            "stopPrice": stop_price,
            "stopLimitPrice": stop_limit_price,
            "stopLimitTimeInForce": "GTC",
        }
        result = await self._post("/api/v3/order/oco", params)
        logger.info(f"📋 OCO {side} {symbol} | TP: {price} | SL: {stop_price}")
        return result

    async def cancel_order(self, symbol: str, order_id: int) -> dict:
        """Anuluje otwarte zlecenie."""
        result = await self._delete("/api/v3/order", {
            "symbol": symbol,
            "orderId": order_id,
        })
        logger.info(f"❌ Anulowano zlecenie {order_id} na {symbol}")
        return result

    async def cancel_all_orders(self, symbol: str) -> List[dict]:
        """Anuluje wszystkie otwarte zlecenia dla danej pary."""
        return await self._delete("/api/v3/openOrders", {"symbol": symbol})

    # ── Helpers ─────────────────────────────────────────────────────────────

    async def get_symbol_info(self, symbol: str) -> dict:
        """
        Pobiera szczegółowe informacje o symbolu — filtry lotów, precyzja ceny.
        Potrzebne żeby prawidłowo zaokrąglić quantity przy składaniu zleceń.
        """
        info = await self.get_exchange_info(symbol)
        symbols = info.get("symbols", [])
        for s in symbols:
            if s["symbol"] == symbol:
                return s
        return {}

    def get_lot_size(self, symbol_info: dict) -> dict:
        """Wyciąga filtr LOT_SIZE z informacji o symbolu."""
        for f in symbol_info.get("filters", []):
            if f["filterType"] == "LOT_SIZE":
                return {
                    "min_qty": float(f["minQty"]),
                    "max_qty": float(f["maxQty"]),
                    "step_size": float(f["stepSize"]),
                }
        return {"min_qty": 0.001, "max_qty": 9999, "step_size": 0.001}

    def round_step_size(self, quantity: float, step_size: float) -> float:
        """
        Zaokrągla ilość do step_size Binance.
        Binance odrzuci zlecenie jeśli quantity nie jest wielokrotnością stepSize.
        """
        import math
        precision = int(round(-math.log(step_size, 10), 0))
        return round(round(quantity / step_size) * step_size, precision)

    async def test_connectivity(self) -> bool:
        """
        Sprawdza czy klucze API sa poprawne.
        Oficjalne URLe: demo.binance.com -> demo-api.binance.com
                        binance.com      -> api.binance.com
        """
        try:
            data = await self.get_account()
            logger.info(f"✅ Polaczono z Binance API: {self.base_url}")
            return True
        except Exception as e:
            err = str(e)
            logger.error(f"❌ Blad polaczenia z {self.base_url}: {e}")
            if "-2014" in err or "-2015" in err:
                logger.error("  Nieprawidlowy klucz - sprawdz BINANCE_MODE w .env")
                logger.error("  demo.binance.com klucze -> BINANCE_MODE=demo")
                logger.error("  binance.com klucze      -> BINANCE_MODE=real")
            elif "-1021" in err:
                logger.error("  Zly czas systemowy - zsynchronizuj zegar Windows")
            return False
