Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c set PYTHONIOENCODING=utf-8 && python ""F:\AITest\Friday_Kernel\modules\friday_awake.py""", 0, False
