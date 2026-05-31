import { describe, it, expect, beforeEach } from 'vitest'
import { AgentService } from './AgentService'

describe('AgentService', () => {
  let service: AgentService

  beforeEach(() => {
    service = new AgentService()
  })

  describe('AGENT_PROMPTS', () => {
    it('should contain prompts for all modes', () => {
      expect((service as any).AGENT_PROMPTS).toBeDefined()
      expect((service as any).AGENT_PROMPTS.chat).toBeTruthy()
      expect((service as any).AGENT_PROMPTS.code).toBeTruthy()
      expect((service as any).AGENT_PROMPTS.research).toBeTruthy()
      expect((service as any).AGENT_PROMPTS.plan).toBeTruthy()
    })

    it('should contain Friday in chat prompt', () => {
      const chatPrompt = (service as any).AGENT_PROMPTS.chat
      expect(chatPrompt).toContain('Friday')
    })
  })

  describe('getSystemPromptForMode', () => {
    it('should return chat prompt for chat mode', () => {
      const prompt = (service as any).getSystemPromptForMode('chat')
      expect(prompt).toContain('Friday')
    })

    it('should return code prompt for code mode', () => {
      const prompt = (service as any).getSystemPromptForMode('code')
      expect(prompt).toContain('代码助手')
    })

    it('should return research prompt for research mode', () => {
      const prompt = (service as any).getSystemPromptForMode('research')
      expect(prompt).toContain('研究助手')
    })

    it('should return plan prompt for plan mode', () => {
      const prompt = (service as any).getSystemPromptForMode('plan')
      expect(prompt).toContain('任务规划')
    })

    it('should fallback to chat for unknown mode', () => {
      const prompt = (service as any).getSystemPromptForMode('unknown')
      expect(prompt).toContain('Friday')
    })
  })

  describe('classifyError', () => {
    it('should classify API key errors', () => {
      const error = new Error('API key is invalid')
      const type = (service as any).classifyError(error)
      expect(type).toBe('API_KEY_MISSING')
    })

    it('should classify timeout errors', () => {
      const error = new Error('Request timeout')
      const type = (service as any).classifyError(error)
      expect(type).toBe('TIMEOUT')
    })

    it('should classify network errors', () => {
      const error = new Error('Network connection failed')
      const type = (service as any).classifyError(error)
      expect(type).toBe('NETWORK')
    })

    it('should classify unknown errors', () => {
      const error = new Error('Some random error')
      const type = (service as any).classifyError(error)
      expect(type).toBe('UNKNOWN')
    })
  })

  describe('getErrorMessage', () => {
    it('should return API key message for API_KEY_MISSING', () => {
      const msg = (service as any).getErrorMessage('API_KEY_MISSING')
      expect(msg).toContain('API Key')
    })

    it('should return timeout message for TIMEOUT', () => {
      const msg = (service as any).getErrorMessage('TIMEOUT')
      expect(msg).toContain('超时')
    })

    it('should return network message for NETWORK', () => {
      const msg = (service as any).getErrorMessage('NETWORK')
      expect(msg).toContain('网络')
    })
  })

  describe('dispatch', () => {
    it('should throw when no agents available', async () => {
      await service.init()
      
      const agents = (service as any).agents
      for (const agent of agents) {
        agent.enabled = false
      }

      await expect(
        service.dispatch('test task', 'chat')
      ).rejects.toThrow('No available agents')
    })
  })
})
