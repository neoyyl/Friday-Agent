import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useTranslation } from '../../../stores/languageStore'

interface UpdateStatus {
  status: string
  version?: string
  percent?: number
  error?: string
}

const SETTING_ITEMS = [
  { section: 'API配置', key: 'apiKey', label: 'API Key', desc: '你的 AI 提供商 API Key' },
  { section: 'API配置', key: 'provider', label: 'Provider', desc: '选择你的 AI 提供商' },
  { section: 'API配置', key: 'model', label: 'Model', desc: '选择使用的模型' },
  { section: 'API配置', key: 'temperature', label: 'Temperature', desc: '采样温度 (0-2)' },
  { section: 'API配置', key: 'maxTokens', label: 'Max Tokens', desc: '最大输出 Token 数' },
  { section: '主题设置', key: 'theme', label: 'Theme', desc: '选择主题模式' },
  { section: '主题设置', key: 'showGraph', label: 'Show Memory Graph', desc: '显示记忆图谱' },
  { section: '语音设置', key: 'voiceLang', label: 'Voice Language', desc: '语音识别和合成的语言' },
  { section: '语音设置', key: 'voiceAutoSend', label: 'Voice Auto Send', desc: '语音识别后自动发送消息' },
  { section: '语音设置', key: 'ttsProvider', label: 'TTS Provider', desc: '语音合成提供商' },
  { section: '语音设置', key: 'ttsVoice', label: 'TTS Voice', desc: '语音合成音色' },
  { section: '安全设置', key: 'sandboxEnabled', label: '安全沙箱', desc: '启用后，文件操作和命令执行将受到安全限制' },
]

