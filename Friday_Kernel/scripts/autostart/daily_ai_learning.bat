@echo off
REM 每日AI学习任务 - 定时12点执行
REM 使用方法: 设置Windows任务计划程序，每天12点调用此脚本

echo [%date% %time%] Starting daily AI learning task... >> "F:\AITest\AISystem\Learning evolution\logs\daily_learn_%date:~0,4%%date:~5,2%%date:~8,2%.log"

REM 调用OpenCode执行学习任务
opencode --task "以AI机器学习为主题，搜索最新论文，获取摘要并总结，写入F:\AITest\AISystem\Learning evolution"

echo [%date% %time%] Task completed >> "F:\AITest\AISystem\Learning evolution\logs\daily_learn_%date:~0,4%%date:~5,2%%date:~8,2%.log"

echo Daily AI learning task completed. Check logs for details.
pause