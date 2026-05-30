@echo off
title Friday Awake
set PYTHONIOENCODING=utf-8
echo Testing Python...
where python
echo.
echo Starting Friday...
python "F:\AITest\Friday_Kernel\modules\friday_awake.py"
echo.
echo Friday exited. Press any key to close.
pause > nul
