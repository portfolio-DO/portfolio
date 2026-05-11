"""
main.py - Punkt wejścia bota Binance
"""

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from bot import TradingBot
from api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    bot = TradingBot()
    app.state.bot = bot
    print(f"✅ Binance Trading Bot uruchomiony")
    print(f"🌐 Dashboard: http://localhost:{settings.APP_PORT}")
    yield
    if bot.is_running:
        await bot.stop()
    print("🛑 Bot zatrzymany")


app = FastAPI(title="Binance Trading Bot", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=False)
