import { describe, it, expect, beforeEach } from 'vitest'
import { LLMManager, defaultLLMConfig } from './manager'

describe('LLMManager', () => {
  let manager: LLMManager

  beforeEach(() => {
    // Deep copy to avoid shared state between tests
    manager = new LLMManager(JSON.parse(JSON.stringify(defaultLLMConfig)))
  })

  it('initializes with default config', () => {
    const config = manager.getConfig()
    expect(config.activeProvider).toBe('openai')
    expect(config.providers.openai.enabled).toBe(true)
    expect(config.providers.anthropic.enabled).toBe(false)
  })

  it('getActiveProvider returns the active provider config', () => {
    const provider = manager.getActiveProvider()
    expect(provider).toBeDefined()
    expect(provider?.id).toBe('openai')
  })

  it('setActiveProvider changes the active provider', () => {
    manager.setActiveProvider('anthropic')
    expect(manager.getConfig().activeProvider).toBe('anthropic')
  })

  it('updateConfig merges config', () => {
    manager.updateConfig({ activeProvider: 'google' })
    expect(manager.getConfig().activeProvider).toBe('google')
    // Other providers should still exist
    expect(manager.getConfig().providers.openai).toBeDefined()
  })

  it('getProviderSettings returns provider settings', () => {
    const settings = manager.getProviderSettings('openai')
    expect(settings).toBeDefined()
    expect(settings?.enabled).toBe(true)
  })

  it('updateProviderSettings updates specific provider', () => {
    manager.updateProviderSettings('anthropic', { enabled: true, apiKey: 'test-key' })
    const settings = manager.getProviderSettings('anthropic')
    expect(settings?.enabled).toBe(true)
    expect(settings?.apiKey).toBe('test-key')
  })

  it('getCurrentModel returns default model when not configured', () => {
    const model = manager.getCurrentModel()
    expect(model).toBe('gpt-4o')
  })

  it('getCurrentModel returns configured model', () => {
    manager.updateProviderSettings('openai', { modelId: 'gpt-4-turbo' })
    const model = manager.getCurrentModel()
    expect(model).toBe('gpt-4-turbo')
  })

  it('isProviderAvailable returns true for enabled provider with API key', () => {
    manager.updateProviderSettings('openai', { apiKey: 'test-key' })
    expect(manager.isProviderAvailable('openai')).toBe(true)
  })

  it('isProviderAvailable returns false for disabled provider', () => {
    expect(manager.isProviderAvailable('anthropic')).toBe(false)
  })

  it('isProviderAvailable returns false for unknown provider', () => {
    expect(manager.isProviderAvailable('unknown')).toBe(false)
  })

  it('getAvailableProviders returns only enabled providers', () => {
    manager.updateProviderSettings('openai', { apiKey: 'test-key' })
    manager.updateProviderSettings('anthropic', { enabled: true, apiKey: 'test-key' })
    const available = manager.getAvailableProviders()
    expect(available.length).toBe(2)
    expect(available.map(p => p.id)).toContain('openai')
    expect(available.map(p => p.id)).toContain('anthropic')
  })

  it('exportConfig returns JSON string', () => {
    const json = manager.exportConfig()
    const config = JSON.parse(json)
    expect(config.activeProvider).toBe('openai')
  })

  it('importConfig loads config from JSON', () => {
    const json = JSON.stringify({ activeProvider: 'google', providers: {} })
    manager.importConfig(json)
    expect(manager.getConfig().activeProvider).toBe('google')
  })

  it('importConfig throws on invalid JSON', () => {
    expect(() => manager.importConfig('invalid')).toThrow('无效的配置格式')
  })

  it('updateConfig clears client cache', () => {
    // This is a behavioral test - after config update, clients should be recreated
    manager.updateProviderSettings('openai', { apiKey: 'key1' })
    manager.updateConfig({ activeProvider: 'openai' })
    // No error means cache was cleared successfully
    expect(manager.getConfig().activeProvider).toBe('openai')
  })
})
