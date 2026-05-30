import { describe, it, expect, beforeEach } from 'vitest'
import { LLMManager, defaultLLMConfig } from './manager'

describe('LLMManager', () => {
  let manager: LLMManager

  beforeEach(() => {
    manager = new LLMManager({ ...defaultLLMConfig, providers: { ...defaultLLMConfig.providers } })
  })

  it('creates manager with default config', () => {
    expect(manager).toBeDefined()
    expect(manager.getConfig().activeProvider).toBe('openai')
  })

  it('getActiveProvider returns openai by default', () => {
    const provider = manager.getActiveProvider()
    expect(provider).toBeDefined()
    expect(provider!.id).toBe('openai')
  })

  it('getCurrentModel returns default model when no modelId set', () => {
    const model = manager.getCurrentModel()
    expect(model).toBeTruthy()
  })

  it('setActiveProvider changes active provider', () => {
    manager.setActiveProvider('deepseek')
    expect(manager.getActiveProvider()!.id).toBe('deepseek')
  })

  it('isProviderAvailable returns true for configured providers', () => {
    manager.updateProviderSettings('openai', { apiKey: 'sk-test' })
    expect(manager.isProviderAvailable('openai')).toBe(true)
    expect(manager.isProviderAvailable('anthropic')).toBe(false)
  })

  it('updateConfig merges partial config', () => {
    manager.updateConfig({ activeProvider: 'deepseek' })
    expect(manager.getConfig().activeProvider).toBe('deepseek')
  })

  it('getProviderSettings returns settings for provider', () => {
    const settings = manager.getProviderSettings('openai')
    expect(settings).toBeDefined()
    expect(settings!.enabled).toBe(true)
  })

  it('updateProviderSettings merges provider settings', () => {
    manager.updateProviderSettings('openai', { apiKey: 'test-key' })
    expect(manager.getProviderSettings('openai')!.apiKey).toBe('test-key')
  })

  it('getAvailableProviders returns only enabled+configured providers', () => {
    manager.updateProviderSettings('openai', { apiKey: 'sk-test' })
    const available = manager.getAvailableProviders()
    expect(available.length).toBe(1)
    expect(available[0].id).toBe('openai')
  })

  it('exportConfig returns JSON string', () => {
    const json = manager.exportConfig()
    const parsed = JSON.parse(json)
    expect(parsed.activeProvider).toBe('openai')
  })

  it('importConfig replaces config from JSON', () => {
    const newConfig = { activeProvider: 'deepseek', providers: { deepseek: { enabled: true }, openai: { enabled: false } } }
    manager.importConfig(JSON.stringify(newConfig))
    expect(manager.getConfig().activeProvider).toBe('deepseek')
  })

  it('chat with no enabled provider throws', async () => {
    const emptyManager = new LLMManager({ activeProvider: 'openai', providers: { openai: { enabled: false } } })
    await expect(emptyManager.chat([{ role: 'user', content: 'hi' }])).rejects.toThrow()
  })
})
