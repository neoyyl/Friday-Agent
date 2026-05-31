import { useState, useCallback } from 'react'
import { useSettingsStore } from '../../../stores/settingsStore'
import { useTranslation } from '../../../stores/languageStore'
import { useThemeStore } from '../../../stores/themeStore'

interface OnboardingWizardProps {
  onComplete: () => void
}

const steps = ['language', 'llm', 'theme', 'finish'] as const

const themeColors: Record<string, string[]> = {
  midnight: ['#0a1118', '#8fb6d8'],
  phosphor: ['#0a120c', '#9fe09a'],
  violet: ['#161128', '#b098f0'],
  rose: ['#24151f', '#e89aa8'],
  arctic: ['#eaeef2', '#3a6a8f'],
  sand: ['#eae2d2', '#7a5a2c'],
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { settings, saveSettings } = useSettingsStore()
  const { language, setLanguage } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTheme, setSelectedTheme] = useState('midnight')

  const applyTheme = useCallback((name: string) => {
    setSelectedTheme(name)
    useThemeStore.getState().setTheme(name as any)
  }, [])
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [modelName, setModelName] = useState(settings.model || 'gpt-4o')
  const [providerName, setProviderName] = useState(settings.provider || 'openai')

  const step = steps[currentStep]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = async () => {
    await saveSettings({
      apiKey,
      model: modelName,
      provider: providerName,
      voiceLang: language === 'zh' ? 'zh-CN' : 'en-US',
      onboardingCompleted: true,
    })
    onComplete()
  }

  const canProceed = () => {
    if (step === 'llm') return apiKey.trim().length > 0
    return true
  }

  const renderStepIndicator = () => (
    <div style={{
      display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '32px',
    }}>
      {steps.map((s, i) => (
        <div key={s} style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: i <= currentStep ? 'var(--accent)' : 'var(--border)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )

  const renderLanguageStep = () => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌐</div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
        Welcome / 欢迎
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '32px' }}>
        Choose your language / 选择你的语言
      </p>
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <button
          onClick={() => setLanguage('zh')}
          style={{
            padding: '20px 40px', borderRadius: '12px', cursor: 'pointer',
            border: `2px solid ${language === 'zh' ? '#f97316' : '#333'}`,
            background: language === 'zh' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🇨🇳</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: language === 'zh' ? '#f97316' : 'var(--text)' }}>中文</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>简体中文</div>
        </button>
        <button
          onClick={() => setLanguage('en')}
          style={{
            padding: '20px 40px', borderRadius: '12px', cursor: 'pointer',
            border: `2px solid ${language === 'en' ? '#f97316' : '#333'}`,
            background: language === 'en' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>🇺🇸</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: language === 'en' ? '#f97316' : 'var(--text)' }}>English</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>US English</div>
        </button>
      </div>
    </div>
  )

  const renderLLMStep = () => {
    const providers = [
      { id: 'openai', name: 'OpenAI', icon: '🔵' },
      { id: 'deepseek', name: 'DeepSeek', icon: '🔴' },
      { id: 'anthropic', name: 'Anthropic', icon: '🟣' },
      { id: 'openrouter', name: 'OpenRouter', icon: '🟢' },
    ]

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
            {language === 'zh' ? '配置 AI 模型' : 'Configure AI Model'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
            {language === 'zh' ? '选择一个提供商并输入 API Key' : 'Choose a provider and enter API Key'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
          {providers.map(p => (
            <button
              key={p.id}
              onClick={() => setProviderName(p.id)}
              style={{
                padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                border: `2px solid ${providerName === p.id ? '#f97316' : '#333'}`,
                background: providerName === p.id ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)',
                transition: 'all 0.2s', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '20px' }}>{p.icon}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', marginTop: '4px' }}>{p.name}</div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #444', background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
            {language === 'zh' ? '模型' : 'Model'}
          </label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="gpt-4o"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #444', background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
    )
  }

  const renderThemeStep = () => (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
          {language === 'zh' ? '选择主题' : 'Choose Theme'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          {language === 'zh' ? '选择一个你喜欢的外观' : 'Pick a look that suits you'}
        </p>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px',
      }}>
        {Object.entries(themeColors).map(([name, colors]) => (
          <button
            key={name}
            onClick={() => applyTheme(name)}
            style={{
              padding: '12px', borderRadius: '10px', cursor: 'pointer',
              border: `2px solid ${selectedTheme === name ? '#f97316' : 'transparent'}`,
              background: selectedTheme === name ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255,255,255,0.04)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '6px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: colors[0], border: '1px solid rgba(255,255,255,0.1)' }} />
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: colors[1], border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text)', fontWeight: 500 }}>{name}</div>
          </button>
        ))}
      </div>
    </div>
  )

  const renderFinishStep = () => (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚀</div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
        {language === 'zh' ? '一切就绪！' : 'All Set!'}
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '300px', margin: '0 auto', lineHeight: 1.6 }}>
        {language === 'zh'
          ? '你已配置好 Friday，现在可以开始使用了！试试发送一条消息，或者探索左侧的各个功能面板。'
          : 'Friday is ready to go! Try sending a message or explore the feature panels on the left.'}
      </p>
      <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center', fontSize: '24px' }}>
        <span>💬</span>
        <span>🎤</span>
        <span>🧠</span>
        <span>🎨</span>
      </div>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-deep)',
    }}>
      <div style={{
        width: '480px', padding: '40px',
        background: 'var(--bg1)', borderRadius: '20px',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {renderStepIndicator()}

        {step === 'language' && renderLanguageStep()}
        {step === 'llm' && renderLLMStep()}
        {step === 'theme' && renderThemeStep()}
        {step === 'finish' && renderFinishStep()}

        <div style={{
          display: 'flex', justifyContent: step === 'finish' ? 'center' : 'space-between',
          marginTop: '32px',
        }}>
          {step !== 'language' && step !== 'finish' && (
            <button
              onClick={handleBack}
              style={{
                padding: '10px 24px', borderRadius: '8px', cursor: 'pointer',
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text)', fontSize: '13px', fontWeight: 500,
              }}
            >
              {language === 'zh' ? '上一步' : 'Back'}
            </button>
          )}
          {step === 'language' && <div />}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            style={{
              padding: '10px 24px', borderRadius: '8px', cursor: canProceed() ? 'pointer' : 'not-allowed',
              border: 'none', background: canProceed() ? 'var(--accent)' : 'var(--border)',
              color: canProceed() ? '#fff' : 'var(--text-dim)',
              fontSize: '13px', fontWeight: 600, opacity: canProceed() ? 1 : 0.5,
              marginLeft: 'auto',
            } as React.CSSProperties}
          >
            {step === 'finish'
              ? (language === 'zh' ? '开始使用' : 'Get Started')
              : (language === 'zh' ? '下一步 →' : 'Next →')}
          </button>
        </div>
      </div>
    </div>
  )
}
