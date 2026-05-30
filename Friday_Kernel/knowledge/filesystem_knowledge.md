# 📚 Friday 文件系统安全知识图谱

**系统根目录**: C:\WINDOWS
**用户目录**: C:\Users\31822
**程序目录**: C:\Program Files

## 🔴 禁区（绝不触碰）
系统核心文件，删除会导致系统崩溃或无法启动
- `C:\WINDOWS\System32`
- `C:\WINDOWS\SysWOW64`
- `C:\WINDOWS\WinSxS`
- `C:\WINDOWS\assembly`
- `C:\WINDOWS\Microsoft.NET`
- `C:\WINDOWS\Installer`
- `C:\WINDOWS\Globalization`
- `C:\WINDOWS\INF`
- `C:\WINDOWS\Help`
- `C:\WINDOWS\Branding`
- `C:\WINDOWS\Cursors`
- `C:\Boot`
- `C:\bootmgr`
- `C:\BOOTSECT.BAK`
- `C:\System Volume Information`
- `C:\$Recycle.Bin`
- `C:\$WinREAgent`
- `C:\pagefile.sys`
- `C:\hiberfil.sys`
- `C:\swapfile.sys`
- `C:\WINDOWS\System32\drivers`

## 🟡 谨慎区（操作前确认）
程序安装和系统配置文件，删除可能导致软件无法运行
- `C:\Program Files`
- `C:\Program Files (x86)`
- `C:\WINDOWS`
- `C:\Users\Default`
- `C:\Users\Public`
- `C:\WINDOWS\System32\config\RegBack`
- `C:\WINDOWS\Microsoft.NET\Framework`
- `C:\WINDOWS\Microsoft.NET\Framework64`

## 🟢 安全区（可直接操作）
用户数据和临时文件，安全可操作
- `C:\Users\31822\AppData\Local\Temp`
- `C:\Users\31822\AppData\Local\Temp`
- `C:\Users\31822\Documents`
- `C:\Users\31822\Desktop`
- `C:\Users\31822\Downloads`
- `C:\Users\31822\Pictures`
- `C:\Users\31822\Music`
- `C:\Users\31822\Videos`
- `C:\Users\31822\AppData\Local\Microsoft\Windows\INetCache`
- `C:\Users\31822\AppData\Local\Microsoft\Windows\WER`
- `C:\$Recycle.Bin`
- `C:\WINDOWS\Logs`
- `C:\WINDOWS\Temp`
- `C:\WINDOWS\SoftwareDistribution\Download`
- `D:\`
- `E:\`
- `F:\`

## 🔧 自动维护任务
- 🟢 **清理临时文件**: 删除 Windows 和用户临时文件
- 🟢 **清理回收站**: 清空回收站释放空间
- 🟢 **清理Windows更新缓存**: 删除已安装的更新安装包缓存
- 🟢 **清理错误报告**: 删除 Windows 错误报告文件
- 🟢 **清理浏览器缓存**: 删除 Internet Explorer/Edge 缓存
- ℹ️ **磁盘清理建议**: 建议运行系统磁盘清理或手动整理大文件

---
*知识版本: 0.1.0 · 由 Friday OS Layer 管理*