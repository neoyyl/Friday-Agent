import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../../stores/settingsStore'

interface UpdateStatus {
  status: string
  version?: string
  percent?: number
  error?: string
}

export function SettingsPanel() {
  const { settings, setSettings, saveSettings } = useSettingsStore()
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  // 监听更新状态
  useEffect(() => {
    const unsubscribe = (window as any).electronAPI?.update?.onStatus?.((status: UpdateStatus) => {
      setUpdateStatus(status)
      if (status.status === 'checking') {
        setIsCheckingUpdate(true)
      } else {
        setIsCheckingUpdate(false)
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // 切换安全沙箱
  const handleSandboxToggle = async () => {
    const newValue = !settings.sandboxEnabled
    setSettings({ sandboxEnabled: newValue })
    await saveSettings({ sandboxEnabled: newValue })
  }

  // 检查更新
  const handleCheckUpdate = async () => {
    try {
      await (window as any).electronAPI?.update?.check()
    } catch (error) {
      console.error('Failed to check update:', error)
    }
  }

  // 安装更新
  const handleInstallUpdate = async () => {
    try {
      await (window as any).electronAPI?.update?.install()
    } catch (error) {
      console.error('Failed to install update:', error)
    }
  }

  // 获取更新状态文本
  const getUpdateStatusText = () => {
    if (!updateStatus) return '检查更新'

    switch (updateStatus.status) {
      case 'checking':
        return '检查中...'
      case 'available':
        return `发现新版本 v${updateStatus.version}`
      case 'not-available':
        return '已是最新版本'
      case 'downloading':
        return `下载中 ${Math.round(updateStatus.percent || 0)}%`
      case 'downloaded':
        return `已下载 v${updateStatus.version}，点击安装`
      case 'error':
        return `更新失败: ${updateStatus.error}`
      default:
        return '检查更新'
    }
  }

  // 是否显示安装按钮
  const showInstallButton = updateStatus?.status === 'downloaded'

  return (
    <div className="settings-panel">
      <h3 className="settings-title">设置</h3>

      {/* 安全沙箱设置 */}
      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">安全沙箱</div>
            <div className="setting-description">
              启用后，文件操作和命令执行将受到安全限制
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.sandboxEnabled}
              onChange={handleSandboxToggle}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      {/* 更新设置 */}
      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">应用更新</div>
            <div className="setting-description">
              {getUpdateStatusText()}
            </div>
          </div>
          <div className="setting-actions">
            {showInstallButton ? (
              <button
                className="btn btn-primary"
                onClick={handleInstallUpdate}
              >
                安装更新
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate}
              >
                {isCheckingUpdate ? '检查中...' : '检查更新'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 下载进度条 */}
      {updateStatus?.status === 'downloading' && (
        <div className="settings-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${updateStatus.percent || 0}%` }}
            ></div>
          </div>
        </div>
      )}

      <style>{`
        .settings-panel {
          padding: 20px;
          max-width: 500px;
        }

        .settings-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 24px;
          color: var(--text);
        }

        .settings-section {
          margin-bottom: 24px;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 8px;
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .setting-info {
          flex: 1;
          margin-right: 16px;
        }

        .setting-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 4px;
        }

        .setting-description {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .setting-actions {
          display: flex;
          gap: 8px;
        }

        /* Switch 样式 */
        .switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border);
          transition: 0.3s;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
        }

        input:checked + .slider {
          background-color: var(--accent);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        .slider.round {
          border-radius: 24px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        /* 按钮样式 */
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          opacity: 0.9;
        }

        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--border);
        }

        /* 进度条样式 */
        .progress-bar {
          height: 6px;
          background: var(--border);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          transition: width 0.3s;
        }
      `}</style>
    </div>
  )
}
