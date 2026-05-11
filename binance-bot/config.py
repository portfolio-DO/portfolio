"""
config.py - Konfiguracja bota Binance
Tryb: Daytrading / Skalping
"""
import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    BINANCE_API_KEY: str = os.getenv("BINANCE_API_KEY", "")
    BINANCE_API_SECRET: str = os.getenv("BINANCE_API_SECRET", "")
    BINANCE_MODE: str = os.getenv("BINANCE_MODE", "demo")
    BINANCE_BASE_URL_DEMO: str = "https://demo-api.binance.com"
    BINANCE_BASE_URL_REAL: str = "https://api.binance.com"
    BOT_MODE: str = os.getenv("BOT_MODE", "demo")

    # ── Finanse ─────────────────────────────────────────────────────────────
    BUDGET: float = float(os.getenv("BUDGET", "10000.0"))
    TARGET: float = float(os.getenv("TARGET", "15000.0"))

    # Daytrading: większy % kapitału na transakcję = większe zyski (i ryzyko)
    CAPITAL_PER_TRADE_PCT: float = float(os.getenv("CAPITAL_PER_TRADE_PCT", "10.0"))

    # ── Ryzyko — daytrading ─────────────────────────────────────────────────
    # Węższy SL/TP = szybsze wyjście z pozycji (daytrading style)
    STOP_LOSS_PCT: float = float(os.getenv("STOP_LOSS_PCT", "1.5"))
    TAKE_PROFIT_PCT: float = float(os.getenv("TAKE_PROFIT_PCT", "3.0"))
    MAX_DAILY_LOSS_PCT: float = float(os.getenv("MAX_DAILY_LOSS_PCT", "5.0"))
    MAX_OPEN_POSITIONS: int = int(os.getenv("MAX_OPEN_POSITIONS", "15"))

    # ── Strategia — daytrading ──────────────────────────────────────────────
    RSI_PERIOD: int = int(os.getenv("RSI_PERIOD", "14"))
    # Agresywniejsze progi RSI dla daytrading (więcej sygnałów)
    RSI_OVERSOLD: float = float(os.getenv("RSI_OVERSOLD", "35.0"))
    RSI_OVERBOUGHT: float = float(os.getenv("RSI_OVERBOUGHT", "65.0"))
    SMA_SHORT: int = int(os.getenv("SMA_SHORT", "20"))   # krótsza SMA dla daytrading
    SMA_LONG: int = int(os.getenv("SMA_LONG", "50"))     # krótsza SMA200 -> SMA50

    # Krótszy interwał świecy = szybsza reakcja na ruchy
    KLINE_INTERVAL: str = os.getenv("KLINE_INTERVAL", "15m")

    # Szybka pętla
    CONCURRENT_REQUESTS: int = int(os.getenv("CONCURRENT_REQUESTS", "15"))
    LOOP_INTERVAL: int = int(os.getenv("LOOP_INTERVAL", "10"))

    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
    WEBHOOK_URL: str = os.getenv("WEBHOOK_URL", "")
    POSITIONS_FILE: str = os.getenv("POSITIONS_FILE", "positions.json")

    # ── Pary z wysoką zmiennością (dobre dla daytrading) ────────────────────
    # Priorytet: krypto które dużo skaczą w ciągu dnia
    SYMBOLS: list = [
        # Tier 1 — wysoka płynność + duże ruchy
        "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT",
        "DOGEUSDT","PEPEUSDT","SHIBUSDT","WIFUSDT","BONKUSDT",
        # Tier 2 — mid-cap, duże ruchy
        "ADAUSDT","MATICUSDT","AVAXUSDT","LINKUSDT","DOTUSDT",
        "NEARUSDT","APTUSDT","ARBUSDT","OPUSDT","INJUSDT",
        "SUIUSDT","ATOMUSDT","LTCUSDT","UNIUSDT","AAVEUSDT",
        # Tier 3 — wysoka zmienność
        "RUNEUSDT","GALAUSDT","SANDUSDT","MANAUSDT","AXSUSDT",
        "IMXUSDT","FLOKIUSDT","FTMUSDT","ALGOUSDT","VETUSDT",
        "HBARUSDT","EGLDUSDT","FLOWUSDT","ICPUSDT","FILUSDT",
        "GMTUSDT","APEUSDT","MAGICUSDT","CHZUSDT","ANKRUSDT",
        # Tier 4 — spekulacyjne, duże skoki
        "FETUSDT","AGIXUSDT","RNDRUSDT","OCEANUSDT","WOOUSDT",
        "STGUSDT","LDOUSDT","CRVUSDT","MKRUSDT","COMPUSDT",
        "YFIUSDT","SUSHIUSDT","BALUSDT","RENUSDT","SKLUSDT",
        "CELRUSDT","BANDUSDT","GRTUSDT","STORJUSDT","ZILUSDT",
        "BATUSDT","ZRXUSDT","IOTAUSDT","ONTUSDT","XLMUSDT",
        "EOSUSDT","XTZUSDT","TRXUSDT","WAVESUSDT","NEOUSDT",
        "DASHUSDT","ZECUSDT","XMRUSDT","KSMOUSDT","QNTUSDT",
        "TIAUSDT","PYTHUSDT","JUPUSDT","WUSDT","STRKUSDT",
        "DYMUSDT","ALTUSDT","ACEUSDT","XAIUSDT","SEIUSDT",
        "NOTUSDT","EIGENUSDT","CATIUSDT","HMSTRUSDT","POLUSDT",
        "MOVEUSDT","PENDLEUSDT","ARKMUSDT","CYBERUSDT","OMUSDT",
        "WLDUSDT","DODOUSDT","SFPUSDT","DCRUSDT","NKNUSDT",
        "OGNUSDT","SUPERUSDT","BONDUSDT","LPTUSDT","MLNUSDT",
        "RADUSDT","AMBUSDT","VOXELUSDT","QIUSDT","TUSDT",
        "BICOUSDT","FLUXUSDT","CVXUSDT","PRQUSDT","MCUSDT",
        "HIVEUSDT","OXTUSDT","POWRUSDT","BLZUSDT","DIAUSDT",
        "BNXUSDT","REIUSDT","GNSUSDT","FXSUSDT","AGLDUSDT",
        "CELOUSDT","MTLUSDT","IDEXUSDT","DYDXUSDT","PERPUSDT",
        "ACAUSDT","MOVRUSDT","XVSUSDT","NFTUSDT","MBOXUSDT",
        "HOOKUSDT","HIGHUSDT","MINAUSDT","CFXUSDT","SSVUSDT",
        "KEYUSDT","NMRUSDT","PERLUSDT","BELUSDT","WINGUSDT",
        "LITUSDT","CTKUSDT","IOSTUSDT","STMXUSDT","BNTUSDT",
        "SCUSDT","DGBUSDT","RVNUSDT","SXPUSDT","SUNUSDT",
        "ARPAUSDT","CVCUSDT","TWTUSDT","WOOUSDT","VIDTUSDT",
        "EPXUSDT","RAMPUSDT","FIROUSUSDT","TORNUSDT","BURGERUSDT",
        "AXELUSDT","COSUSDT","PROMUSDT","DEXEUSDT","STXUSDT",
        "UNFIUSDT","HARDUSDT","RSRSDT","WAXPUSDT","VIBUSDT",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


def get_base_url() -> str:
    if settings.BINANCE_MODE == "real":
        return settings.BINANCE_BASE_URL_REAL
    return settings.BINANCE_BASE_URL_DEMO
