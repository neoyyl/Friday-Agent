@echo off
REM OpenClaw autostart script
start "" "F:\AITest\ai.opencode.desktop\opencode" --hidden
echo OpenClaw started at %date% %time% >> "F:\AITest\AISystem\Learning evolution\logs\autostart.log"
exit