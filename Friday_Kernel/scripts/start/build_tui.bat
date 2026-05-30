@echo off
chcp 65001 > nul
title Friday TUI - Build

echo ========================================
echo   Building Friday TUI Executable
echo ========================================
echo.

:: 清理旧构建
if exist "F:\Product\Friday.exe" del "F:\Product\Friday.exe" /q
if exist "build" rmdir /s /q "build" 2>nul

:: 打包
pyinstaller --onefile ^
    --name "Friday" ^
    --console ^
    --add-data "F:\AITest\Friday_Kernel\modules\friday_gui;friday_gui" ^
    --hidden-import psutil ^
    --hidden-import speech_recognition ^
    --distpath "F:\Product" ^
    "F:\AITest\Friday_Kernel\modules\friday_gui\friday_tui.py"

:: 清理临时文件
if exist "Friday.spec" del "Friday.spec" /q
if exist "build" rmdir /s /q "build" 2>nul

echo.
echo ========================================
if exist "F:\Product\Friday.exe" (
    echo   ✅ Build successful!
    echo   Location: F:\Product\Friday.exe
    echo   Size: %~z1 bytes
) else (
    echo   ❌ Build failed
)
echo ========================================
pause
