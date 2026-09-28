@echo off
rem VICT agent workspace demo launcher (260927)
rem Starts the local demo: builds the UI packages, then serves the
rem workspace at http://127.0.0.1:5181/agent
cd /d "%~dp0"

echo === VICT agent workspace demo ===
echo Building UI packages (first run takes a minute), then serving...
echo.

rem Launch the server in its own window so this one can wait + open the browser.
start "VICT workspace server" /min cmd /c "npm run workspace & echo. & echo Server stopped. & pause"

echo Waiting for http://127.0.0.1:5181/agent ...
:waitloop
timeout /t 3 /nobreak >nul
curl -s -o nul --max-time 3 http://127.0.0.1:5181/agent
if errorlevel 1 goto waitloop

start "" http://127.0.0.1:5181/agent
echo.
echo Demo is running at http://127.0.0.1:5181/agent
echo Close the minimized "VICT workspace server" window to stop it.
echo This window can be closed.
pause
