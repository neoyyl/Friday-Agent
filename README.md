# Friday

Personal AI Assistant with Bailongma UI

## Features

- **Multi-LLM Support**: OpenAI, Anthropic, DeepSeek, Qwen, Zhipu, Kimi, Ollama
- **Bailongma UI**: Three-column layout with L1/L2 thought streams
- **Memory Graph**: D3.js force-directed knowledge visualization
- **6 Themes**: Midnight, Phosphor, Violet, Rose, Arctic, Sand
- **i18n**: Chinese and English interface
- **Voice**: ASR + TTS support
- **Settings**: Full configuration panel

## Tech Stack

- Electron 30
- React 18
- TypeScript
- Vite 5
- D3.js
- Zustand
- better-sqlite3

## Installation

```bash
# Clone
git clone https://github.com/your-username/my-agent-platform.git
cd my-agent-platform

# Install
npm install

# Dev
npm run dev

# Build
npm run build
```

## Configuration

1. Open Settings (⚙ button)
2. Go to LLM tab
3. Select provider and enter API Key
4. Click Save

## Project Structure

```
src/
├── stores/          # Zustand state
├── contexts/        # React context
├── ui/components/
│   ├── L1Panel/     # Left panel - thought stream
│   ├── L2Panel/     # Right panel - background tasks
│   ├── CenterArea/  # Center - graph + chat
│   ├── MemoryGraph/ # D3 visualization
│   └── ThemeSwitcher/ # Settings panel
└── index.css        # Bailongma theme system
```

## License

MIT
