import { create } from 'zustand'

export type Language = 'zh' | 'en'

const translations = {
  zh: {
    // Settings
    SETTINGS: '设置',
    LLM: 'LLM',
    VOICE: '语音',
    TTS: '语音合成',
    APPEARANCE: '外观',
    GRAPH: '图谱',
    SYSTEM: '系统',
    ABOUT: '关于',
    
    // LLM Tab
    PROVIDER: '服务商',
    MODEL: '模型',
    API_KEY: 'API Key',
    TEMPERATURE: '温度',
    MAX_TOKENS: '最大令牌数',
    PRECISE: '精确',
    CREATIVE: '创意',
    SAVE_LLM: '保存 LLM',
    LLM_SAVED: 'LLM 设置已保存',
    
    // Voice Tab
    LANGUAGE: '语言',
    AUTO_SEND: '自动发送',
    AUTO_SEND_DESC: '语音结束后自动发送',
    DETECTION_THRESHOLD: '检测阈值',
    SENSITIVE: '灵敏',
    STRICT: '严格',
    SAVE_VOICE: '保存语音',
    VOICE_SAVED: '语音设置已保存',
    
    // TTS Tab
    TTS_PROVIDER: 'TTS 服务商',
    VOICE_SELECT: '音色',
    SAVE_TTS: '保存 TTS',
    TTS_SAVED: 'TTS 设置已保存',
    
    // Appearance Tab
    THEME: '主题',
    
    // Graph Tab
    MEMORY_GRAPH: '记忆图谱',
    SHOW_GRAPH: '显示记忆图谱',
    GRAPH_HINT: '需要刷新页面生效',
    
    // System Tab
    SYSTEM_LANGUAGE: '系统语言',
    CHINESE: '中文',
    ENGLISH: 'English',
    LANGUAGE_HINT: '切换界面语言',
    
    // About Tab
    PERSONAL_AI: '个人 AI 助手',
    
    // L1 Panel
    LAYER1: '第一层',
    THOUGHT_STREAM: '思考流',
    STATUS: '状态',
    ACTIVE: '活跃',
    MESSAGES: '消息',
    TOKENS: '令牌',
    
    // L2 Panel
    LAYER2: '第二层',
    BACKGROUND_TASKS: '后台任务',
    HEARTBEAT: '心跳',
    MEMORY: '记忆',
    QUEUE: '队列',
    
    // Console
    INPUT_PLACEHOLDER: '输入消息...',
    SEND: '发送',
    
    DISCONNECTED: '未连接',
    WAITING_KERNEL_EVENTS: '等待 Kernel 事件...',

    // Stream types
    USER_MESSAGE: '用户消息',
    TOOL_CALL: '工具调用',
    ASSISTANT: '助手',
    SYSTEM_MSG: '系统',
  },
  en: {
    // Settings
    SETTINGS: 'SETTINGS',
    LLM: 'LLM',
    VOICE: 'Voice',
    TTS: 'TTS',
    APPEARANCE: 'Appearance',
    GRAPH: 'Graph',
    SYSTEM: 'System',
    ABOUT: 'About',
    
    // LLM Tab
    PROVIDER: 'Provider',
    MODEL: 'Model',
    API_KEY: 'API Key',
    TEMPERATURE: 'Temperature',
    MAX_TOKENS: 'Max Tokens',
    PRECISE: 'Precise',
    CREATIVE: 'Creative',
    SAVE_LLM: 'Save LLM',
    LLM_SAVED: 'LLM settings saved',
    
    // Voice Tab
    LANGUAGE: 'Language',
    AUTO_SEND: 'Auto Send',
    AUTO_SEND_DESC: 'Auto send after voice ends',
    DETECTION_THRESHOLD: 'Detection Threshold',
    SENSITIVE: 'Sensitive',
    STRICT: 'Strict',
    SAVE_VOICE: 'Save Voice',
    VOICE_SAVED: 'Voice settings saved',
    
    // TTS Tab
    TTS_PROVIDER: 'TTS Provider',
    VOICE_SELECT: 'Voice',
    SAVE_TTS: 'Save TTS',
    TTS_SAVED: 'TTS settings saved',
    
    // Appearance Tab
    THEME: 'Theme',
    
    // Graph Tab
    MEMORY_GRAPH: 'Memory Graph',
    SHOW_GRAPH: 'Show Memory Graph',
    GRAPH_HINT: 'Requires page reload',
    
    // System Tab
    SYSTEM_LANGUAGE: 'System Language',
    CHINESE: '中文',
    ENGLISH: 'English',
    LANGUAGE_HINT: 'Switch interface language',
    
    // About Tab
    PERSONAL_AI: 'Personal AI Assistant',
    
    // L1 Panel
    LAYER1: 'LAYER 1',
    THOUGHT_STREAM: 'Thought Stream',
    STATUS: 'Status',
    ACTIVE: 'Active',
    MESSAGES: 'Messages',
    TOKENS: 'Tokens',
    
    // L2 Panel
    LAYER2: 'LAYER 2',
    BACKGROUND_TASKS: 'Background Tasks',
    HEARTBEAT: 'Heartbeat',
    MEMORY: 'Memory',
    QUEUE: 'Queue',
    
    // Console
    INPUT_PLACEHOLDER: 'Type a message...',
    SEND: 'SEND',
    
    DISCONNECTED: 'Disconnected',
    WAITING_KERNEL_EVENTS: 'Waiting for Kernel events...',

    // Stream types
    USER_MESSAGE: 'USER MESSAGE',
    TOOL_CALL: 'TOOL CALL',
    ASSISTANT: 'ASSISTANT',
    SYSTEM_MSG: 'SYSTEM',
  }
}

interface LanguageState {
  language: Language
  t: (key: keyof typeof translations.zh) => string
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: (localStorage.getItem('friday-language') as Language) || 'zh',
  
  t: (key) => {
    const lang = get().language
    return translations[lang][key] || translations['en'][key] || key
  },
  
  setLanguage: (lang) => {
    localStorage.setItem('friday-language', lang)
    set({ language: lang })
  }
}))
