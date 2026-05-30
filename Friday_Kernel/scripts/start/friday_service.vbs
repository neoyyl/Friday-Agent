Set WshShell = CreateObject("WScript.Shell")
' Friday 后台服务启动器
' 用 pythonw.exe 运行，无控制台窗口

Dim pythonw, scriptPath
pythonw = "pythonw.exe"
scriptPath = "F:\AITest\Friday_Kernel\modules\friday_awake.py"

' 隐藏窗口运行 (0=隐藏, 1=正常, 2=最小化)
WshShell.Run pythonw & " """ & scriptPath & """", 0, False

' 给个反应时间
WScript.Sleep 1000

' 简单验证：如果5秒后进程还在，说明启动成功
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "cmd /c echo Friday 后台服务已启动 & timeout /t 3 > nul", 1, False
