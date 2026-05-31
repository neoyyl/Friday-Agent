

# Friday

**个人 AI 伴侣操作系统** — 一个跑在桌面上的全能 AI 助手，集对话、记忆、感知、调度、语音于一体的纯 TypeScript 桌面应用。

## 它是什么

Friday 不只是一个聊天窗口。它是一个完整的 **AI Agent 平台**：

- **纯 TypeScript 架构** — 不再需要 Python 内核，全栈 TypeScript + Electron
- **内置多服务系统** — 21+ 个 TypeScript 服务提供完整的 AI Agent 能力
- **现代化 UI** — 白龙马主题系统，6 套精美主题

你跟它说话，它能理解你的情绪、调用工具、执行任务、记住上下文，并在合适的时候主动提醒你。

## 核心功能

### 多 LLM 直连

不依赖第三方中转，直连各厂商 API：

| 提供商 | 模型 | 接口 |
|--------|------|------|
| DeepSeek | V4 Pro / V4 Flash | `api.deepseek.com` |
| OpenAI | GPT-4o / GPT-4 Turbo | `api.openai.com` |
| Anthropic | Claude 3.5 Sonnet / Opus | `api.anthropic.com` |
| Google | Gemini 1.5 Pro / Flash | `generativelanguage.googleapis.com` |
| 通义千问 | Qwen-Max / Plus / Turbo | `dashscope.aliyuncs.com` |
| 智谱AI | GLM-4 / GLM-4-Flash | `open.bigmodel.cn` |
| Kimi | moonshot-v1-128k / 32k / 8k | `api.moonshot.cn` |
| Ollama | Llama 3 / Mistral / Qwen2 | 本地部署 |

还支持硅基流动、小米、豆包、MiniMax、腾讯混元等。切换提供商只需在设置里选一下。

### 白龙马 UI

三栏布局，灵感来自白龙马设计系统：

- **左侧 L1 面板** — 实时思维流，展示 Agent 的推理过程
- **右侧 L2 面板** — 后台任务监控
- **中心区域** — 聊天 + D3.js 知识图谱可视化
- **6 套主题** — 午夜星云、荧光绿、紫色星云、玫瑰暖色、极地白色、沙漠暖黄

### TypeScript 服务系统

纯 TypeScript 架构，21+ 个后端服务：

| 服务 | 功能 |
|------|------|
| AgentService | 多 Agent 编排与调度 |
| LLMService | 统一的 LLM 调用接口 |
| SkillService | 技能系统（内置 + 外部） |
| VoiceService | 语音识别与合成 |
| SchedulerService | Cron 定时任务调度 |
| WorkflowService | 工作流引擎 |
| TriggerService | 事件触发器 |
| MemoryService | 永续记忆系统 |
| EmotionService | 情感识别 |
| PersonalityService | 人格与性格管理 |
| GPUService | GPU 监控（支持多 GPU） |
| HealthService | 系统健康检查 |
| SelfHealService | 自愈机制 |
| ExecutionLogService | 执行日志 |
| DispatchLogService | 调度日志 |
| PerceptionService | 环境感知 |
| ObsidianService | Obsidian 知识库集成 |
| ConfigService | 配置管理 |
| TimingService | 计时服务 |
| EventBus | 事件总线 |

### 内置技能

| 类别 | 技能 |
|------|------|
| 搜索 | web-search |
| 文件 | file-tools |
| 代码 | code-executor, shell-tools |
| 文本 | text-processor |

### 语音系统

- **ASR** — 平台原生语音识别 + 可选云端
- **TTS** — 平台原生合成 + OpenAI TTS + Edge TTS + MiniMax
- **Speaker ID** — 支持声纹识别

### 知识图谱

D3.js 力导向布局，实时展示记忆关系，可开关显示。

### 国际化

- 中文 / English 界面切换
- 语言感知的 System Prompt（自动匹配回复语言）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 30 |
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| 样式 | Tailwind CSS 4 + 白龙马主题系统 |
| 状态管理 | Zustand 5 |
| 知识图谱 | D3.js |
| 虚拟滚动 | react-virtuoso |
| 本地数据库 | better-sqlite3 |
| Markdown 渲染 | react-markdown + GFM + 代码高亮 |
| 自动更新 | electron-updater |
| 定时任务 | node-cron |
| 测试 | Vitest + Testing Library |

## 安装

### 环境要求

- Node.js 18+
- Windows 10/11

### 开发模式

```bash
# 克隆
git clone https://github.com/your-username/my-agent-platform.git
cd my-agent-platform

# 安装依赖
npm install

# 启动（Vite + Electron）
npm run dev
```

### 打包

```bash
# 打包 Windows 安装包
npm run build:win

# 产物位置
# release/0.1.0/Friday Agent-Windows-0.1.0-Setup.exe
```

## 配置

1. 启动后点击右上角 ⚙ 按钮
2. **LLM 标签** — 选择提供商（如 DeepSeek），填入 API Key，选择模型，保存
3. **System 标签** — 切换中/英文界面，开启/关闭安全沙箱
4. **TTS 标签** — 配置语音（支持 OpenAI TTS / Edge TTS / MiniMax）
5. **Voice 标签** — 配置语音识别

## 项目结构

