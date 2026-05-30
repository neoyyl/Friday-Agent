@echo off
title Friday Awake
set PYTHONIOENCODING=utf-8
echo ========================================
echo   Friday Awake - Voice Assistant
echo ========================================
python "F:\AITest\Friday_Kernel\modules\friday_awake.py"
if errorlevel 1 (
    echo.
    echo Failed to start. Check error above.
    pause
)
