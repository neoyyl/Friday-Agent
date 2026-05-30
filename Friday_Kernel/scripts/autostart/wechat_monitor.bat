@echo off
REM 检查微信是否有新消息的后台脚本
REM 每分钟运行一次

REM 检查微信是否在运行
tasklist | findstr /i "WeChat.exe" >nul
if %errorlevel% neq 0 (
    echo WeChat not running
    exit
)

REM 如果微信在运行，记录状态
echo WeChat running at %date% %time% >> "F:\AITest\AISystem\Learning evolution\logs\wechat_monitor.log"

REM 这里可以添加更多检查逻辑
REM 实际自动回复需要更复杂的集成
REM 目前先简单记录

exit