```
my-agent-platform/
├── src/                          # React 前端
│   ├── stores/                   # Zustand 状态管理
│   │   ├── chatStore.ts          # 对话状态 + LLM 调用
│   │   ├── settingsStore.ts      # 设置持久化（SQLite）
│   │   ├── sessionStore.ts       # 会话管理
│   │   ├── agentStore.ts         # Agent 状态
│   │   ├── emotionStore.ts       # 情感状态
│   │   ├── languageStore.ts      # 国际化
│   │   └── themeStore.ts         # 主题系统
│   ├── services/
│   │   ├── llm/                  # LLM 调用
│   │   │   ├── providers.ts      # 13 个提供商配置
│   │   │   ├── clients.ts        # 各提供商 API 客户端
│   │   │   ├── manager.ts        # LLM 管理器
│   │   │   └── types.ts          # 类型定义
│   │   ├── voice/                # 语音服务
│   │   ├── tools/                # 工具执行
│   │   └── database/             # 数据库访问
│   ├── ui/components/
│   │   ├── Layout/               # 三栏布局
│   │   ├── CenterArea/           # 聊天 + 图谱
│   │   ├── SidePanel/            # 侧边栏（会话、Agent）
│   │   ├── MemoryGraph/          # D3 知识图谱
│   │   ├── AgentPanel/           # Agent 控制面板
│   │   ├── SkillMarket/          # 技能市场
│   │   ├── SchedulerPanel/       # 定时任务
│   │   ├── SelfHealPanel/        # 自愈面板
│   │   ├── SpeakerManager/       # 语音管理
│   │   ├── MemoryBrowser/        # 记忆浏览
│   │   ├── ExecutionLog/         # 执行日志
│   │   ├── PerceptionPanel/      # 感知面板
│   │   ├── GPUMonitor/           # GPU 监控
│   │   ├── ObsidianPanel/        # Obsidian 集成
│   │   └── ThemeSwitcher/        # 现代化设置面板
│   └── contexts/                 # React Context
├── electron/                     # Electron 主进程
│   ├── main.ts                   # 主入口 + IPC Handler 注册
│   ├── preload.ts                # 预加载桥接（electronAPI）
│   ├── services/                 # TypeScript 服务
│   │   ├── ServiceRegistry.ts    # 服务注册中心
│   │   ├── AgentService.ts       # Agent 服务
│   │   ├── SkillService.ts       # 技能服务
│   │   ├── VoiceService.ts       # 语音服务
│   │   ├── SchedulerService.ts   # 调度服务
│   │   ├── WorkflowService.ts    # 工作流服务
│   │   ├── TriggerService.ts     # 触发器服务
│   │   ├── MemoryService.ts      # 记忆服务
│   │   ├── EmotionService.ts     # 情感服务
│   │   ├── GPUService.ts         # GPU 服务
│   │   ├── HealthService.ts      # 健康服务
│   │   ├── SelfHealService.ts    # 自愈服务
│   │   └── ...（共 21+ 个服务）
│   └── handlers/                 # IPC 处理器
│       ├── llm.ts                # LLM 调用（含工具执行）
│       ├── settings.ts           # 设置读写
│       ├── sessions.ts           # 会话管理
│       ├── messages.ts           # 消息处理
│       ├── backend.ts            # 后端服务桥接
│       ├── update.ts             # 自动更新
│       └── tools.ts              # 工具执行
├── skills/                       # 外部技能目录
│   └── skill.template.json       # 技能模板
├── public/                       # 静态资源
│   └── models/                   # 3D Avatar 模型
├── docs/                         # 文档
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.json5        # 打包配置
└── vitest.config.ts              # 测试配置
```

## 架构升级记录

### v0.2.0 (当前) — 纯 TypeScript 架构

**核心变更：**
- ✅ 完全移除 Python Kernel
- ✅ 所有服务重写为 TypeScript
- ✅ 内核相关 IPC 重命名为 `backend:*`
- ✅ `KernelResponse` → `BackendResponse`
- ✅ `KernelError` → `BackendError`
- ✅ `KernelStatus` → `BackendStatus`
- ✅ SQLite 设置存储修复（值序列化）
- ✅ GPU 监控升级（多 GPU、健康度计算）
- ✅ VoiceService 升级（平台原生 TTS）
- ✅ SchedulerService 升级（真实 Cron 调度）
- ✅ WorkflowService 升级（真实工作流执行）
- ✅ EmotionService 升级（多维度情感分析）
- ✅ SelfHealService 升级（真实自动修复）
- ✅ TriggerService 升级（EventBus 订阅）

**迁移前：**
- Python Nuwa OS + 前端 WebSocket 通信

**迁移后：**
- 纯 TypeScript 全栈，Electron 主进程直接运行服务

## 开发指南

### 添加新服务

1. 在 `electron/services/` 创建新服务类，继承 `ServiceBase`
2. 在 `ServiceRegistry` 中注册
3. 在 `handlers/` 中创建对应的 IPC 处理器
4. 在 `preload.ts` 中暴露 `electronAPI`
5. 在 `src/types/electron-api.d.ts` 中添加类型定义

### 添加新技能

**内置技能：**
在 `src/services/tools/implementations/` 添加新工具实现，在 `index.ts` 中注册。

**外部技能：**
在 `skills/` 目录创建技能文件夹，遵循 `skill.template.json` 格式。

### 运行测试

```bash
npm test

# 监听模式
npm run test:watch
```

## License

MIT
