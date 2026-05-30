@echo off
chcp 65001 > nul
title Friday - 注册开机自启

echo ========================================
echo   Friday 开机自启注册
echo ========================================
echo.

:: 获取当前路径
set "VBS_PATH=F:\AITest\Friday_Kernel\scripts\friday_service.vbs"

:: 注册到 HKCU 启动项（无需管理员权限）
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" ^
    /v "Friday" ^
    /t REG_SZ ^
    /d "wscript.exe \"%VBS_PATH%\"" ^
    /f

if %errorlevel% equ 0 (
    echo   ✅ 开机自启已注册
    echo   Friday 会在每次开机时自动启动
    echo.
    echo   验证：reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Friday"
) else (
    echo   ❌ 注册失败
)

echo.
echo ========================================
pause
