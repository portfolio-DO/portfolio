# Binance Trading Bot

Automatyczny bot tradingowy dla Binance Spot API.
Strategia: RSI(14) + SMA50/SMA200 + Bollinger Bands

> OSTRZEZENIE: Nie gwarantuje zyskow. Testuj w trybie DEMO lub Testnet.

## Instalacja

```bash
python -m venv venv
source venv/bin/activate   # Linux/macOS
venv\Scripts\activate      # Windows
pip install -r requirements.txt
cp .env.example .env
# Uzupelnij .env swoimi kluczami API
python main.py
# Dashboard: http://localhost:8000
```

## Klucze API Binance

1. Zaloguj sie na binance.com
2. Profil -> API Management -> Create API
3. Wlacz tylko: Enable Spot & Margin Trading
4. NIE wlaczaj: Enable Withdrawals
5. Wklej API Key i Secret do .env

## Tryby bota

- demo       -> lokalna symulacja (bez zapytan do Binance)
- testnet    -> Binance Testnet (wirtualne srodowisko)
- goal       -> handluj do osiagniecia TARGET USDT
- continuous -> non-stop

## Testnet Binance

https://testnet.binance.vision
- Osobne konto testnet (nie Twoje glowne konto)
- Darmowe wirtualne USDT do testow
- Identyczne API jak produkcja

## REST API

GET  /api/status       - Stan bota
POST /api/bot/start    - Uruchom
POST /api/bot/stop     - Zatrzymaj
GET  /api/positions    - Otwarte pozycje
GET  /api/history      - Historia
GET  /api/analysis     - Ostatnia analiza
POST /api/settings     - Zmien parametry ryzyka
GET  /api/health       - Health-check
