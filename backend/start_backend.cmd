@echo off
setlocal
set "BACKEND_DIR=%~dp0"
set "REPO_ROOT=%BACKEND_DIR%.."
set "PYTHON=%BACKEND_DIR%venv\Scripts\python.exe"

if not exist "%PYTHON%" (
  echo Backend virtual environment not found: "%PYTHON%"
  exit /b 1
)

cd /d "%REPO_ROOT%"
"%PYTHON%" -m uvicorn backend.app:app --host 127.0.0.1 --port 8124 %*
