@echo off
REM 查找并启动微信
for /f "tokens=*" %%i in ('dir /s /b "C:\Program Files*\Tencent\WeChat\WeChat.exe" 2^nul') do (
    start "" "%%i"
    exit
)
for /f "tokens=*" %%i in ('dir /s /b "D:\Program Files*\Tencent\WeChat\WeChat.exe" 2^nul') do (
    start "" "%%i"
    exit
)
echo WeChat not found