@echo off
setlocal
cd /d "%~dp0"
if not exist ".runtime\node\node.exe" (
  echo Please run Setup-Windows.cmd first.
  pause
  exit /b 1
)
if not exist "node_modules\playwright\package.json" (
  echo Please run Setup-Windows.cmd first.
  pause
  exit /b 1
)
set "PATH=%~dp0.runtime\node;%PATH%"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0.runtime\browsers"
"%~dp0.runtime\node\node.exe" "%~dp0server.js"
echo.
pause
