@echo off
REM OpenClaw 自动启动脚本
REM 放到启动文件夹或创建计划任务

REM 启动OpenClaw并最小化运行
start "" "C:\Users\31822\AppData\Local\ai.opencode.desktop\opencode" --hidden

echo OpenClaw started at %date% %time% >> "F:\AITest\AISystem\Learning evolution\logs\autostart.log"
exit