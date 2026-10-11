@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Al Maqr - local server

if not exist node_modules (
  echo Installing packages for the first time...
  call npm install || goto :error
)

echo.
echo Starting Al Maqr on http://localhost:3000
echo Keep this window open. Close it (or press Ctrl+C) to stop the server.
echo.

rem Open the browser a few seconds after the server starts
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
call npm run dev
goto :eof

:error
echo.
echo Something went wrong. Make sure Node.js is installed: https://nodejs.org
pause
