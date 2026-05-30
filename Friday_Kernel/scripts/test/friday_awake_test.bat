@echo off
title Friday Awake Test
chcp 65001 > nul
echo ========================================
echo   Friday Awake - Animation Test
echo   A pulsing circle will appear
echo   at bottom-right of your screen.
echo   Close the window to exit.
echo ========================================
python "F:\AITest\Friday_Kernel\modules\friday_awake.py" --test
pause