export function SettingsPanel() {
  const { settings, saveSettings, loadSettings } = useSettingsStore()
  const { t } = useTranslation()
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [localSettings, setLocalSettings] = useState(settings)
  const [searchQuery, setSearchQuery] = useState('')

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
  const handleSettingChange = async (key: keyof typeof settings, value: any) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
    // 对于布尔开关，立即保存以确保即时生效
    if (key === 'showGraph' || key === 'sandboxEnabled' || key === 'voiceAutoSend') {
      await saveSettings(newSettings)
    }
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
    if (!updateStatus) return t('CHECK_UPDATE')

    switch (updateStatus.status) {
      case 'checking':
        return t('CHECKING')
      case 'available':
        return `${t('NEW_VERSION')} v${updateStatus.version}`
      case 'not-available':
        return t('LATEST_VERSION')
      case 'downloading':
        return `${t('DOWNLOADING')} ${Math.round(updateStatus.percent || 0)}%`
      case 'downloaded':
        return `${t('DOWNLOADED')} v${updateStatus.version}，${t('CLICK_INSTALL')}`
      case 'error':
        return `${t('UPDATE_FAILED')}: ${updateStatus.error}`
      default:
        return t('CHECK_UPDATE')
    }
  }

  // 是否显示安装按钮
  const showInstallButton = updateStatus?.status === 'downloaded'

  const providers = ['openai', 'anthropic', 'deepseek', 'openrouter']
  const themes = ['light', 'dark', 'system']

  const q = searchQuery.toLowerCase().trim()
  const sectionMatches = SETTING_ITEMS.reduce<Record<string, Array<typeof SETTING_ITEMS[number]>>>((acc, item) => {
    if (!q || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)) {
      (acc[item.section] ||= []).push(item)
    }
    return acc
  }, {})
  const matchCount = Object.values(sectionMatches).reduce((s, items) => s + items.length, 0)

  return (
    <div className="settings-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 className="settings-title" style={{ margin: 0 }}>设置</h3>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索设置项..."
          className="setting-input"
        />
        {searchQuery.trim() && (
          <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
            匹配 {matchCount} 项设置
          </div>
        )}
      </div>

      {/* Sections */}
      {['API配置', '主题设置', '语音设置', '安全设置'].map(sectionName => {
        const visibleItems = sectionMatches[sectionName]
        if (searchQuery.trim() && !visibleItems) return null

        return (
          <div key={sectionName} className="settings-section">
            {(!searchQuery.trim() || visibleItems?.length !== SETTING_ITEMS.filter(i => i.section === sectionName).length) && (
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '8px', letterSpacing: '0.04em' }}>
                {sectionName}
                {visibleItems && ` (${visibleItems.length})`}
              </div>
            )}

            {sectionName === 'API配置' && <>
              <div className="setting-item" style={{ display: (!q || 'api key'.includes(q) || '你的 ai 提供商 api key'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">API Key</div>
                  <div className="setting-description">你的 AI 提供商 API Key</div>
                </div>
              </div>
              <input
                type="password"
                className="setting-input"
                value={localSettings.apiKey}
                onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                placeholder="sk-..."
                style={{ display: (!q || 'api key'.includes(q) || '你的 ai 提供商 api key'.includes(q)) ? undefined : 'none' }}
              />
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'provider'.includes(q) || '选择你的 ai 提供商'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Provider</div>
                  <div className="setting-description">选择你的 AI 提供商</div>
                </div>
                <select className="setting-select" value={localSettings.provider} onChange={(e) => handleSettingChange('provider', e.target.value)}>
                  {providers.map((p) => (<option key={p} value={p}>{p}</option>))}
                </select>
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'model'.includes(q) || '选择使用的模型'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Model</div>
                  <div className="setting-description">选择使用的模型</div>
                </div>
                <input type="text" className="setting-input" value={localSettings.model} onChange={(e) => handleSettingChange('model', e.target.value)} placeholder="gpt-4o" />
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'temperature'.includes(q) || '采样温度'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Temperature</div>
                  <div className="setting-description">采样温度 (0-2)</div>
                </div>
                <input type="number" className="setting-input" value={localSettings.temperature} onChange={(e) => handleSettingChange('temperature', e.target.value)} min="0" max="2" step="0.1" />
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'max tokens'.includes(q) || '最大输出 token 数'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Max Tokens</div>
                  <div className="setting-description">最大输出 Token 数</div>
                </div>
                <input type="number" className="setting-input" value={localSettings.maxTokens} onChange={(e) => handleSettingChange('maxTokens', e.target.value)} min="1" max="128000" />
              </div>
            </>}

            {sectionName === '主题设置' && <>
              <div className="setting-item" style={{ display: (!q || 'theme'.includes(q) || '选择主题模式'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Theme</div>
                  <div className="setting-description">选择主题模式</div>
                </div>
                <select className="setting-select" value={localSettings.theme} onChange={(e) => handleSettingChange('theme', e.target.value as 'light' | 'dark' | 'system')}>
                  {themes.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'show memory graph'.includes(q) || '显示记忆图谱'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Show Memory Graph</div>
                  <div className="setting-description">显示记忆图谱</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={localSettings.showGraph} onChange={(e) => handleSettingChange('showGraph', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            </>}

            {sectionName === '语音设置' && <>
              <div className="setting-item" style={{ display: (!q || 'voice language'.includes(q) || '语音识别'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Voice Language</div>
                  <div className="setting-description">语音识别和合成的语言</div>
                </div>
                <select className="setting-select" value={localSettings.voiceLang} onChange={(e) => handleSettingChange('voiceLang', e.target.value)}>
                  <option value="zh-CN">中文 (zh-CN)</option>
                  <option value="en-US">English (en-US)</option>
                </select>
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'voice auto send'.includes(q) || '语音识别后自动发送'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">Voice Auto Send</div>
                  <div className="setting-description">语音识别后自动发送消息</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={localSettings.voiceAutoSend} onChange={(e) => handleSettingChange('voiceAutoSend', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'tts provider'.includes(q) || '语音合成提供商'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">TTS Provider</div>
                  <div className="setting-description">语音合成提供商</div>
                </div>
                <select className="setting-select" value={localSettings.ttsProvider} onChange={(e) => handleSettingChange('ttsProvider', e.target.value)}>
                  <option value="native">系统原生</option>
                  <option value="openai">OpenAI TTS</option>
                </select>
              </div>
              <div className="setting-item" style={{ marginTop: '12px', display: (!q || 'tts voice'.includes(q) || '语音合成音色'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">TTS Voice</div>
                  <div className="setting-description">语音合成音色</div>
                </div>
                <select className="setting-select" value={localSettings.ttsVoice} onChange={(e) => handleSettingChange('ttsVoice', e.target.value)}>
                  <option value="alloy">alloy</option>
                  <option value="echo">echo</option>
                  <option value="fable">fable</option>
                  <option value="onyx">onyx</option>
                  <option value="nova">nova</option>
                  <option value="shimmer">shimmer</option>
                </select>
              </div>
            </>}

            {sectionName === '安全设置' && <>
              <div className="setting-item" style={{ display: (!q || '安全沙箱'.includes(q) || '文件操作和命令执行'.includes(q)) ? undefined : 'none' }}>
                <div className="setting-info">
                  <div className="setting-label">安全沙箱</div>
                  <div className="setting-description">启用后，文件操作和命令执行将受到安全限制</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={localSettings.sandboxEnabled} onChange={(e) => handleSettingChange('sandboxEnabled', e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            </>}
          </div>
        )
      })}

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
