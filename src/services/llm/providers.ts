import { ProviderConfig } from './types'

// 所有提供商配置
export const PROVIDERS: ProviderConfig[] = [
  // 国际提供商
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    description: 'GPT-4o, GPT-4-turbo, GPT-3.5-turbo',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', maxTokens: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', maxTokens: 128000 },
      { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 16385 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.openai.com/v1' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🟠',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', maxTokens: 200000 },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxTokens: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', maxTokens: 200000 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.anthropic.com' },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    icon: '🔵',
    description: 'Gemini 1.5 Pro, Gemini 1.5 Flash',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', maxTokens: 2000000 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', maxTokens: 1000000 },
      { id: 'gemini-pro', name: 'Gemini Pro', maxTokens: 32760 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'AIza...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://generativelanguage.googleapis.com' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    icon: '🦙',
    description: '本地部署的开源模型',
    apiKeyRequired: false,
    defaultModels: [
      { id: 'llama3', name: 'Llama 3', maxTokens: 8192 },
      { id: 'llama3:70b', name: 'Llama 3 70B', maxTokens: 8192 },
      { id: 'mistral', name: 'Mistral', maxTokens: 8192 },
      { id: 'codellama', name: 'Code Llama', maxTokens: 16384 },
      { id: 'qwen2', name: 'Qwen 2', maxTokens: 32768 },
    ],
    settings: [
      { key: 'baseUrl', label: 'Ollama 地址', type: 'url', placeholder: 'http://localhost:11434', defaultValue: 'http://localhost:11434' },
    ],
  },
  // 国内提供商
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🐋',
    description: 'DeepSeek-V2, DeepSeek-Coder',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'deepseek-chat', name: 'DeepSeek-V2', maxTokens: 32768 },
      { id: 'deepseek-coder', name: 'DeepSeek-Coder', maxTokens: 32768 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.deepseek.com/v1' },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    icon: '⚡',
    description: '多种开源模型托管服务',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'Qwen/Qwen2-72B-Instruct', name: 'Qwen2 72B', maxTokens: 32768 },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4 9B', maxTokens: 8192 },
      { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', maxTokens: 8192 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.siliconflow.cn/v1' },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    icon: '🧠',
    description: 'GLM-4, ChatGLM 系列',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'glm-4', name: 'GLM-4', maxTokens: 128000 },
      { id: 'glm-4-flash', name: 'GLM-4-Flash', maxTokens: 128000 },
      { id: 'glm-4-long', name: 'GLM-4-Long', maxTokens: 1000000 },
      { id: 'glm-3-turbo', name: 'GLM-3-Turbo', maxTokens: 16384 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://open.bigmodel.cn/api/paas/v4' },
    ],
  },
  {
    id: 'moonshot',
    name: 'Kimi (月之暗面)',
    icon: '🌙',
    description: 'Kimi Chat, 长文本理解',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'moonshot-v1-128k', name: 'Kimi 128K', maxTokens: 128000 },
      { id: 'moonshot-v1-32k', name: 'Kimi 32K', maxTokens: 32768 },
      { id: 'moonshot-v1-8k', name: 'Kimi 8K', maxTokens: 8192 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.moonshot.cn/v1' },
    ],
  },
  {
    id: 'xiaomi',
    name: '小米AI',
    icon: '📱',
    description: 'MiLM 系列模型',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'milm-chat', name: 'MiLM-Chat', maxTokens: 8192 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.xiaomi.com/v1' },
    ],
  },
  {
    id: 'doubao',
    name: '豆包',
    icon: '🫘',
    description: '字节跳动火山引擎',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'doubao-pro-256k', name: '豆包 Pro 256K', maxTokens: 256000 },
      { id: 'doubao-pro-128k', name: '豆包 Pro 128K', maxTokens: 128000 },
      { id: 'doubao-lite-128k', name: '豆包 Lite 128K', maxTokens: 128000 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://ark.cn-beijing.volces.com/api/v3' },
      { key: 'modelId', label: '模型 ID', type: 'text', placeholder: 'ep-...', required: true },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: '✨',
    description: 'ABAB 系列模型',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'abab6.5s-chat', name: 'ABAB 6.5s', maxTokens: 32768 },
      { id: 'abab5.5-chat', name: 'ABAB 5.5', maxTokens: 8192 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'eyJ...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://api.minimax.chat/v1' },
    ],
  },
  {
    id: 'qwen',
    name: '通义千问',
    icon: '☁️',
    description: '阿里云百炼平台',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'qwen-max', name: 'Qwen-Max', maxTokens: 32768 },
      { id: 'qwen-plus', name: 'Qwen-Plus', maxTokens: 131072 },
      { id: 'qwen-turbo', name: 'Qwen-Turbo', maxTokens: 131072 },
      { id: 'qwen-long', name: 'Qwen-Long', maxTokens: 10000000 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    ],
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    icon: '🐧',
    description: '腾讯云混元大模型',
    apiKeyRequired: true,
    defaultModels: [
      { id: 'hunyuan-pro', name: '混元 Pro', maxTokens: 32768 },
      { id: 'hunyuan-standard', name: '混元 Standard', maxTokens: 8192 },
      { id: 'hunyuan-lite', name: '混元 Lite', maxTokens: 8192 },
    ],
    settings: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '...', required: true },
      { key: 'secretId', label: 'SecretId', type: 'password', placeholder: '...', required: true },
      { key: 'baseUrl', label: 'API 地址', type: 'url', placeholder: 'https://hunyuan.tencentcloudapi.com/v1' },
    ],
  },
]

// 获取提供商配置
export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id)
}

// 获取所有提供商
export function getAllProviders(): ProviderConfig[] {
  return PROVIDERS
}

// 获取提供商分组
export function getProviderGroups(): { international: ProviderConfig[]; domestic: ProviderConfig[] } {
  const international = PROVIDERS.filter(p => ['openai', 'anthropic', 'google', 'ollama'].includes(p.id))
  const domestic = PROVIDERS.filter(p => !['openai', 'anthropic', 'google', 'ollama'].includes(p.id))
  return { international, domestic }
}
