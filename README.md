# Friday

**个人 AI 伴侣操作系统** — 一个跑在桌面上的全能 AI 助手，集对话、记忆、感知、调度、语音于一体。

## 它是什么

Friday 不只是一个聊天窗口。它是一个完整的 **AI Agent 平台**：

- **前端**（Electron + React）提供精致的桌面交互界面
- **内核**（Python / Nuwa OS）提供 76 个技能、多 Agent 编排、情感识别、语音对话、定时调度等能力
- 两层通过 WebSocket 实时双向通信

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

### Friday Kernel（Python 内核）

名为 **Nuwa OS** 的 Python 后端引擎，提供：

- **多 Agent 编排** — 链式/并行执行，红队审计
- **76 个技能** — 翻译、搜索、图像生成、漫画、PPT、PDF、Excel/Word、微信/微博发布、天气等
- **情感识别** — 实时分析对话情绪
- **语音系统** — 本地 Sherpa-ONNX SenseVoice + 云端 ASR 备选，流式 TTS
- **自动化调度** — Cron 定时任务、触发器、工作流引擎
- **永续记忆** — GFCR 四步模式提取 + 语义索引
- **自愈机制** — 自动检测和修复异常

### 国际化

- 中文 / English 界面切换
- 语言感知的 System Prompt（自动匹配回复语言）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 30 |
| 前端 | React 18 + TypeScript + Vite 5 |
| 样式 | Tailwind CSS 4 + 白龙马主题系统 |
| 状态管理 | Zustand |
| 知识图谱 | D3.js 力导向布局 |
| 本地数据库 | better-sqlite3 |
| 自动更新 | electron-updater (GitHub Releases) |
| 内核 | Python 3.10+ (Nuwa OS v1.0.0) |
| 语音 | Sherpa-ONNX + Edge TTS |
| Web 桥接 | Flask + SocketIO |

## 安装

### 环境要求

- Node.js 18+
- Python 3.10+（Kernel 需要）
- Windows 10/11

### 开发模式

```bash
# 克隆
git clone https://github.com/your-username/my-agent-platform.git
cd my-agent-platform

# 安装依赖
npm install

# 启动（自动拉起 Vite + Electron + Python Kernel）
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

1. 启动后点击右下角 ⚙ 按钮
2. **LLM 标签** — 选择提供商（如 DeepSeek），填入 API Key，选择模型，保存
3. **System 标签** — 切换中/英文界面
4. **TTS 标签** — 配置语音（支持 OpenAI TTS / Edge TTS / MiniMax）

## 项目结构

```
my-agent-platform/
├── src/                          # React 前端
│   ├── stores/                   # Zustand 状态管理
│   │   ├── chatStore.ts          # 对话状态 + LLM 调用
│   │   ├── kernelStore.ts        # Kernel 连接状态
│   │   ├── settingsStore.ts      # 设置持久化
│   │   ├── agentStore.ts         # Agent 编排
│   │   ├── schedulerStore.ts     # 定时调度
│   │   └── emotionStore.ts       # 情感识别
│   ├── services/
│   │   └── llm/
│   │       ├── providers.ts      # 13 个提供商配置
│   │       ├── clients.ts        # 各提供商 API 客户端
│   │       ├── openrouter.ts     # OpenRouter 备用客户端
│   │       ├── manager.ts        # LLM 管理器
│   │       └── types.ts          # 类型定义
│   └── ui/components/
│       ├── CenterArea/           # 聊天 + 图谱
│       ├── MemoryGraph/          # D3 知识图谱
│       ├── KernelStatus/         # Kernel 状态监控
│       ├── AgentPanel/           # Agent 控制面板
│       ├── Settings/             # 设置面板
│       └── ThemeSwitcher/        # 主题 + LLM 配置
├── electron/                     # Electron 主进程
│   ├── main.ts                   # 主入口 + IPC Handler
│   ├── preload.ts                # 预加载桥接
│   ├── kernel-manager.ts         # Python Kernel 进程管理
│   └── kernel-bridge.ts          # WebSocket 桥接
├── Friday_Kernel/                # Python 后端内核
│   ├── kernel.json               # Nuwa OS 配置
│   ├── modules/
│   │   ├── entry/                # 入口点 (nuwa.py, cli.py)
│   │   ├── services/             # 33 个服务模块
│   │   │   ├── agent_orchestrator.py
│   │   │   ├── emotion_service.py
│   │   │   ├── voice_service.py
│   │   │   ├── scheduler_service.py
│   │   │   ├── trigger_service.py
│   │   │   ├── workflow_engine.py
│   │   │   ├── friday_memory.py
│   │   │   ├── self_heal.py
│   │   │   └── ...
│   │   ├── legacy/               # 遗留模块
│   │   └── core/                 # 事件总线
│   ├── skills/                   # 76 个技能
│   │   ├── translate/
│   │   ├── image-gen/
│   │   ├── deep-research-pro/
│   │   ├── baoyu-post-wechat/
│   │   ├── weather/
│   │   └── ...（76 个）
│   ├── memory/                   # 永续记忆
│   ├── knowledge/                # 知识库
│   ├── web/                      # Flask Web UI
│   └── scripts/                  # 工具脚本
├── public/                       # 静态资源
├── package.json
├── electron-builder.json5        # 打包配置
└── vite.config.ts                # Vite 配置
```

## 内置技能一览

| 类别 | 技能 |
|------|------|
| 翻译 | baoyu-translate, translate |
| 搜索 | deep-research-pro, multi-search |
| 图像 | image-gen, image-cards, infographic, comic |
| 文档 | word, excel, powerpoint, pdf, markdown-to-html |
| 发布 | baoyu-post-wechat, baoyu-post-weibo, baoyu-post-x |
| 开发 | code-mentor, debug-pro, tdd, frontend-design |
| 知识 | deep-learning, academic-research, prompt-engineering |
| 工具 | weather, download, summarize-url, url-to-markdown |
| 语音 | edge-tts, tts-edge |
| 自我 | self-improvement, proactive-agent, agent-memory |

## License

MIT
