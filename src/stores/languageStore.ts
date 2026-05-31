import { create } from 'zustand'

export type Language = 'zh' | 'en'

const STORAGE_KEY = 'friday-language'

function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'zh' || stored === 'en') return stored
  } catch {}
  return 'zh'
}

const translations = {
  zh: {
    SETTINGS: '设置',
    LLM: 'LLM',
    VOICE: '语音',
    TTS: '语音合成',
    APPEARANCE: '外观',
    GRAPH: '图谱',
    SYSTEM: '系统',
    ABOUT: '关于',
    
    PROVIDER: '服务商',
    MODEL: '模型',
    API_KEY: 'API Key',
    TEMPERATURE: '温度',
    MAX_TOKENS: '最大令牌数',
    PRECISE: '精确',
    CREATIVE: '创意',
    SAVE_LLM: '保存 LLM',
    LLM_SAVED: 'LLM 设置已保存',
    
    LANGUAGE: '语言',
    AUTO_SEND: '自动发送',
    AUTO_SEND_DESC: '语音结束后自动发送',
    DETECTION_THRESHOLD: '检测阈值',
    SENSITIVE: '灵敏',
    STRICT: '严格',
    SAVE_VOICE: '保存语音',
    VOICE_SAVED: '语音设置已保存',
    
    TTS_PROVIDER: 'TTS 服务商',
    VOICE_SELECT: '音色',
    SAVE_TTS: '保存 TTS',
    TTS_SAVED: 'TTS 设置已保存',
    
    THEME: '主题',
    
    MEMORY_GRAPH: '视觉效果',
    GRAPH_MODE: '记忆图谱',
    CLOUD_MODE: '点云云图',
    DISPLAY_MODE: '显示模式',
    HIDE_DISPLAY: '隐藏',
    
    SYSTEM_LANGUAGE: '系统语言',
    CHINESE: '中文',
    ENGLISH: 'English',
    LANGUAGE_HINT: '切换界面语言',
    
    PERSONAL_AI: '个人 AI 助手',
    
    LAYER1: '第一层',
    THOUGHT_STREAM: '思考流',
    STATUS: '状态',
    ACTIVE: '活跃',
    MESSAGES: '消息',
    TOKENS: '令牌',
    
    LAYER2: '第二层',
    BACKGROUND_TASKS: '后台任务',
    HEARTBEAT: '心跳',
    MEMORY: '记忆',
    QUEUE: '队列',
    
    INPUT_PLACEHOLDER: '输入消息...',
    SEND: '发送',
    
    DISCONNECTED: '未连接',
    WAITING_EVENTS: '等待后台事件...',

    USER_MESSAGE: '用户消息',
    TOOL_CALL: '工具调用',
    ASSISTANT: '助手',
    SYSTEM_MSG: '系统',

    CONVERSATIONS: '对话',
    NEW_CONVERSATION: '新建对话',
    DELETE: '删除',
    RETRY: '重试',

    SANDBOX: '安全沙箱',
    SANDBOX_DESC: '启用后，文件操作和命令执行将受到安全限制',

    THEME_MIDNIGHT: '午夜星云',
    THEME_PHOSPHOR: '荧光绿',
    THEME_VIOLET: '紫色星云',
    THEME_ROSE: '玫瑰暖色',
    THEME_ARCTIC: '极地白色',
    THEME_SAND: '沙漠暖黄',
    THEME_CYBERPUNK: '赛博朋克',
    THEME_STARDUST: '星空',
    THEME_MATCHA: '抹茶绿',
    THEME_SAKURA: '樱花粉',
    THEME_AURORA: '极光',
    THEME_DEEPSEA: '深海蓝',

    CHECK_UPDATE: '检查更新',
    CHECKING: '检查中...',
    NEW_VERSION: '发现新版本',
    LATEST_VERSION: '已是最新版本',
    DOWNLOADING: '下载中',
    DOWNLOADED: '已下载',
    CLICK_INSTALL: '点击安装',
    UPDATE_FAILED: '更新失败',
    INSTALL_UPDATE: '安装更新',
    SAVE_SETTINGS: '保存设置',

    YOUR_AI_PROVIDER: '你的 AI 提供商 API Key',
    SELECT_AI_PROVIDER: '选择你的 AI 提供商',
    SELECT_MODEL: '选择使用的模型',
    SAMPLING_TEMP: '采样温度 (0-2)',
    MAX_OUTPUT_TOKENS: '最大输出 Token 数',
    SELECT_THEME_MODE: '选择主题模式',
    SHOW_MEMORY_GRAPH: '显示记忆图谱',
    VOICE_RECOGNITION_LANG: '语音识别和合成的语言',
    VOICE_AUTO_SEND: '语音识别后自动发送消息',
    VOICE_SYNTHESIS_PROVIDER: '语音合成提供商',
    VOICE_SYNTHESIS_VOICE: '语音合成音色',
    SYSTEM_NATIVE: '系统原生',

    EXPAND_CHAT: '展开聊天',
    COLLAPSE_CHAT: '收起聊天',
    LOADING_MORE: '加载更多消息...',
    EDIT_MESSAGE: '编辑消息',
    SAVE_RESEND: '保存并重发',
    CANCEL: '取消',
    VOICE_LOADING: '语音加载中',
    VOICE_UNAVAILABLE: '语音不可用',
    VOICE_READY: '语音就绪',
    STOP_RECORDING: '停止录音',
    VOICE_INPUT: '语音输入',
    RECORDING: '正在录音...',
    RECOGNIZING: '识别中...',
    DRAG_DROP: '拖放文件到此处上传',
    REMOVE: '移除',
    CONFIGURE_LLM: '请先配置 LLM API',

    SCROLL_BOTTOM: '滚动到底部',
  },
  en: {
    SETTINGS: 'SETTINGS',
    LLM: 'LLM',
    VOICE: 'Voice',
    TTS: 'TTS',
    APPEARANCE: 'Appearance',
    GRAPH: 'Graph',
    SYSTEM: 'System',
    ABOUT: 'About',
    
    PROVIDER: 'Provider',
    MODEL: 'Model',
    API_KEY: 'API Key',
    TEMPERATURE: 'Temperature',
    MAX_TOKENS: 'Max Tokens',
    PRECISE: 'Precise',
    CREATIVE: 'Creative',
    SAVE_LLM: 'Save LLM',
    LLM_SAVED: 'LLM settings saved',
    
    LANGUAGE: 'Language',
    AUTO_SEND: 'Auto Send',
    AUTO_SEND_DESC: 'Auto send after voice ends',
    DETECTION_THRESHOLD: 'Detection Threshold',
    SENSITIVE: 'Sensitive',
    STRICT: 'Strict',
    SAVE_VOICE: 'Save Voice',
    VOICE_SAVED: 'Voice settings saved',
    
    TTS_PROVIDER: 'TTS Provider',
    VOICE_SELECT: 'Voice',
    SAVE_TTS: 'Save TTS',
    TTS_SAVED: 'TTS settings saved',
    
    THEME: 'Theme',
    
    MEMORY_GRAPH: 'Visual Effect',
    GRAPH_MODE: 'Memory Graph',
    CLOUD_MODE: 'Point Cloud',
    DISPLAY_MODE: 'Display Mode',
    HIDE_DISPLAY: 'Hide',
    
    SYSTEM_LANGUAGE: 'System Language',
    CHINESE: '中文',
    ENGLISH: 'English',
    LANGUAGE_HINT: 'Switch interface language',
    
    PERSONAL_AI: 'Personal AI Assistant',
    
    LAYER1: 'LAYER 1',
    THOUGHT_STREAM: 'Thought Stream',
    STATUS: 'Status',
    ACTIVE: 'Active',
    MESSAGES: 'Messages',
    TOKENS: 'Tokens',
    
    LAYER2: 'LAYER 2',
    BACKGROUND_TASKS: 'Background Tasks',
    HEARTBEAT: 'Heartbeat',
    MEMORY: 'Memory',
    QUEUE: 'Queue',
    
    INPUT_PLACEHOLDER: 'Type a message...',
    SEND: 'SEND',
    
    DISCONNECTED: 'Disconnected',
    WAITING_EVENTS: 'Waiting for backend events...',

    USER_MESSAGE: 'USER MESSAGE',
    TOOL_CALL: 'TOOL CALL',
    ASSISTANT: 'ASSISTANT',
    SYSTEM_MSG: 'SYSTEM',

    CONVERSATIONS: 'Conversations',
    NEW_CONVERSATION: 'New Chat',
    DELETE: 'Delete',
    RETRY: 'Retry',

    SANDBOX: 'Security Sandbox',
    SANDBOX_DESC: 'When enabled, file operations and command execution will be subject to security restrictions',

    THEME_MIDNIGHT: 'Midnight Nebula',
    THEME_PHOSPHOR: 'Phosphor Green',
    THEME_VIOLET: 'Purple Nebula',
    THEME_ROSE: 'Rose Warm',
    THEME_ARCTIC: 'Arctic White',
    THEME_SAND: 'Desert Sand',
    THEME_CYBERPUNK: 'Cyberpunk',
    THEME_STARDUST: 'Stardust',
    THEME_MATCHA: 'Matcha Green',
    THEME_SAKURA: 'Sakura Pink',
    THEME_AURORA: 'Aurora',
    THEME_DEEPSEA: 'Deepsea Blue',

    CHECK_UPDATE: 'Check for Updates',
    CHECKING: 'Checking...',
    NEW_VERSION: 'New version available',
    LATEST_VERSION: 'Already up to date',
    DOWNLOADING: 'Downloading',
    DOWNLOADED: 'Downloaded',
    CLICK_INSTALL: 'Click to install',
    UPDATE_FAILED: 'Update failed',
    INSTALL_UPDATE: 'Install Update',
    SAVE_SETTINGS: 'Save Settings',

    YOUR_AI_PROVIDER: 'Your AI Provider API Key',
    SELECT_AI_PROVIDER: 'Select your AI Provider',
    SELECT_MODEL: 'Select model to use',
    SAMPLING_TEMP: 'Sampling Temperature (0-2)',
    MAX_OUTPUT_TOKENS: 'Max Output Tokens',
    SELECT_THEME_MODE: 'Select Theme Mode',
    SHOW_MEMORY_GRAPH: 'Show Memory Graph',
    VOICE_RECOGNITION_LANG: 'Voice Recognition & Synthesis Language',
    VOICE_AUTO_SEND: 'Auto Send After Voice Recognition',
    VOICE_SYNTHESIS_PROVIDER: 'Voice Synthesis Provider',
    VOICE_SYNTHESIS_VOICE: 'Voice Synthesis Voice',
    SYSTEM_NATIVE: 'System Native',

    EXPAND_CHAT: 'Expand Chat',
    COLLAPSE_CHAT: 'Collapse Chat',
    LOADING_MORE: 'Loading more messages...',
    EDIT_MESSAGE: 'Edit Message',
    SAVE_RESEND: 'Save & Resend',
    CANCEL: 'Cancel',
    VOICE_LOADING: 'Voice Loading',
    VOICE_UNAVAILABLE: 'Voice Unavailable',
    VOICE_READY: 'Voice Ready',
    STOP_RECORDING: 'Stop Recording',
    VOICE_INPUT: 'Voice Input',
    RECORDING: 'Recording...',
    RECOGNIZING: 'Recognizing...',
    DRAG_DROP: 'Drag and drop files here',
    REMOVE: 'Remove',
    CONFIGURE_LLM: 'Please configure LLM API first',

    SCROLL_BOTTOM: 'Scroll to Bottom',
  }
}

type TranslationKey = keyof typeof translations.zh

interface LanguageState {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: getStoredLanguage(),
  
  setLanguage: (lang) => {
    localStorage.setItem(STORAGE_KEY, lang)
    set({ language: lang })
  }
}))

// 翻译函数 - 独立于 store
export function t(key: TranslationKey, lang: Language): string {
  return translations[lang][key] || translations['en'][key] || key
}

// 响应式翻译 hook
export function useTranslation() {
  const language = useLanguageStore((state) => state.language)
  return {
    language,
    t: (key: TranslationKey) => t(key, language),
    setLanguage: useLanguageStore((state) => state.setLanguage)
  }
}
