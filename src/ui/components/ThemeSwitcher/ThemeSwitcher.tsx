import { useState, useEffect } from 'react'
import { useThemeStore, ThemeName } from '../../../stores/themeStore'
import { useTranslation } from '../../../stores/languageStore'
import { useSettingsStore } from '../../../stores/settingsStore'

const THEMES: { id: ThemeName; nameKey: string; colors: string[] }[] = [
  { id: 'midnight', nameKey: 'THEME_MIDNIGHT', colors: ['#0f1822', '#8fb6d8', '#d39872'] },
  { id: 'phosphor', nameKey: 'THEME_PHOSPHOR', colors: ['#0a120c', '#9fe09a', '#f0c866'] },
  { id: 'violet', nameKey: 'THEME_VIOLET', colors: ['#161128', '#b098f0', '#78e0c8'] },
  { id: 'rose', nameKey: 'THEME_ROSE', colors: ['#24151f', '#e89aa8', '#f2c27a'] },
  { id: 'arctic', nameKey: 'THEME_ARCTIC', colors: ['#eaeef2', '#3a6a8f', '#b85a3a'] },
  { id: 'sand', nameKey: 'THEME_SAND', colors: ['#eae2d2', '#7a5a2c', '#c8502e'] },
  { id: 'cyberpunk', nameKey: 'THEME_CYBERPUNK', colors: ['#0d0a0f', '#00ffff', '#ff00ff'] },
  { id: 'stardust', nameKey: 'THEME_STARDUST', colors: ['#121025', '#b4a0ff', '#ffc0a0'] },
  { id: 'matcha', nameKey: 'THEME_MATCHA', colors: ['#d8e6c8', '#6a8a4a', '#aa7a5a'] },
  { id: 'sakura', nameKey: 'THEME_SAKURA', colors: ['#fae0e8', '#aa6a8a', '#ea9aaa'] },
  { id: 'aurora', nameKey: 'THEME_AURORA', colors: ['#102018', '#50e0a0', '#a0e050'] },
  { id: 'deepsea', nameKey: 'THEME_DEEPSEA', colors: ['#0a1828', '#40b0e0', '#e0a040'] }
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
  const { language, setLanguage, t } = useTranslation()
  const [showSettings, setShowSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('llm')

  // LLM Settings
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [baseUrl, setBaseUrl] = useState('')

  // Load settings from store on mount
  useEffect(() => {
    const st = useSettingsStore.getState().settings
    if (st.provider) setProvider(st.provider)
    if (st.apiKey) setApiKey(st.apiKey)
    if (st.model) setModel(st.model)
    if (st.temperature) setTemperature(parseFloat(st.temperature))
    if (st.maxTokens) setMaxTokens(parseInt(st.maxTokens))
    if (st.voiceLang) setVoiceLang(st.voiceLang)
    if (st.voiceAutoSend !== undefined) setVoiceAutoSend(st.voiceAutoSend)
    if (st.voiceThreshold) setVoiceThreshold(parseFloat(st.voiceThreshold))
    if (st.ttsProvider) setTtsProvider(st.ttsProvider)
    if (st.ttsVoice) setTtsVoice(st.ttsVoice)
    if (st.displayMode) setDisplayMode(st.displayMode)
    if (st.sandboxEnabled !== undefined) setSandboxEnabled(st.sandboxEnabled)
  }, [])

  // Voice Settings
  const [voiceLang, setVoiceLang] = useState('zh-CN')
  const [voiceAutoSend, setVoiceAutoSend] = useState(true)
  const [voiceThreshold, setVoiceThreshold] = useState(0.008)

  // TTS Settings
  const [ttsProvider, setTtsProvider] = useState('openai')
  const [ttsVoice, setTtsVoice] = useState('alloy')

  // Display Mode Settings
  const [displayMode, setDisplayMode] = useState<'graph' | 'cloud' | 'none'>('cloud')

  // Sandbox Settings
  const [sandboxEnabled, setSandboxEnabled] = useState(true)

  // Feedback
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    useSettingsStore.getState().saveSettings({ displayMode })
    window.dispatchEvent(new CustomEvent('display-mode-change', { detail: { mode: displayMode } }))
  }, [displayMode])

  useEffect(() => {
    useSettingsStore.getState().saveSettings({ sandboxEnabled })
    window.dispatchEvent(new CustomEvent('sandbox-toggle', { detail: { enabled: sandboxEnabled } }))
  }, [sandboxEnabled])

  const showFeedback = (msg: string) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 3000)
  }

  const saveLLM = () => {
    useSettingsStore.getState().saveSettings({
      provider,
      apiKey,
      model,
      temperature: String(temperature),
      maxTokens: String(maxTokens),
      ...(baseUrl ? { baseUrl } : {}),
    })
    showFeedback(t('LLM_SAVED'))
  }

  const saveVoice = () => {
    useSettingsStore.getState().saveSettings({
      voiceLang,
      voiceAutoSend,
      voiceThreshold: String(voiceThreshold),
    })
    showFeedback(t('VOICE_SAVED'))
  }

  const saveTTS = () => {
    useSettingsStore.getState().saveSettings({
      ttsProvider,
      ttsVoice,
    })
    showFeedback(t('TTS_SAVED'))
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
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🤖</div>
          <div className="settings-card-title">{t('PROVIDER')}</div>
        </div>
        <select
          className="settings-select-modern"
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

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">💬</div>
          <div className="settings-card-title">{t('MODEL')}</div>
        </div>
        <select
          className="settings-select-modern"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {getCurrentModels().map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🔑</div>
          <div className="settings-card-title">{t('API_KEY')}</div>
        </div>
        <input
          type="password"
          className="settings-input-modern"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🌡️</div>
          <div className="settings-card-title">
            {t('TEMPERATURE')} <span className="settings-value-badge">{temperature.toFixed(2)}</span>
          </div>
        </div>
        <input
          type="range"
          className="settings-slider-modern"
          min="0"
          max="2"
          step="0.01"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
        />
        <div className="settings-slider-labels-modern">
          <span>{t('PRECISE')}</span>
          <span>{t('CREATIVE')}</span>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">📝</div>
          <div className="settings-card-title">{t('MAX_TOKENS')}</div>
        </div>
        <input
          type="number"
          className="settings-input-modern"
          value={maxTokens}
          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
          min="256"
          max="128000"
        />
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🌐</div>
          <div className="settings-card-title">API Base URL</div>
        </div>
        <input
          type="url"
          className="settings-input-modern"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <div className="settings-hint-modern">自定义 API 地址，普通用户无需填写</div>
      </div>

      <button className="settings-save-modern" onClick={saveLLM}>
        <span className="btn-icon">💾</span>
        {t('SAVE_LLM')}
      </button>
    </div>
  )

  const renderVoiceTab = () => (
    <div className="settings-tab-content">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🌍</div>
          <div className="settings-card-title">{t('LANGUAGE')}</div>
        </div>
        <select
          className="settings-select-modern"
          value={voiceLang}
          onChange={(e) => setVoiceLang(e.target.value)}
        >
          <option value="zh-CN">中文 (简体)</option>
          <option value="en-US">English (US)</option>
          <option value="ja-JP">日本語</option>
        </select>
      </div>

      <div className="settings-card">
        <div className="settings-toggle-card">
          <div className="settings-toggle-info">
            <div className="settings-toggle-title">{t('AUTO_SEND')}</div>
            <div className="settings-toggle-desc">{t('AUTO_SEND_DESC')}</div>
          </div>
          <label className="switch-modern">
            <input
              type="checkbox"
              checked={voiceAutoSend}
              onChange={(e) => setVoiceAutoSend(e.target.checked)}
            />
            <span className="slider-modern"></span>
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🎯</div>
          <div className="settings-card-title">
            {t('DETECTION_THRESHOLD')} <span className="settings-value-badge">{voiceThreshold.toFixed(3)}</span>
          </div>
        </div>
        <input
          type="range"
          className="settings-slider-modern"
          min="0.001"
          max="0.05"
          step="0.001"
          value={voiceThreshold}
          onChange={(e) => setVoiceThreshold(parseFloat(e.target.value))}
        />
        <div className="settings-slider-labels-modern">
          <span>{t('SENSITIVE')}</span>
          <span>{t('STRICT')}</span>
        </div>
      </div>

      <button className="settings-save-modern" onClick={saveVoice}>
        <span className="btn-icon">💾</span>
        {t('SAVE_VOICE')}
      </button>
    </div>
  )

  const renderTTSTab = () => (
    <div className="settings-tab-content">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🔊</div>
          <div className="settings-card-title">{t('TTS_PROVIDER')}</div>
        </div>
        <select
          className="settings-select-modern"
          value={ttsProvider}
          onChange={(e) => setTtsProvider(e.target.value)}
        >
          <option value="openai">OpenAI TTS</option>
          <option value="edge">Edge TTS (免费)</option>
          <option value="minimax">MiniMax</option>
        </select>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🎙️</div>
          <div className="settings-card-title">{t('VOICE_SELECT')}</div>
        </div>
        <select
          className="settings-select-modern"
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
              <option value="zh-CN-XiaoxiaoNeural">Xiaoxiao (女)</option>
              <option value="zh-CN-YunxiNeural">Yunxi (男)</option>
              <option value="en-US-JennyNeural">Jenny (女)</option>
              <option value="en-US-GuyNeural">Guy (男)</option>
            </>
          )}
        </select>
      </div>

      <button className="settings-save-modern" onClick={saveTTS}>
        <span className="btn-icon">💾</span>
        {t('SAVE_TTS')}
      </button>
    </div>
  )

  const renderAppearanceTab = () => (
    <div className="settings-tab-content">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🎨</div>
          <div className="settings-card-title">{t('THEME')}</div>
        </div>
        <div className="theme-grid-modern">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card-modern ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => setTheme(theme.id)}
            >
              <div className="theme-preview-modern">
                {theme.colors.map((color, i) => (
                  <div key={i} className="theme-color-modern" style={{ backgroundColor: color }} />
                ))}
              </div>
              <div className="theme-name-modern">{t(theme.nameKey as any)}</div>
              {currentTheme === theme.id && <div className="theme-check-mark">✓</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderGraphTab = () => (
    <div className="settings-tab-content">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">✨</div>
          <div className="settings-card-title">{t('MEMORY_GRAPH')}</div>
        </div>
        <div className="display-mode-grid">
          <div
            className={`mode-card ${displayMode === 'none' ? 'active' : ''}`}
            onClick={() => setDisplayMode('none')}
          >
            <div className="mode-icon">🙈</div>
            <div className="mode-name">{t('HIDE_DISPLAY')}</div>
            {displayMode === 'none' && <div className="mode-check">✓</div>}
          </div>
          <div
            className={`mode-card ${displayMode === 'graph' ? 'active' : ''}`}
            onClick={() => setDisplayMode('graph')}
          >
            <div className="mode-icon">🧠</div>
            <div className="mode-name">{t('GRAPH_MODE')}</div>
            {displayMode === 'graph' && <div className="mode-check">✓</div>}
          </div>
          <div
            className={`mode-card ${displayMode === 'cloud' ? 'active' : ''}`}
            onClick={() => setDisplayMode('cloud')}
          >
            <div className="mode-icon">🌌</div>
            <div className="mode-name">{t('CLOUD_MODE')}</div>
            {displayMode === 'cloud' && <div className="mode-check">✓</div>}
          </div>
        </div>
      </div>
    </div>
  )

  const renderSystemTab = () => (
    <div className="settings-tab-content">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-icon">🗣️</div>
          <div className="settings-card-title">{t('SYSTEM_LANGUAGE')}</div>
        </div>
        <div className="language-grid-modern">
          <div
            className={`language-card-modern ${language === 'zh' ? 'active' : ''}`}
            onClick={() => setLanguage('zh')}
          >
            <div className="language-flag-modern">🇨🇳</div>
            <div className="language-name-modern">{t('CHINESE')}</div>
            {language === 'zh' && <div className="language-check-mark">✓</div>}
          </div>
          <div
            className={`language-card-modern ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            <div className="language-flag-modern">🇺🇸</div>
            <div className="language-name-modern">{t('ENGLISH')}</div>
            {language === 'en' && <div className="language-check-mark">✓</div>}
          </div>
        </div>
        <div className="settings-hint-modern">{t('LANGUAGE_HINT')}</div>
      </div>

      <div className="settings-card">
        <div className="settings-toggle-card">
          <div className="settings-toggle-info">
            <div className="settings-toggle-title">{t('SANDBOX')}</div>
            <div className="settings-toggle-desc">{t('SANDBOX_DESC')}</div>
          </div>
          <label className="switch-modern">
            <input
              type="checkbox"
              checked={sandboxEnabled}
              onChange={(e) => setSandboxEnabled(e.target.checked)}
            />
            <span className="slider-modern"></span>
          </label>
        </div>
      </div>
    </div>
  )

  const renderAboutTab = () => (
    <div className="settings-tab-content">
      <div className="about-card">
        <div className="about-logo-modern">🤖</div>
        <div className="about-name-modern">Friday</div>
        <div className="about-version-modern">v0.1.0</div>
        <div className="about-desc-modern">{t('PERSONAL_AI')}</div>
        <div className="about-divider"></div>
        <div className="about-links-modern">
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="about-link">
            <span className="link-icon">📦</span>
            GitHub
          </a>
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
        className="settings-btn-modern"
        onClick={() => setShowSettings(!showSettings)}
        title={t('SETTINGS')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51v-.09a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>

      {showSettings && (
        <>
          <div className="settings-overlay" onClick={() => setShowSettings(false)} />
          <div className="settings-panel-modern" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header-modern">
              <div className="settings-header-left">
                <div className="settings-title-modern">{t('SETTINGS')}</div>
              </div>
              <button className="settings-close-modern" onClick={() => setShowSettings(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="settings-body-modern">
              <div className="settings-nav-modern">
                {TABS.map(tab => (
                  <div
                    key={tab.id}
                    className={`settings-nav-item-modern ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="nav-icon-modern">{tab.icon}</span>
                    <span className="nav-name-modern">{getTabIdName(tab.id)}</span>
                  </div>
                ))}
              </div>

              <div className="settings-content-modern">
                {renderTabContent()}
                {feedback && <div className="settings-feedback-modern">{feedback}</div>}
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .settings-btn-modern {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid var(--line-strong);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: var(--ink2);
          background: var(--panel);
          backdrop-filter: blur(20px);
        }

        .settings-btn-modern:hover {
          transform: translateY(-2px) scale(1.05);
          color: var(--warm);
          border-color: var(--warm);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--warm) 20%, transparent);
        }

        .settings-btn-modern svg {
          width: 20px;
          height: 20px;
        }

        .settings-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: 99;
          animation: fadeIn 0.2s ease;
        }

        .settings-panel-modern {
          position: fixed;
          top: 80px;
          right: 20px;
          width: 700px;
          height: 560px;
          background: var(--bg1);
          border: 1px solid var(--line-strong);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          z-index: 100;
          display: flex;
          flex-direction: column;
          animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .settings-header-modern {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid var(--line);
          background: linear-gradient(to bottom, var(--bg0), transparent);
        }

        .settings-title-modern {
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--ink);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          text-transform: uppercase;
        }

        .settings-close-modern {
          background: transparent;
          border: none;
          color: var(--dim);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .settings-close-modern:hover {
          color: var(--ink);
          background: var(--line);
        }

        .settings-close-modern svg {
          width: 18px;
          height: 18px;
        }

        .settings-body-modern {
          display: flex;
          flex: 1;
          min-height: 0;
        }

        .settings-nav-modern {
          width: 130px;
          border-right: 1px solid var(--line);
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: color-mix(in srgb, var(--bg0) 50%, transparent);
        }

        .settings-nav-item-modern {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--dim);
        }

        .settings-nav-item-modern:hover {
          background: var(--line);
          color: var(--ink);
          transform: translateX(2px);
        }

        .settings-nav-item-modern.active {
          background: linear-gradient(135deg, color-mix(in srgb, var(--cool) 18%, transparent), color-mix(in srgb, var(--warm) 8%, transparent));
          color: var(--cool);
          border: 1px solid color-mix(in srgb, var(--cool) 30%, transparent);
        }

        .nav-icon-modern {
          font-size: 16px;
        }

        .nav-name-modern {
          font-size: 12px;
          font-weight: 600;
        }

        .settings-content-modern {
          flex: 1;
          padding: 20px 24px;
          overflow-y: auto;
        }

        .settings-tab-content {
          min-height: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .settings-card {
          background: var(--panel);
          border: 1px solid var(--line-strong);
          border-radius: 14px;
          padding: 18px;
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
        }

        .settings-card:hover {
          border-color: color-mix(in srgb, var(--cool) 40%, var(--line-strong));
        }

        .settings-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .settings-card-icon {
          font-size: 20px;
        }

        .settings-card-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .settings-value-badge {
          padding: 2px 8px;
          background: color-mix(in srgb, var(--warm) 15%, transparent);
          border: 1px solid color-mix(in srgb, var(--warm) 30%, transparent);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          color: var(--warm);
          font-family: "JetBrains Mono", ui-monospace, monospace;
        }

        .settings-input-modern,
        .settings-select-modern {
          width: 100%;
          padding: 12px 14px;
          background: var(--bg0);
          border: 1px solid var(--line-strong);
          border-radius: 10px;
          color: var(--ink);
          font-size: 13px;
          outline: none;
          transition: all 0.15s ease;
        }

        .settings-input-modern:focus,
        .settings-select-modern:focus {
          border-color: var(--cool);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--cool) 15%, transparent);
        }

        .settings-input-modern::placeholder {
          color: var(--dim);
        }

        .settings-slider-modern {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--line);
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
        }

        .settings-slider-modern::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--warm);
          cursor: pointer;
          box-shadow: 0 2px 8px color-mix(in srgb, var(--warm) 40%, transparent);
          transition: all 0.2s ease;
        }

        .settings-slider-modern::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        .settings-slider-labels-modern {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--dim);
          margin-top: 8px;
          font-weight: 500;
        }

        .settings-save-modern {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--warm), color-mix(in srgb, var(--warm) 80%, #fff));
          border: none;
          border-radius: 12px;
          color: var(--bg0);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-transform: uppercase;
        }

        .settings-save-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--warm) 35%, transparent);
        }

        .settings-save-modern:active {
          transform: translateY(0);
        }

        .btn-icon {
          font-size: 14px;
        }

        .settings-hint-modern {
          font-size: 11px;
          color: var(--dim);
          margin-top: 10px;
          font-style: italic;
        }

        .settings-toggle-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .settings-toggle-info {
          flex: 1;
        }

        .settings-toggle-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink);
          margin-bottom: 4px;
        }

        .settings-toggle-desc {
          font-size: 11px;
          color: var(--dim);
        }

        .switch-modern {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 28px;
        }

        .switch-modern input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider-modern {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--line-strong);
          transition: 0.3s;
          border-radius: 28px;
        }

        .slider-modern:before {
          position: absolute;
          content: "";
          height: 22px;
          width: 22px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .switch-modern input:checked + .slider-modern {
          background: linear-gradient(135deg, var(--cool), var(--warm));
        }

        .switch-modern input:checked + .slider-modern:before {
          transform: translateX(20px);
        }

        .theme-grid-modern {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }

        .theme-card-modern {
          padding: 12px;
          border: 2px solid var(--line);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg1);
          position: relative;
        }

        .theme-card-modern:hover {
          border-color: color-mix(in srgb, var(--cool) 40%, var(--line));
          transform: translateY(-3px);
        }

        .theme-card-modern.active {
          border-color: var(--warm);
          background: linear-gradient(135deg, color-mix(in srgb, var(--warm) 15%, var(--bg1)), color-mix(in srgb, var(--cool) 8%, var(--bg1)));
        }

        .theme-preview-modern {
          display: flex;
          gap: 6px;
          margin-bottom: 10px;
          justify-content: center;
        }

        .theme-color-modern {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }

        .theme-name-modern {
          font-size: 11px;
          color: var(--ink2);
          text-align: center;
          font-weight: 600;
        }

        .theme-card-modern.active .theme-name-modern {
          color: var(--warm);
        }

        .theme-check-mark {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          background: var(--warm);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bg0);
          font-size: 12px;
          font-weight: 900;
        }

        .language-grid-modern {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .language-card-modern {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 16px;
          border: 2px solid var(--line);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg1);
          position: relative;
        }

        .language-card-modern:hover {
          border-color: color-mix(in srgb, var(--cool) 40%, var(--line));
          transform: translateY(-3px);
        }

        .language-card-modern.active {
          border-color: var(--warm);
          background: linear-gradient(135deg, color-mix(in srgb, var(--warm) 15%, var(--bg1)), color-mix(in srgb, var(--cool) 8%, var(--bg1)));
        }

        .language-flag-modern {
          font-size: 36px;
          margin-bottom: 10px;
        }

        .language-name-modern {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }

        .language-card-modern.active .language-name-modern {
          color: var(--warm);
        }

        .language-check-mark {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 22px;
          height: 22px;
          background: var(--warm);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bg0);
          font-size: 12px;
          font-weight: 900;
        }

        .about-card {
          text-align: center;
          padding: 32px 24px;
          background: var(--panel);
          border: 1px solid var(--line-strong);
          border-radius: 16px;
        }

        .about-logo-modern {
          font-size: 56px;
          margin-bottom: 16px;
          filter: drop-shadow(0 4px 12px color-mix(in srgb, var(--cool) 25%, transparent));
        }

        .about-name-modern {
          font-size: 24px;
          font-weight: 800;
          color: var(--ink);
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }

        .about-version-modern {
          font-size: 13px;
          color: var(--dim);
          margin-bottom: 12px;
          font-family: "JetBrains Mono", ui-monospace, monospace;
          padding: 4px 10px;
          background: var(--line);
          border-radius: 999px;
          display: inline-block;
        }

        .about-desc-modern {
          font-size: 14px;
          color: var(--ink2);
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .about-divider {
          height: 1px;
          background: var(--line);
          margin: 20px 40px;
        }

        .about-links-modern {
          display: flex;
          justify-content: center;
        }

        .about-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          background: var(--bg0);
          border: 1px solid var(--line-strong);
          border-radius: 10px;
          color: var(--cool);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .about-link:hover {
          border-color: var(--cool);
          background: color-mix(in srgb, var(--cool) 10%, var(--bg0));
          transform: translateY(-2px);
        }

        .link-icon {
          font-size: 14px;
        }

        .display-mode-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .mode-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 12px;
          border: 2px solid var(--line);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg1);
          position: relative;
        }

        .mode-card:hover {
          border-color: color-mix(in srgb, var(--cool) 40%, var(--line));
          transform: translateY(-3px);
        }

        .mode-card.active {
          border-color: var(--warm);
          background: linear-gradient(135deg, color-mix(in srgb, var(--warm) 15%, var(--bg1)), color-mix(in srgb, var(--cool) 8%, var(--bg1)));
        }

        .mode-icon {
          font-size: 28px;
          margin-bottom: 8px;
        }

        .mode-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--ink2);
          text-align: center;
        }

        .mode-card.active .mode-name {
          color: var(--warm);
        }

        .mode-check {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          background: var(--warm);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bg0);
          font-size: 12px;
          font-weight: 900;
        }

        .settings-feedback-modern {
          margin-top: 16px;
          padding: 12px 16px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--cool) 15%, transparent), color-mix(in srgb, var(--warm) 8%, transparent));
          border: 1px solid color-mix(in srgb, var(--cool) 30%, transparent);
          border-radius: 12px;
          color: var(--cool);
          font-size: 13px;
          text-align: center;
          font-weight: 600;
          animation: slideIn 0.25s ease;
        }
      `}</style>
    </>
  )
}
