@echo off
echo ====================================
echo   Story Recorder - Starten...
echo ====================================
echo.

cd /d "%~dp0"

REM Check if node_modules exists
if not exist "backend\node_modules" (
    echo Installiere Abhaengigkeiten...
    npm install --prefix backend
    echo.
)

echo Starte Server...
echo.
echo Die App ist erreichbar unter: http://localhost:3000
echo.
echo Druecke Strg+C zum Beenden.
echo ====================================
echo.

REM Start the main server (foreground)
npm start --prefix backend
