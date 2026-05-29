import { useState, useEffect } from 'react'
import { useThemeStore, ThemeName } from '../../../stores/themeStore'
import { useLanguageStore } from '../../../stores/languageStore'

const THEMES: { id: ThemeName; name: string; colors: string[] }[] = [
  { id: 'midnight', name: '午夜星云', colors: ['#0f1822', '#8fb6d8', '#d39872'] },
  { id: 'phosphor', name: '荧光绿', colors: ['#0a120c', '#9fe09a', '#f0c866'] },
  { id: 'violet', name: '紫色星云', colors: ['#161128', '#b098f0', '#78e0c8'] },
  { id: 'rose', name: '玫瑰暖色', colors: ['#24151f', '#e89aa8', '#f2c27a'] },
  { id: 'arctic', name: '极地白色', colors: ['#eaeef2', '#3a6a8f', '#b85a3a'] },
  { id: 'sand', name: '沙漠暖黄', colors: ['#eae2d2', '#7a5a2c', '#c8502e'] }
]

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
  { id: 'qwen', name: '通义千问', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'] },
  { id: 'zhipu', name: '智谱AI', models: ['glm-4', 'glm-4-flash', 'glm-4-long', 'glm-3-turbo'] },
  { id: 'moonshot', name: 'Kimi', models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'] },
  { id: 'google', name: 'Google Gemini', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'] },
  { id: 'ollama', name: 'Ollama (Local)', models: ['llama3', 'mistral', 'qwen2'] },
]

type TabId = 'llm' | 'voice' | 'tts' | 'appearance' | 'graph' | 'system' | 'about'

export function ThemeSwitcher() {
  const { currentTheme, setTheme } = useThemeStore()
  const { language, setLanguage, t } = useLanguageStore()
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('llm')
  
  // LLM Settings
  const [provider, setProvider] = useState(localStorage.getItem('friday-provider') || 'openai')
  const [apiKey, setApiKey] = useState(localStorage.getItem('friday-api-key') || '')
  const [model, setModel] = useState(localStorage.getItem('friday-model') || 'gpt-4o')
  const [temperature, setTemperature] = useState(parseFloat(localStorage.getItem('friday-temperature') || '0.7'))
  const [maxTokens, setMaxTokens] = useState(parseInt(localStorage.getItem('friday-max-tokens') || '4096'))
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('friday-base-url') || '')
  
  // Voice Settings
  const [voiceLang, setVoiceLang] = useState(localStorage.getItem('friday-voice-lang') || 'zh-CN')
  const [voiceAutoSend, setVoiceAutoSend] = useState(localStorage.getItem('friday-voice-auto-send') !== 'false')
  const [voiceThreshold, setVoiceThreshold] = useState(parseFloat(localStorage.getItem('friday-voice-threshold') || '0.008'))
  
  // TTS Settings
  const [ttsProvider, setTtsProvider] = useState(localStorage.getItem('friday-tts-provider') || 'openai')
  const [ttsVoice, setTtsVoice] = useState(localStorage.getItem('friday-tts-voice') || 'alloy')
  
  // Graph Settings
  const [showGraph, setShowGraph] = useState(() => {
    return localStorage.getItem('friday-show-graph') !== 'false'
  })
  
  // Sandbox Settings
  const [sandboxEnabled, setSandboxEnabled] = useState(() => {
    return localStorage.getItem('friday-sandbox-enabled') !== 'false'
  })
  
  // Update Settings
  const [updateStatus, setUpdateStatus] = useState<{ status: string; version?: string; percent?: number } | null>(null)
  
  // Feedback
  const [feedback, setFeedback] = useState('')
  
  useEffect(() => {
    localStorage.setItem('friday-show-graph', String(showGraph))
    window.dispatchEvent(new CustomEvent('graph-toggle', { detail: { show: showGraph } }))
  }, [showGraph])
  
  useEffect(() => {
    localStorage.setItem('friday-sandbox-enabled', String(sandboxEnabled))
    // 通知沙箱模块更新状态
    window.dispatchEvent(new CustomEvent('sandbox-toggle', { detail: { enabled: sandboxEnabled } }))
  }, [sandboxEnabled])
  
  // 监听更新状态
  useEffect(() => {
    const unsubscribe = (window as any).electronAPI?.update?.onStatus?.((status: any) => {
      setUpdateStatus(status)
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])
  
  const showFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }
  
  const saveLLM = () => {
    localStorage.setItem('friday-provider', provider)
    localStorage.setItem('friday-api-key', apiKey)
    localStorage.setItem('friday-model', model)
    localStorage.setItem('friday-temperature', String(temperature))
    localStorage.setItem('friday-max-tokens', String(maxTokens))
    if (baseUrl) localStorage.setItem('friday-base-url', baseUrl)
    else localStorage.removeItem('friday-base-url')
    ;(window as any).electronAPI?.settings?.update?.({ apiKey, model, temperature: String(temperature), maxTokens: String(maxTokens), provider }).catch(() => {})
    showFeedback(t('LLM_SAVED'))
  }
  
  const saveVoice = () => {
    localStorage.setItem('friday-voice-lang', voiceLang)
    localStorage.setItem('friday-voice-auto-send', String(voiceAutoSend))
    localStorage.setItem('friday-voice-threshold', String(voiceThreshold))
    showFeedback(t('VOICE_SAVED'))
  }
  
  const saveTTS = () => {
    localStorage.setItem('friday-tts-provider', ttsProvider)
    localStorage.setItem('friday-tts-voice', ttsVoice)
    showFeedback(t('TTS_SAVED'))
  }
  
  const handleCheckUpdate = async () => {
    try {
      await (window as any).electronAPI?.update?.check()
    } catch (error) {
      console.error('Failed to check update:', error)
    }
  }
  
  const handleInstallUpdate = async () => {
    try {
      await (window as any).electronAPI?.update?.install()
    } catch (error) {
      console.error('Failed to install update:', error)
    }
  }
  
  const getCurrentModels = () => {
    const p = PROVIDERS.find(p => p.id === provider)
    return p ? p.models : []
  }
  
  const getTabIdName = (id: TabId): string => {
    const map: Record<TabId, string> = {
      llm: t('LLM'),
      voice: t('VOICE'),
      tts: t('TTS'),
      appearance: t('APPEARANCE'),
      graph: t('GRAPH'),
      system: t('SYSTEM'),
      about: t('ABOUT'),
    }
    return map[id]
  }
  
  const renderLLMTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">{t('PROVIDER')}</div>
        <select 
          className="settings-select"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value)
            const p = PROVIDERS.find(p => p.id === e.target.value)
            if (p && p.models.length > 0) setModel(p.models[0])
          }}
        >
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('MODEL')}</div>
        <select 
          className="settings-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {getCurrentModels().map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('API_KEY')}</div>
        <input 
          type="password" 
          className="settings-input"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('TEMPERATURE')}: {temperature.toFixed(2)}</div>
        <input 
          type="range" 
          className="settings-slider"
          min="0" 
          max="2" 
          step="0.01"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
        />
        <div className="settings-slider-labels">
          <span>{t('PRECISE')}</span>
          <span>{t('CREATIVE')}</span>
        </div>
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('MAX_TOKENS')}</div>
        <input 
          type="number" 
          className="settings-input"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
          min="256"
          max="128000"
        />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">API Base URL (可选)</div>
        <input 
          type="url" 
          className="settings-input"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="留空使用默认地址"
        />
        <div className="settings-hint">自定义 API 地址，普通用户无需填写</div>
      </div>
      
      <button className="settings-save" onClick={saveLLM}>{t('SAVE_LLM')}</button>
    </div>
  )
  
  const renderVoiceTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">{t('LANGUAGE')}</div>
        <select 
          className="settings-select"
          value={voiceLang}
          onChange={(e) => setVoiceLang(e.target.value)}
        >
          <option value="zh-CN">中文</option>
          <option value="en-US">English</option>
          <option value="ja-JP">日本語</option>
        </select>
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('AUTO_SEND')}</div>
        <div className="settings-toggle-row">
          <span className="settings-toggle-label">{t('AUTO_SEND_DESC')}</span>
          <button 
            className={`settings-toggle ${voiceAutoSend ? 'active' : ''}`}
            onClick={() => setVoiceAutoSend(!voiceAutoSend)}
          >
            {voiceAutoSend ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('DETECTION_THRESHOLD')}: {voiceThreshold.toFixed(3)}</div>
        <input 
          type="range" 
          className="settings-slider"
          min="0.001" 
          max="0.05" 
          step="0.001"
          value={voiceThreshold}
          onChange={(e) => setVoiceThreshold(parseFloat(e.target.value))}
        />
        <div className="settings-slider-labels">
          <span>{t('SENSITIVE')}</span>
          <span>{t('STRICT')}</span>
        </div>
      </div>
      
      <button className="settings-save" onClick={saveVoice}>{t('SAVE_VOICE')}</button>
    </div>
  )
  
  const renderTTSTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">{t('TTS_PROVIDER')}</div>
        <select 
          className="settings-select"
          value={ttsProvider}
          onChange={(e) => setTtsProvider(e.target.value)}
        >
          <option value="openai">OpenAI TTS</option>
          <option value="edge">Edge TTS (Free)</option>
          <option value="minimax">MiniMax</option>
        </select>
      </div>
      
      <div className="settings-section">
        <div className="settings-section-title">{t('VOICE_SELECT')}</div>
        <select 
          className="settings-select"
          value={ttsVoice}
          onChange={(e) => setTtsVoice(e.target.value)}
        >
          {ttsProvider === 'openai' && (
            <>
              <option value="alloy">Alloy</option>
              <option value="echo">Echo</option>
              <option value="fable">Fable</option>
              <option value="onyx">Onyx</option>
              <option value="nova">Nova</option>
              <option value="shimmer">Shimmer</option>
            </>
          )}
          {ttsProvider === 'edge' && (
            <>
              <option value="zh-CN-XiaoxiaoNeural">Xiaoxiao (Female)</option>
              <option value="zh-CN-YunxiNeural">Yunxi (Male)</option>
              <option value="en-US-JennyNeural">Jenny (Female)</option>
              <option value="en-US-GuyNeural">Guy (Male)</option>
            </>
          )}
        </select>
      </div>
      
      <button className="settings-save" onClick={saveTTS}>{t('SAVE_TTS')}</button>
    </div>
  )
  
  const renderAppearanceTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">{t('THEME')}</div>
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => setTheme(theme.id)}
            >
              <div className="theme-preview">
                {theme.colors.map((color, i) => (
                  <div key={i} className="theme-color" style={{ backgroundColor: color }} />
                ))}
              </div>
              <div className="theme-name">{theme.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
  
  const renderGraphTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">{t('MEMORY_GRAPH')}</div>
        <div className="settings-toggle-row">
          <span className="settings-toggle-label">{t('SHOW_GRAPH')}</span>
          <button 
            className={`settings-toggle ${showGraph ? 'active' : ''}`}
            onClick={() => setShowGraph(!showGraph)}
          >
            {showGraph ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="settings-hint">{t('GRAPH_HINT')}</div>
      </div>
    </div>
  )
  
  const renderSystemTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-section-title">{t('SYSTEM_LANGUAGE')}</div>
        <div className="language-options">
          <div 
            className={`language-card ${language === 'zh' ? 'active' : ''}`}
            onClick={() => setLanguage('zh')}
          >
            <div className="language-flag">🇨🇳</div>
            <div className="language-name">{t('CHINESE')}</div>
          </div>
          <div 
            className={`language-card ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            <div className="language-flag">🇺🇸</div>
            <div className="language-name">{t('ENGLISH')}</div>
          </div>
        </div>
        <div className="settings-hint">{t('LANGUAGE_HINT')}</div>
      </div>
      
      {/* 安全沙箱设置 */}
      <div className="settings-section">
        <div className="settings-section-title">安全沙箱</div>
        <div className="settings-toggle-row">
          <span className="settings-toggle-label">启用后，文件操作和命令执行将受到安全限制</span>
          <button 
            className={`settings-toggle ${sandboxEnabled ? 'active' : ''}`}
            onClick={() => setSandboxEnabled(!sandboxEnabled)}
          >
            {sandboxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      
      {/* 应用更新 */}
      <div className="settings-section">
        <div className="settings-section-title">应用更新</div>
        <div className="settings-update-row">
          <span className="settings-update-status">
            {updateStatus?.status === 'checking' && '检查中...'}
            {updateStatus?.status === 'available' && `发现新版本 v${updateStatus.version}`}
            {updateStatus?.status === 'not-available' && '已是最新版本'}
            {updateStatus?.status === 'downloading' && `下载中 ${Math.round(updateStatus.percent || 0)}%`}
            {updateStatus?.status === 'downloaded' && `已下载 v${updateStatus.version}，点击安装`}
            {updateStatus?.status === 'error' && '更新失败'}
            {!updateStatus && '检查更新'}
          </span>
          <div className="settings-update-buttons">
            {updateStatus?.status === 'downloaded' ? (
              <button className="settings-save" onClick={handleInstallUpdate}>
                安装更新
              </button>
            ) : (
              <button 
                className="settings-save" 
                onClick={handleCheckUpdate}
                disabled={updateStatus?.status === 'checking'}
              >
                {updateStatus?.status === 'checking' ? '检查中...' : '检查更新'}
              </button>
            )}
          </div>
        </div>
        {updateStatus?.status === 'downloading' && (
          <div className="settings-progress-bar">
            <div 
              className="settings-progress-fill" 
              style={{ width: `${updateStatus.percent || 0}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  )
  
  const renderAboutTab = () => (
    <div className="settings-tab-content">
      <div className="settings-section">
        <div className="settings-about">
          <div className="about-logo">🤖</div>
          <div className="about-name">Friday</div>
          <div className="about-version">v0.1.0</div>
          <div className="about-desc">{t('PERSONAL_AI')}</div>
          <div className="about-links">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </div>
      </div>
    </div>
  )
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'llm': return renderLLMTab()
      case 'voice': return renderVoiceTab()
      case 'tts': return renderTTSTab()
      case 'appearance': return renderAppearanceTab()
      case 'graph': return renderGraphTab()
      case 'system': return renderSystemTab()
      case 'about': return renderAboutTab()
      default: return renderLLMTab()
    }
  }
  
  const TABS: { id: TabId; icon: string }[] = [
    { id: 'llm', icon: '🤖' },
    { id: 'voice', icon: '🎤' },
    { id: 'tts', icon: '🔊' },
    { id: 'appearance', icon: '🎨' },
    { id: 'graph', icon: '🧠' },
    { id: 'system', icon: '⚙️' },
    { id: 'about', icon: 'ℹ️' },
  ]
  
  return (
    <>
      <div 
        className="settings-btn"
        onClick={() => setShowSettings(!showSettings)}
        title={t('SETTINGS')}
      >
        ⚙
      </div>
      
      {showSettings && (
        <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
          <div className="settings-header">
            <span className="settings-title">{t('SETTINGS')}</span>
            <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
          </div>
          
          <div className="settings-body">
            <div className="settings-nav">
              {TABS.map(tab => (
                <div
                  key={tab.id}
                  className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="nav-icon">{tab.icon}</span>
                  <span className="nav-name">{getTabIdName(tab.id)}</span>
                </div>
              ))}
            </div>
            
            <div className="settings-content">
              {renderTabContent()}
              {feedback && <div className="settings-feedback">{feedback}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
