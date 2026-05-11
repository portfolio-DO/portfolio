"""
strategy.py - Strategia RSI + SMA + Bollinger Bands
Pewnosc sygnalu obliczana plynnie (0.0 - 1.0) na podstawie
odleglosci RSI od progow, sily trendu SMA i pozycji wzgledem Bollingera.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Optional, List

import pandas as pd
import numpy as np

from config import settings

logger = logging.getLogger(__name__)


class Signal(Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


@dataclass
class AnalysisResult:
    symbol: str
    signal: Signal
    rsi: float
    sma_short: float
    sma_long: float
    current_price: float
    reason: str
    confidence: float   # 0.0 - 1.0, obliczana plynnie


def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.finfo(float).eps)
    return 100 - (100 / (1 + rs))


def calculate_sma(prices: pd.Series, period: int) -> pd.Series:
    return prices.rolling(window=period, min_periods=period).mean()


def calculate_bollinger_bands(prices: pd.Series, period: int = 20, std: float = 2.0):
    middle = prices.rolling(window=period).mean()
    rolling_std = prices.rolling(window=period).std()
    return middle + rolling_std * std, middle, middle - rolling_std * std


def calculate_macd(prices: pd.Series, fast=12, slow=26, signal=9):
    """MACD jako dodatkowy filtr trendu."""
    ema_fast = prices.ewm(span=fast, min_periods=fast).mean()
    ema_slow = prices.ewm(span=slow, min_periods=slow).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, min_periods=signal).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


class TradingStrategy:
    """
    Strategia: RSI + SMA 50/200 + Bollinger Bands + MACD

    Kluczowa zmiana: pewnosc sygnalu jest obliczana PLYNNIE
    na podstawie wielu czynnikow, nie jako stale wartosci.

    Przyklad dla BUY:
      RSI = 20  (daleko od progu 45) -> mocny sygnal -> wysoka pewnosc
      RSI = 43  (blisko progu 45)    -> slaby sygnal  -> niska pewnosc
      + bonus za trend SMA
      + bonus za Bollingera
      + bonus za MACD
      = laczona pewnosc 0.0 - 1.0
    """

    def __init__(self):
        self.rsi_period = settings.RSI_PERIOD
        self.rsi_oversold = settings.RSI_OVERSOLD      # prog kupna (np. 45)
        self.rsi_overbought = settings.RSI_OVERBOUGHT  # prog sprzedazy (np. 60)
        self.sma_short_period = settings.SMA_SHORT
        self.sma_long_period = settings.SMA_LONG
        self.min_candles = self.sma_long_period + self.rsi_period + 10

    def _rsi_buy_confidence(self, rsi: float) -> float:
        """
        Plynna pewnosc sygnalu BUY z RSI.

        Logika:
          RSI = 0   -> pewnosc 1.0  (ekstremalne wyprzedanie)
          RSI = prog -> pewnosc 0.0  (na granicy)
          RSI > prog -> brak sygnalu (ujemna, odcinamy do 0)

        Wzor: pewnosc = (prog - RSI) / prog
        """
        if rsi >= self.rsi_oversold:
            return 0.0
        # Im nizsze RSI tym wyzsza pewnosc
        confidence = float(self.rsi_oversold - rsi) / float(self.rsi_oversold)
        return float(round(min(confidence, 1.0), 4))

    def _rsi_sell_confidence(self, rsi: float) -> float:
        """
        Plynna pewnosc sygnalu SELL z RSI.

        RSI = 100     -> pewnosc 1.0
        RSI = prog    -> pewnosc 0.0
        """
        if rsi <= self.rsi_overbought:
            return 0.0
        confidence = float(rsi - self.rsi_overbought) / float(100 - self.rsi_overbought)
        return float(round(min(confidence, 1.0), 4))

    def _sma_trend_confidence(self, sma_short: float, sma_long: float) -> float:
        """
        Sila trendu na podstawie rozstania miedzy SMA50 i SMA200.

        Im bardziej SMA50 jest powyzej SMA200, tym silniejszy trend wzrostowy.
        Zwraca wartosc od -1.0 (silny trend spadkowy) do +1.0 (silny wzrostowy).
        """
        if sma_long == 0:
            return 0.0
        spread_pct = float(sma_short - sma_long) / float(sma_long)
        normalized = spread_pct / 0.05
        return float(round(max(-1.0, min(1.0, normalized)), 4))

    def _bollinger_confidence(self, price: float, bb_upper: float, bb_lower: float, bb_middle: float) -> float:
        """
        Pozycja ceny wzgledem wsteg Bollingera.

        Zwraca:
          +1.0 -> cena jest przy dolnej wstędze (sygnal kupna)
          -1.0 -> cena jest przy gornej wstędze (sygnal sprzedazy)
           0.0 -> cena jest posrodku
        """
        bb_range = bb_upper - bb_lower
        if bb_range == 0:
            return 0.0
        # Pozycja znormalizowana: 0 = dolna wstega, 1 = gorna wstega
        position = float(price - bb_lower) / float(bb_range)
        return float(round(1.0 - 2.0 * position, 4))

    def _macd_confidence(self, histogram: float, prev_histogram: float) -> float:
        """
        Sygnal MACD: histogram rosnacy = sygnal kupna, malejacy = sprzedazy.
        Zwraca wartosc od -0.3 do +0.3 jako bonus do pewnosci.
        """
        if prev_histogram == 0:
            return 0.0
        # Zmiana histogramu
        change = float(histogram - prev_histogram)
        normalized = change / (abs(float(prev_histogram)) + 1e-10)
        return float(round(max(-0.3, min(0.3, normalized * 0.3)), 4))

    def analyze(self, symbol: str, candles: List[dict]) -> Optional[AnalysisResult]:
        """
        Analizuje swiecze i generuje sygnal z plynna pewnoscia.
        """
        if len(candles) < self.min_candles:
            logger.warning(f"⚠️ {symbol}: Za malo danych ({len(candles)}/{self.min_candles})")
            return None

        df = pd.DataFrame(candles).sort_values("timestamp").reset_index(drop=True)
        closes = df["close"]

        # Oblicz wskazniki
        rsi_s       = calculate_rsi(closes, self.rsi_period)
        sma_short_s = calculate_sma(closes, self.sma_short_period)
        sma_long_s  = calculate_sma(closes, self.sma_long_period)
        bb_upper_s, bb_mid_s, bb_lower_s = calculate_bollinger_bands(closes)
        macd_line, signal_line, histogram_s = calculate_macd(closes)

        # Ostatnie wartosci
        rsi           = rsi_s.iloc[-1]
        sma_short     = sma_short_s.iloc[-1]
        sma_long      = sma_long_s.iloc[-1]
        price         = closes.iloc[-1]
        bb_upper      = bb_upper_s.iloc[-1]
        bb_lower      = bb_lower_s.iloc[-1]
        bb_middle     = bb_mid_s.iloc[-1]
        hist_now      = histogram_s.iloc[-1]
        hist_prev     = histogram_s.iloc[-2]
        prev_sma_s    = sma_short_s.iloc[-2]
        prev_sma_l    = sma_long_s.iloc[-2]

        # pd.isna zwraca numpy.bool_ — konwertuj na Python bool
        if any(bool(pd.isna(x)) for x in [rsi, sma_short, sma_long, bb_upper, bb_lower]):
            return None

        # ── Oblicz skladowe pewnosci ────────────────────────────────────────

        rsi_buy_conf  = self._rsi_buy_confidence(rsi)    # 0..1, im nizsze RSI tym wyzsze
        rsi_sell_conf = self._rsi_sell_confidence(rsi)   # 0..1, im wyzsze RSI tym wyzsze
        sma_trend     = self._sma_trend_confidence(sma_short, sma_long)  # -1..+1
        bb_pos        = self._bollinger_confidence(price, bb_upper, bb_lower, bb_middle)  # -1..+1
        macd_bonus    = self._macd_confidence(hist_now, hist_prev)  # -0.3..+0.3

        # Crossovery (jednorazowe zdarzenia)
        golden_cross  = (prev_sma_s <= prev_sma_l) and (sma_short > sma_long)
        death_cross   = (prev_sma_s >= prev_sma_l) and (sma_short < sma_long)
        uptrend       = sma_short > sma_long

        # ── Laczona pewnosc BUY ─────────────────────────────────────────────
        # Glowny skladnik: RSI
        # Dodatkowe: trend SMA (max +0.2), Bollinger (max +0.15), MACD (max +0.15)
        buy_confidence = (
            rsi_buy_conf * 0.50           # 50% wagi: jak bardzo RSI jest nizej od progu
            + max(sma_trend, 0) * 0.20    # 20% wagi: sila trendu wzrostowego
            + max(bb_pos, 0) * 0.15       # 15% wagi: bliskosc dolnej wstegi
            + max(macd_bonus, 0) * 0.15   # 15% wagi: rosnacy MACD
        )
        if golden_cross:
            buy_confidence = min(buy_confidence + 0.15, 1.0)

        # ── Laczona pewnosc SELL ────────────────────────────────────────────
        sell_confidence = (
            rsi_sell_conf * 0.50
            + max(-sma_trend, 0) * 0.20   # trend spadkowy
            + max(-bb_pos, 0) * 0.15      # bliskosc gornej wstegi
            + max(-macd_bonus, 0) * 0.15  # malejacy MACD
        )
        if death_cross:
            sell_confidence = min(sell_confidence + 0.15, 1.0)

        # ── Wybor sygnalu ───────────────────────────────────────────────────
        signal    = Signal.HOLD
        confidence = 0.0
        reasons   = []

        if buy_confidence > sell_confidence and buy_confidence > 0.05:
            signal     = Signal.BUY
            confidence = buy_confidence
            if rsi_buy_conf > 0:
                reasons.append(f"RSI={rsi:.1f} (prog={self.rsi_oversold})")
            if sma_trend > 0:
                reasons.append(f"trend↑ SMA={sma_trend:+.2f}")
            if bb_pos > 0.2:
                reasons.append("blisko dolnej BB")
            if golden_cross:
                reasons.append("Golden Cross!")
            if macd_bonus > 0.05:
                reasons.append("MACD↑")

        elif sell_confidence > buy_confidence and sell_confidence > 0.05:
            signal     = Signal.SELL
            confidence = sell_confidence
            if rsi_sell_conf > 0:
                reasons.append(f"RSI={rsi:.1f} (prog={self.rsi_overbought})")
            if sma_trend < 0:
                reasons.append(f"trend↓ SMA={sma_trend:+.2f}")
            if bb_pos < -0.2:
                reasons.append("blisko gornej BB")
            if death_cross:
                reasons.append("Death Cross!")
            if macd_bonus < -0.05:
                reasons.append("MACD↓")

        else:
            signal     = Signal.HOLD
            confidence = 0.0
            reasons.append(
                f"RSI={rsi:.1f} | BUY_conf={buy_confidence:.2f} SELL_conf={sell_confidence:.2f}"
            )

        confidence = round(min(max(confidence, 0.0), 1.0), 3)
        reason = " | ".join(reasons) if reasons else "Brak sygnalu"

        logger.info(
            f"📊 {symbol} | {signal.value} | RSI:{rsi:.1f} | "
            f"Pewnosc:{confidence:.1%} | {reason}"
        )

        # Konwertuj wszystko na Python native types (nie numpy!)
        # FastAPI nie może serializować numpy.float64, numpy.bool_ itp.
        return AnalysisResult(
            symbol=str(symbol),
            signal=signal,
            rsi=float(round(float(rsi), 2)),
            sma_short=float(round(float(sma_short), 6)),
            sma_long=float(round(float(sma_long), 6)),
            current_price=float(round(float(price), 6)),
            reason=str(reason),
            confidence=float(confidence),
        )
