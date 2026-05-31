import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../../stores/settingsStore'

interface UpdateStatus {
  status: string
  version?: string
  percent?: number
  error?: string
}

export function SettingsPanel() {
  const { settings, saveSettings, loadSettings } = useSettingsStore()
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [localSettings, setLocalSettings] = useState(settings)

  // 加载设置
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // 同步本地状态
  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

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

  // 更新单个设置
  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
  }

  // 保存所有更改
  const handleSave = async () => {
    await saveSettings(localSettings)
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

  const providers = ['openai', 'anthropic', 'deepseek', 'openrouter']
  const themes = ['light', 'dark', 'system']

  return (
    <div className="settings-panel">
      <h3 className="settings-title">设置</h3>

      {/* API 配置 */}
      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">API Key</div>
            <div className="setting-description">
              你的 AI 提供商 API Key
            </div>
          </div>
        </div>
        <input
          type="password"
          className="setting-input"
          value={localSettings.apiKey}
          onChange={(e) => handleSettingChange('apiKey', e.target.value)}
          placeholder="sk-..."
        />

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">Provider</div>
            <div className="setting-description">
              选择你的 AI 提供商
            </div>
          </div>
          <select
            className="setting-select"
            value={localSettings.provider}
            onChange={(e) => handleSettingChange('provider', e.target.value)}
          >
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">Model</div>
            <div className="setting-description">
              选择使用的模型
            </div>
          </div>
          <input
            type="text"
            className="setting-input"
            value={localSettings.model}
            onChange={(e) => handleSettingChange('model', e.target.value)}
            placeholder="gpt-4o"
          />
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">Temperature</div>
            <div className="setting-description">
              采样温度 (0-2)
            </div>
          </div>
          <input
            type="number"
            className="setting-input"
            value={localSettings.temperature}
            onChange={(e) => handleSettingChange('temperature', e.target.value)}
            min="0"
            max="2"
            step="0.1"
          />
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">Max Tokens</div>
            <div className="setting-description">
              最大输出 Token 数
            </div>
          </div>
          <input
            type="number"
            className="setting-input"
            value={localSettings.maxTokens}
            onChange={(e) => handleSettingChange('maxTokens', e.target.value)}
            min="1"
            max="128000"
          />
        </div>
      </div>

      {/* 主题设置 */}
      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Theme</div>
            <div className="setting-description">
              选择主题模式
            </div>
          </div>
          <select
            className="setting-select"
            value={localSettings.theme}
            onChange={(e) => handleSettingChange('theme', e.target.value as 'light' | 'dark' | 'system')}
          >
            {themes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">Show Memory Graph</div>
            <div className="setting-description">
              显示记忆图谱
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={localSettings.showGraph}
              onChange={(e) => handleSettingChange('showGraph', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      {/* 语音设置 */}
      <div className="settings-section">
        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Voice Language</div>
            <div className="setting-description">
              语音识别和合成的语言
            </div>
          </div>
          <select
            className="setting-select"
            value={localSettings.voiceLang}
            onChange={(e) => handleSettingChange('voiceLang', e.target.value)}
          >
            <option value="zh-CN">中文 (zh-CN)</option>
            <option value="en-US">English (en-US)</option>
          </select>
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">Voice Auto Send</div>
            <div className="setting-description">
              语音识别后自动发送消息
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={localSettings.voiceAutoSend}
              onChange={(e) => handleSettingChange('voiceAutoSend', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">TTS Provider</div>
            <div className="setting-description">
              语音合成提供商
            </div>
          </div>
          <select
            className="setting-select"
            value={localSettings.ttsProvider}
            onChange={(e) => handleSettingChange('ttsProvider', e.target.value)}
          >
            <option value="native">系统原生</option>
            <option value="openai">OpenAI TTS</option>
          </select>
        </div>

        <div className="setting-item" style={{ marginTop: '12px' }}>
          <div className="setting-info">
            <div className="setting-label">TTS Voice</div>
            <div className="setting-description">
              语音合成音色
            </div>
          </div>
          <select
            className="setting-select"
            value={localSettings.ttsVoice}
            onChange={(e) => handleSettingChange('ttsVoice', e.target.value)}
          >
            <option value="alloy">alloy</option>
            <option value="echo">echo</option>
            <option value="fable">fable</option>
            <option value="onyx">onyx</option>
            <option value="nova">nova</option>
            <option value="shimmer">shimmer</option>
          </select>
        </div>
      </div>

      {/* 安全设置 */}
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
              checked={localSettings.sandboxEnabled}
              onChange={(e) => handleSettingChange('sandboxEnabled', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </div>

      {/* 按钮区域 */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          保存设置
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleCheckUpdate}
          disabled={isCheckingUpdate}
        >
          {isCheckingUpdate ? '检查中...' : getUpdateStatusText()}
        </button>
        {showInstallButton && (
          <button className="btn btn-primary" onClick={handleInstallUpdate}>
            安装更新
          </button>
        )}
      </div>

      {/* 下载进度条 */}
      {updateStatus?.status === 'downloading' && (
        <div className="settings-section" style={{ marginTop: '16px' }}>
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
          padding: 16px;
          max-width: 360px;
        }

        .settings-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--text);
        }

        .settings-section {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--bg-elevated);
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .setting-info {
          flex: 1;
          margin-right: 16px;
        }

        .setting-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 2px;
        }

        .setting-description {
          font-size: 11px;
          color: var(--text-dim);
        }

        .setting-input {
          width: 100%;
          padding: 8px 10px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          font-size: 12px;
          outline: none;
          transition: border-color 0.15s;
        }

        .setting-input:focus {
          border-color: var(--accent);
        }

        .setting-select {
          padding: 6px 10px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          color: var(--text);
          font-size: 12px;
          outline: none;
          cursor: pointer;
        }

        /* Switch 样式 */
        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 22px;
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
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
        }

        input:checked + .slider {
          background-color: var(--accent);
        }

        input:checked + .slider:before {
          transform: translateX(22px);
        }

        .slider.round {
          border-radius: 22px;
        }

        .slider.round:before {
          border-radius: 50%;
        }

        /* 按钮样式 */
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
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
          height: 4px;
          background: var(--border);
          border-radius: 2px;
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
