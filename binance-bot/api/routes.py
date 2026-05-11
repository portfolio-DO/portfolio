"""
api/routes.py - Endpointy FastAPI dla bota Binance
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()


class StartBotRequest(BaseModel):
    api_key: Optional[str] = Field(None, description="Binance API Key")
    api_secret: Optional[str] = Field(None, description="Binance API Secret")
    binance_mode: Optional[str] = Field(None, description="demo / real")
    mode: Optional[str] = Field("demo", description="demo / real / goal / continuous / paper")
    budget: Optional[float] = Field(None, description="Budżet startowy w USDT")
    target: Optional[float] = Field(None, description="Cel w USDT (tryb goal)")


class UpdateSettingsRequest(BaseModel):
    capital_per_trade_pct: Optional[float] = Field(None, ge=0.5, le=50.0)
    stop_loss_pct: Optional[float] = Field(None, ge=0.1, le=20.0)
    take_profit_pct: Optional[float] = Field(None, ge=0.1, le=50.0)
    max_daily_loss_pct: Optional[float] = Field(None, ge=1.0, le=50.0)
    max_open_positions: Optional[int] = Field(None, ge=1, le=20)
    loop_interval: Optional[int] = Field(None, ge=10, le=3600)
    rsi_oversold: Optional[float] = Field(None, ge=10.0, le=60.0)
    rsi_overbought: Optional[float] = Field(None, ge=50.0, le=90.0)
    min_confidence: Optional[float] = Field(None, ge=0.01, le=1.0)
    max_position_hours: Optional[int] = Field(None, ge=1, le=720)
    kline_interval: Optional[str] = Field(None)


def get_bot(request: Request):
    bot = request.app.state.bot
    if bot is None:
        raise HTTPException(status_code=503, detail="Bot nie jest zainicjowany")
    return bot


@router.get("/status")
async def get_status(request: Request):
    """Pełny stan bota dla dashboardu."""
    return get_bot(request).get_dashboard_data()


@router.post("/bot/start")
async def start_bot(body: StartBotRequest, request: Request):
    """Uruchamia bota."""
    bot = get_bot(request)
    # Ustaw BINANCE_MODE jeśli podano w żądaniu
    if body.binance_mode:
        from config import settings as _s
        _s.BINANCE_MODE = body.binance_mode

    result = await bot.start(
        api_key=body.api_key,
        api_secret=body.api_secret,
        mode=body.mode,
        budget=body.budget,
        target=body.target,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/bot/stop")
async def stop_bot(request: Request):
    """Zatrzymuje bota."""
    return await get_bot(request).stop()


@router.get("/positions")
async def get_positions(request: Request):
    bot = get_bot(request)
    return {"positions": bot.open_positions, "count": len(bot.open_positions)}


@router.get("/history")
async def get_history(request: Request, limit: int = 50):
    bot = get_bot(request)
    return {"history": bot.trade_history[-limit:], "total": len(bot.trade_history)}


@router.get("/analysis")
async def get_analysis(request: Request):
    return {"analysis": get_bot(request).last_analysis}


@router.post("/settings")
async def update_settings(body: UpdateSettingsRequest, request: Request):
    """Aktualizuje parametry ryzyka w locie."""
    bot = get_bot(request)
    rm = bot.risk_manager
    if body.capital_per_trade_pct is not None:
        rm.capital_per_trade_pct = body.capital_per_trade_pct / 100
    if body.stop_loss_pct is not None:
        rm.stop_loss_pct = body.stop_loss_pct / 100
    if body.take_profit_pct is not None:
        rm.take_profit_pct = body.take_profit_pct / 100
    if body.max_daily_loss_pct is not None:
        rm.max_daily_loss_pct = body.max_daily_loss_pct / 100
    if body.max_open_positions is not None:
        rm.max_open_positions = body.max_open_positions
    if body.loop_interval is not None:
        bot._loop_interval = body.loop_interval
    if body.rsi_oversold is not None:
        bot.strategy.rsi_oversold = body.rsi_oversold
    if body.rsi_overbought is not None:
        bot.strategy.rsi_overbought = body.rsi_overbought
    if body.min_confidence is not None:
        bot._min_confidence = body.min_confidence
    if body.max_position_hours is not None:
        bot._max_position_hours = body.max_position_hours
    if body.kline_interval is not None:
        from config import settings as _cfg
        _cfg.KLINE_INTERVAL = body.kline_interval
        log_msg = f'Interwał świecy zmieniony na {body.kline_interval}'
        import logging; logging.getLogger(__name__).info(f'⚙️ {log_msg}')
    return {"success": True, "message": "Ustawienia zaktualizowane"}


@router.get("/health")
async def health():
    return {"status": "ok", "service": "Binance Trading Bot"}
