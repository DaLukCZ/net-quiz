@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════╗
echo ║         NetQuiz - Spuštění             ║
echo ╚════════════════════════════════════════╝
echo.

cd /d "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python není nainstalován!
    echo.
    echo Stáhni Python z: https://www.python.org/downloads/
    echo V průběhu instalace ZAŠKRTNI "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo ✓ Python nalezen
echo.
echo 🌐 Spouštím server...
echo.
echo 📍 Otevři v prohlížeči: http://localhost:8000
echo.
echo ℹ️  Zavřít server: Zmáčkni Ctrl+C
echo.

python -m http.server 8000

pause
