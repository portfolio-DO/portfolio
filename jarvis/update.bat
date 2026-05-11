@echo off
echo.
echo ===================================
echo  JARVIS - Aktualizacja zaleznosci
echo ===================================
echo.
pip install httpx>=0.27.0 -q
pip install -r requirements.txt -q
echo.
echo Gotowe! Uruchom JARVIS:
echo   cd electron-app
echo   npm start
echo.
pause
