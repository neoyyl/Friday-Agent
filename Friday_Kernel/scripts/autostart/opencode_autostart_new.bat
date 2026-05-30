@echo off
REM OpenClaw 自动启动脚本 (新路径)

start "" "F:\AITest\ai.opencode.desktop\opencode" --hidden

echo OpenClaw started at %date% %time% >> "F:\AITest\AISystem\Learning evolution\logs\autostart.log"
exit