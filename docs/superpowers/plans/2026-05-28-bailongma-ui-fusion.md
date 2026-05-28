# Friday × 白龙马 UI 深度融合 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将白龙马的星云美学UI设计融入Friday，实现主题系统、毛玻璃效果、思考流面板、记忆图谱、ACUI卡片系统的全面融合。

**Architecture:** 以Friday现有React+TailwindCSS架构为基础，通过CSS变量实现7套主题切换，新增ThemingProvider管理主题状态，新增ThoughtStream/MemoryGraph/ACUI组件，保留现有CommandMenu/Settings/StatusBar交互。

**Tech Stack:** React 18, TypeScript, TailwindCSS 4, Zustand, D3.js, Electron 30

---

## 文件结构

```
src/
├── contexts/
│   └── ThemingProvider.tsx          # 主题上下文
├── services/
│   └── theme/
│       ├── themes.ts                # 7套主题定义
│       └── index.ts                 # 导出
├── ui/
│   └── components/
│       ├── ThoughtStream/
│       │   ├── ThoughtStream.tsx    # 思考流面板
│       │   └── ThoughtStreamItem.tsx # 单条记录
│       ├── MemoryGraph/
│       │   └── MemoryGraph.tsx      # D3记忆图谱
│       ├── ACUI/
│       │   ├── ACUICard.tsx         # 卡片容器
│       │   ├── WeatherCard.tsx      # 天气卡片
│       │   └── SelfCheckCard.tsx    # 自检卡片
│       └── Settings/
│           └── ThemeSelector.tsx    # 主题选择器
├── stores/
│   └── thoughtStreamStore.ts       # 思考流状态
└── index.css                       # 主题CSS变量 + 动画
```

---

## Task 1: 安装依赖 + 创建主题定义

**Files:**
- Modify: `package.json`
- Create: `src/services/theme/themes.ts`
- Create: `src/services/theme/index.ts`

- [ ] **Step 1: 安装D3依赖**

Run: `cd F:\Product\Agent\Friday\my-agent-platform && npm install d3 @types/d3`

- [ ] **Step 2: 创建主题定义文件**

Create `src/services/theme/themes.ts`:

```typescript
export interface Theme {
  id: string;
  name: string;
  colors: {
    bg0: string;
    bg1: string;
    bg2: string;
    cool: string;
    warm: string;
    glass: string;
    text: string;
    textSecondary: string;
    border: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      bg0: '#0a1118',
      bg1: '#0d1b2a',
      bg2: '#1b2838',
      cool: '#8fb6d8',
      warm: '#d39872',
      glass: 'rgba(13, 27, 42, 0.7)',
      text: '#e0e0e0',
      textSecondary: '#8a9aae',
      border: 'rgba(143, 182, 216, 0.15)',
    },
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    colors: {
      bg0: '#0a1a0a',
      bg1: '#0d2a0d',
      bg2: '#1b381b',
      cool: '#7cfc00',
      warm: '#32cd32',
      glass: 'rgba(13, 42, 13, 0.7)',
      text: '#d0f0d0',
      textSecondary: '#7a9a7a',
      border: 'rgba(124, 252, 0, 0.15)',
    },
  },
  {
    id: 'violet',
    name: 'Violet',
    colors: {
      bg0: '#1a0a2e',
      bg1: '#2a0d4a',
      bg2: '#381b58',
      cool: '#9b59b6',
      warm: '#e74c3c',
      glass: 'rgba(42, 13, 74, 0.7)',
      text: '#e0d0f0',
      textSecondary: '#9a7aae',
      border: 'rgba(155, 89, 182, 0.15)',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    colors: {
      bg0: '#1a0a1a',
      bg1: '#2a0d2a',
      bg2: '#381b38',
      cool: '#e91e63',
      warm: '#ff6b9d',
      glass: 'rgba(42, 13, 42, 0.7)',
      text: '#f0d0e0',
      textSecondary: '#ae7a9a',
      border: 'rgba(233, 30, 99, 0.15)',
    },
  },
  {
    id: 'arctic',
    name: 'Arctic',
    colors: {
      bg0: '#f0f4f8',
      bg1: '#e8eef4',
      bg2: '#d8e2ec',
      cool: '#3498db',
      warm: '#2ecc71',
      glass: 'rgba(232, 238, 244, 0.7)',
      text: '#1a2a3a',
      textSecondary: '#5a6a7a',
      border: 'rgba(52, 152, 219, 0.2)',
    },
  },
  {
    id: 'sand',
    name: 'Sand',
    colors: {
      bg0: '#1a1510',
      bg1: '#2a2518',
      bg2: '#383020',
      cool: '#d4a574',
      warm: '#c9956b',
      glass: 'rgba(42, 37, 24, 0.7)',
      text: '#e8e0d0',
      textSecondary: '#a09080',
      border: 'rgba(212, 165, 116, 0.15)',
    },
  },
  {
    id: 'friday',
    name: 'Friday',
    colors: {
      bg0: '#f8f9fa',
      bg1: '#ffffff',
      bg2: '#f0f1f3',
      cool: '#5f6368',
      warm: '#c96b3c',
      glass: 'rgba(255, 255, 255, 0.7)',
      text: '#1a1d21',
      textSecondary: '#5f6368',
      border: '#e8eaed',
    },
  },
];

export function getThemeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}
```

- [ ] **Step 3: 创建主题服务索引**

Create `src/services/theme/index.ts`:

```typescript
export { THEMES, getThemeById } from './themes';
export type { Theme } from './themes';
```

- [ ] **Step 4: 提交**

```bash
git add src/services/theme/
git commit -m "feat: add theme definitions with 7 nebula themes"
```

---

## Task 2: 创建ThemingProvider

**Files:**
- Create: `src/contexts/ThemingProvider.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: 创建ThemingProvider**

Create `src/contexts/ThemingProvider.tsx`:

```tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Theme, getThemeById, THEMES } from '../services/theme';

interface ThemingContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  themes: Theme[];
}

const ThemingContext = createContext<ThemingContextType | undefined>(undefined);

export function ThemingProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<string>(() => {
    return localStorage.getItem('friday-theme') || 'midnight';
  });

  const currentTheme = getThemeById(themeId);

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
    localStorage.setItem('friday-theme', id);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const { colors } = currentTheme;
    
    root.style.setProperty('--neb-bg0', colors.bg0);
    root.style.setProperty('--neb-bg1', colors.bg1);
    root.style.setProperty('--neb-bg2', colors.bg2);
    root.style.setProperty('--neb-cool', colors.cool);
    root.style.setProperty('--neb-warm', colors.warm);
    root.style.setProperty('--neb-glass', colors.glass);
    root.style.setProperty('--neb-text', colors.text);
    root.style.setProperty('--neb-text-secondary', colors.textSecondary);
    root.style.setProperty('--neb-border', colors.border);
  }, [currentTheme]);

  return (
    <ThemingContext.Provider value={{ currentTheme, setTheme, themes: THEMES }}>
      {children}
    </ThemingContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemingContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemingProvider');
  }
  return context;
}
```

- [ ] **Step 2: 在main.tsx中包裹ThemingProvider**

Modify `src/main.tsx` - 在ReactDOM.render中包裹ThemingProvider:

```tsx
import { ThemingProvider } from './contexts/ThemingProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemingProvider>
      <App />
    </ThemingProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: 提交**

```bash
git add src/contexts/ src/main.tsx
git commit -m "feat: add ThemingProvider with CSS variable injection"
```

---

## Task 3: 更新CSS变量和动画

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: 更新index.css添加星云主题变量和动画**

Replace the existing CSS variables section in `src/index.css` with:

```css
@import "tailwindcss";

:root {
  /* 星云主题变量 (由ThemingProvider动态注入) */
  --neb-bg0: #0a1118;
  --neb-bg1: #0d1b2a;
  --neb-bg2: #1b2838;
  --neb-cool: #8fb6d8;
  --neb-warm: #d39872;
  --neb-glass: rgba(13, 27, 42, 0.7);
  --neb-text: #e0e0e0;
  --neb-text-secondary: #8a9aae;
  --neb-border: rgba(143, 182, 216, 0.15);
  
  /* Friday品牌色 */
  --friday-orange: #c96b3c;
  --friday-orange-hover: #b85a2b;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

body {
  background: 
    radial-gradient(ellipse at 20% 50%, rgba(143,182,216,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(211,152,114,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(143,182,216,0.04) 0%, transparent 50%),
    var(--neb-bg0);
  color: var(--neb-text);
}

/* 毛玻璃效果 */
.glass-panel {
  background: var(--neb-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--neb-border);
}

/* 动画系统 */
@keyframes neb-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}

@keyframes neb-glow {
  0%, 100% { filter: drop-shadow(0 0 3px var(--neb-warm)); }
  50% { filter: drop-shadow(0 0 10px var(--neb-warm)); }
}

@keyframes think-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

@keyframes neb-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 呼吸动画类 */
.animate-breathe {
  animation: neb-breathe 2.6s ease-in-out infinite;
}

/* 发光动画类 */
.animate-glow {
  animation: neb-glow 2s ease-in-out infinite;
}

/* 思考点动画类 */
.think-dot {
  animation: think-dot 1.4s ease-in-out infinite;
}

.think-dot:nth-child(1) { animation-delay: 0s; }
.think-dot:nth-child(2) { animation-delay: 0.2s; }
.think-dot:nth-child(3) { animation-delay: 0.4s; }

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--neb-border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--neb-text-secondary);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/index.css
git commit -m "feat: add nebula theme CSS variables and animations"
```

---

## Task 4: 更新Sidebar毛玻璃效果

**Files:**
- Modify: `src/ui/components/Sidebar/Sidebar.tsx`

- [ ] **Step 1: 更新Sidebar样式**

在 `Sidebar.tsx` 中，找到侧栏容器的className，添加毛玻璃效果：

将侧栏的背景色从 `bg-[var(--bg-secondary)]` 改为使用毛玻璃效果：

```tsx
// 找到侧栏容器 (通常是 <aside> 或 <div> 作为侧栏根元素)
// 添加 glass-panel 类，移除原有的背景色类
<aside className="glass-panel w-72 h-full flex flex-col transition-all duration-300 ...">
```

同时更新Logo区域，添加呼吸动画：

```tsx
// 找到Logo图标
<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--neb-warm)] to-orange-400 flex items-center justify-center animate-breathe">
  ...
</div>
```

- [ ] **Step 2: 提交**

```bash
git add src/ui/components/Sidebar/Sidebar.tsx
git commit -m "feat: add glass effect to Sidebar and breathing animation to Logo"
```

---

## Task 5: 创建ThoughtStream组件

**Files:**
- Create: `src/stores/thoughtStreamStore.ts`
- Create: `src/ui/components/ThoughtStream/ThoughtStreamItem.tsx`
- Create: `src/ui/components/ThoughtStream/ThoughtStream.tsx`

- [ ] **Step 1: 创建思考流Store**

Create `src/stores/thoughtStreamStore.ts`:

```typescript
import { create } from 'zustand';

export type ThoughtType = 'user_message' | 'tool_call' | 'assistant_response' | 'heartbeat' | 'memory_sync' | 'system';
export type ThoughtStatus = 'pending' | 'running' | 'success' | 'error';

export interface ThoughtItem {
  id: string;
  layer: 'L1' | 'L2';
  type: ThoughtType;
  content: string;
  status: ThoughtStatus;
  timestamp: Date;
  details?: string;
}

interface ThoughtStreamState {
  thoughts: ThoughtItem[];
  isVisible: boolean;
  addThought: (thought: Omit<ThoughtItem, 'id' | 'timestamp'>) => void;
  updateThought: (id: string, updates: Partial<ThoughtItem>) => void;
  toggleVisibility: () => void;
  clearThoughts: (layer?: 'L1' | 'L2') => void;
}

export const useThoughtStreamStore = create<ThoughtStreamState>((set) => ({
  thoughts: [],
  isVisible: false,

  addThought: (thought) =>
    set((state) => ({
      thoughts: [
        ...state.thoughts,
        {
          ...thought,
          id: Date.now().toString(),
          timestamp: new Date(),
        },
      ],
    })),

  updateThought: (id, updates) =>
    set((state) => ({
      thoughts: state.thoughts.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  toggleVisibility: () =>
    set((state) => ({ isVisible: !state.isVisible })),

  clearThoughts: (layer) =>
    set((state) => ({
      thoughts: layer
        ? state.thoughts.filter((t) => t.layer !== layer)
        : [],
    })),
}));
```

- [ ] **Step 2: 创建ThoughtStreamItem组件**

Create `src/ui/components/ThoughtStream/ThoughtStreamItem.tsx`:

```tsx
import React from 'react';
import { ThoughtItem } from '../../stores/thoughtStreamStore';

const typeColors: Record<string, string> = {
  user_message: 'bg-blue-500',
  tool_call: 'bg-yellow-500',
  assistant_response: 'bg-green-500',
  heartbeat: 'bg-purple-500',
  memory_sync: 'bg-cyan-500',
  system: 'bg-gray-500',
};

const typeLabels: Record<string, string> = {
  user_message: 'user message',
  tool_call: 'tool call',
  assistant_response: 'assistant',
  heartbeat: 'heartbeat tick',
  memory_sync: 'memory sync',
  system: 'system',
};

const statusIcons: Record<string, string> = {
  pending: '⏳',
  running: '⏳',
  success: '✓',
  error: '✗',
};

export function ThoughtStreamItem({ thought }: { thought: ThoughtItem }) {
  const timeStr = thought.timestamp.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="px-3 py-2 border-b border-[var(--neb-border)] hover:bg-[var(--neb-bg2)] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${typeColors[thought.type]}`} />
        <span className="text-xs font-medium text-[var(--neb-cool)]">
          {typeLabels[thought.type]}
        </span>
        <span className="text-xs text-[var(--neb-text-secondary)] ml-auto">
          {timeStr}
        </span>
      </div>
      <p className="text-sm text-[var(--neb-text)] pl-4">{thought.content}</p>
      {thought.status !== 'pending' && (
        <div className="flex items-center gap-1 mt-1 pl-4">
          <span className="text-xs">{statusIcons[thought.status]}</span>
          <span className={`text-xs ${
            thought.status === 'success' ? 'text-green-400' :
            thought.status === 'error' ? 'text-red-400' :
            'text-yellow-400'
          }`}>
            {thought.status}
          </span>
        </div>
      )}
      {thought.details && (
        <pre className="mt-1 pl-4 text-xs text-[var(--neb-text-secondary)] bg-[var(--neb-bg0)] rounded p-2 overflow-x-auto">
          {thought.details}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建ThoughtStream面板**

Create `src/ui/components/ThoughtStream/ThoughtStream.tsx`:

```tsx
import React, { useState } from 'react';
import { useThoughtStreamStore } from '../../stores/thoughtStreamStore';
import { ThoughtStreamItem } from './ThoughtStreamItem';

export function ThoughtStream() {
  const { thoughts, isVisible, toggleVisibility, clearThoughts } = useThoughtStreamStore();
  const [width, setWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  const l1Thoughts = thoughts.filter((t) => t.layer === 'L1');
  const l2Thoughts = thoughts.filter((t) => t.layer === 'L2');

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(400, Math.max(200, startWidth + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (!isVisible) return null;

  return (
    <div
      className="glass-panel h-full flex flex-col overflow-hidden relative"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {/* 拖拽手柄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--neb-cool)] transition-colors z-10"
        onMouseDown={handleMouseDown}
      />

      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--neb-border)]">
        <span className="text-sm font-medium text-[var(--neb-cool)]">⚡ Thought Stream</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => clearThoughts()}
            className="text-xs text-[var(--neb-text-secondary)] hover:text-[var(--neb-text)] transition-colors"
          >
            Clear
          </button>
          <button
            onClick={toggleVisibility}
            className="text-[var(--neb-text-secondary)] hover:text-[var(--neb-text)] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        {/* L1 思考流 */}
        <div className="border-b border-[var(--neb-border)]">
          <div className="px-3 py-2 bg-[var(--neb-bg2)] sticky top-0 z-10">
            <span className="text-xs font-medium text-[var(--neb-warm)]">⚡ L1 - User Triggered</span>
          </div>
          {l1Thoughts.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[var(--neb-text-secondary)]">
              Waiting for user input...
            </div>
          ) : (
            l1Thoughts.map((thought) => (
              <ThoughtStreamItem key={thought.id} thought={thought} />
            ))
          )}
        </div>

        {/* L2 思考流 */}
        <div>
          <div className="px-3 py-2 bg-[var(--neb-bg2)] sticky top-0 z-10">
            <span className="text-xs font-medium text-[var(--neb-cool)]">🧠 L2 - Background Tasks</span>
          </div>
          {l2Thoughts.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-[var(--neb-text-secondary)]">
              No background tasks
            </div>
          ) : (
            l2Thoughts.map((thought) => (
              <ThoughtStreamItem key={thought.id} thought={thought} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git add src/stores/thoughtStreamStore.ts src/ui/components/ThoughtStream/
git commit -m "feat: add ThoughtStream panel with L1/L2 layers"
```

---

## Task 6: 更新AppLayout集成ThoughtStream

**Files:**
- Modify: `src/ui/components/Layout/AppLayout.tsx`

- [ ] **Step 1: 在AppLayout中集成ThoughtStream**

在 `AppLayout.tsx` 中：

1. 导入 ThoughtStream 和 useThoughtStreamStore
2. 在Header中添加思考流开关按钮
3. 在布局中添加ThoughtStream面板

```tsx
// 在文件顶部添加导入
import { ThoughtStream } from '../ThoughtStream/ThoughtStream';
import { useThoughtStreamStore } from '../../../stores/thoughtStreamStore';

// 在组件内部
const { isVisible: isThoughtStreamVisible, toggleVisibility: toggleThoughtStream } = useThoughtStreamStore();

// 在Header中添加按钮 (在设置按钮旁边)
<button
  onClick={toggleThoughtStream}
  className={`p-2 rounded-lg transition-colors ${
    isThoughtStreamVisible 
      ? 'bg-[var(--neb-cool)] text-[var(--neb-bg0)]' 
      : 'text-[var(--neb-text-secondary)] hover:text-[var(--neb-text)] hover:bg-[var(--neb-bg2)]'
  }`}
  title="Toggle Thought Stream (Ctrl+T)"
>
  ⚡
</button>

// 在主内容区布局中，在ChatContainer后面添加ThoughtStream
<div className="flex-1 flex overflow-hidden">
  {/* ChatContainer */}
  <div className="flex-1 flex flex-col overflow-hidden">
    ...
  </div>
  
  {/* ThoughtStream */}
  <ThoughtStream />
</div>
```

- [ ] **Step 2: 添加Ctrl+T快捷键**

在 `AppLayout.tsx` 的 useEffect 中添加快捷键监听：

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+T 切换思考流
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      toggleThoughtStream();
    }
    // ... 其他快捷键
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [toggleThoughtStream]);
```

- [ ] **Step 3: 提交**

```bash
git add src/ui/components/Layout/AppLayout.tsx
git commit -m "feat: integrate ThoughtStream into AppLayout with Ctrl+T shortcut"
```

---

## Task 7: 创建MemoryGraph组件

**Files:**
- Create: `src/ui/components/MemoryGraph/MemoryGraph.tsx`
- Modify: `src/ui/components/Layout/AppLayout.tsx`

- [ ] **Step 1: 创建MemoryGraph组件**

Create `src/ui/components/MemoryGraph/MemoryGraph.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface MemoryNode {
  id: string;
  name: string;
  type: 'core' | 'memory' | 'knowledge' | 'decayed';
  connections: number;
  children: number;
  lastActive: Date;
}

interface MemoryLink {
  source: string;
  target: string;
}

const nodeColors: Record<string, string> = {
  core: 'var(--neb-warm)',
  memory: 'var(--neb-cool)',
  knowledge: '#22c55e',
  decayed: '#6b7280',
};

const nodeRadius: Record<string, number> = {
  core: 9,
  memory: 6,
  knowledge: 5,
  decayed: 4,
};

// 示例数据 (实际应从IPC获取)
const sampleData: { nodes: MemoryNode[]; links: MemoryLink[] } = {
  nodes: [
    { id: '1', name: 'Agent Core', type: 'core', connections: 15, children: 3, lastActive: new Date() },
    { id: '2', name: 'User Preference', type: 'memory', connections: 8, children: 0, lastActive: new Date() },
    { id: '3', name: 'Code Pattern', type: 'knowledge', connections: 5, children: 2, lastActive: new Date(Date.now() - 86400000) },
    { id: '4', name: 'Old Context', type: 'decayed', connections: 2, children: 0, lastActive: new Date(Date.now() - 604800000) },
    { id: '5', name: 'Task History', type: 'memory', connections: 6, children: 1, lastActive: new Date() },
    { id: '6', name: 'Tool Usage', type: 'knowledge', connections: 4, children: 0, lastActive: new Date(Date.now() - 172800000) },
  ],
  links: [
    { source: '1', target: '2' },
    { source: '1', target: '3' },
    { source: '1', target: '5' },
    { source: '2', target: '5' },
    { source: '3', target: '6' },
    { source: '4', target: '1' },
  ],
};

export function MemoryGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // 缩放
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    // 力导向模拟
    const simulation = d3.forceSimulation(sampleData.nodes as any)
      .force('link', d3.forceLink(sampleData.links as any).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => nodeRadius[d.type] + 5));

    // 链接
    const link = g.append('g')
      .selectAll('line')
      .data(sampleData.links)
      .join('line')
      .attr('stroke', 'var(--neb-border)')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.6);

    // 节点
    const node = g.append('g')
      .selectAll('circle')
      .data(sampleData.nodes)
      .join('circle')
      .attr('r', (d) => nodeRadius[d.type])
      .attr('fill', (d) => nodeColors[d.type])
      .attr('stroke', 'var(--neb-bg0)')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer');

    // 节点拖拽
    const drag = d3.drag<SVGCircleElement, MemoryNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag as any);

    // 悬浮提示
    node.append('title').text((d) => `${d.name}\nType: ${d.type}\nConnections: ${d.connections}`);

    // 力更新
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, []);

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 1.2);
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(d3.zoom<SVGSVGElement, unknown>().scaleBy, 0.8);
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(d3.zoom<SVGSVGElement, unknown>().transform, d3.zoomIdentity);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--neb-bg1)]">
      {/* 控制栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--neb-border)]">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-[var(--neb-bg2)] text-[var(--neb-text)] px-3 py-1.5 rounded-lg text-sm border border-[var(--neb-border)] focus:outline-none focus:border-[var(--neb-cool)]"
        />
        <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-[var(--neb-bg2)] text-[var(--neb-text-secondary)]">+</button>
        <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-[var(--neb-bg2)] text-[var(--neb-text-secondary)]">-</button>
        <button onClick={handleReset} className="p-1.5 rounded hover:bg-[var(--neb-bg2)] text-[var(--neb-text-secondary)]">↺</button>
      </div>

      {/* 图谱 */}
      <div className="flex-1 relative">
        <svg ref={svgRef} className="w-full h-full" />
        
        {/* 图例 */}
        <div className="absolute bottom-4 left-4 glass-panel rounded-lg p-3">
          <div className="text-xs font-medium text-[var(--neb-text)] mb-2">Legend</div>
          {Object.entries(nodeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[var(--neb-text-secondary)] capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在AppLayout中添加Tab切换**

在 `AppLayout.tsx` 中添加Chat/Memory Tab切换：

```tsx
// 添加状态
const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');

// 在Header中添加Tab按钮 (在品牌标识旁边)
<div className="flex items-center gap-1 ml-4">
  <button
    onClick={() => setActiveTab('chat')}
    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
      activeTab === 'chat'
        ? 'bg-[var(--neb-cool)] text-[var(--neb-bg0)]'
        : 'text-[var(--neb-text-secondary)] hover:text-[var(--neb-text)]'
    }`}
  >
    💬 Chat
  </button>
  <button
    onClick={() => setActiveTab('memory')}
    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
      activeTab === 'memory'
        ? 'bg-[var(--neb-cool)] text-[var(--neb-bg0)]'
        : 'text-[var(--neb-text-secondary)] hover:text-[var(--neb-text)]'
    }`}
  >
    🧠 Memory
  </button>
</div>

// 在主内容区根据activeTab切换显示
{activeTab === 'chat' ? (
  <ChatContainer />
) : (
  <MemoryGraph />
)}
```

- [ ] **Step 3: 提交**

```bash
git add src/ui/components/MemoryGraph/MemoryGraph.tsx src/ui/components/Layout/AppLayout.tsx
git commit -m "feat: add MemoryGraph with D3 force-directed visualization"
```

---

## Task 8: 创建ACUI卡片系统

**Files:**
- Create: `src/ui/components/ACUI/ACUICard.tsx`
- Create: `src/ui/components/ACUI/WeatherCard.tsx`
- Create: `src/ui/components/ACUI/SelfCheckCard.tsx`

- [ ] **Step 1: 创建ACUICard容器**

Create `src/ui/components/ACUI/ACUICard.tsx`:

```tsx
import React from 'react';

export type CardType = 'weather' | 'selfcheck' | 'awakening' | 'hotpanel' | 'custom';
export type CardPriority = 'low' | 'medium' | 'high';

export interface ACUICardProps {
  type: CardType;
  title: string;
  children: React.ReactNode;
  timestamp: Date;
  priority?: CardPriority;
  onClose?: () => void;
}

const priorityBorders: Record<CardPriority, string> = {
  low: 'border-l-gray-500',
  medium: 'border-l-yellow-500',
  high: 'border-l-red-500',
};

const typeIcons: Record<CardType, string> = {
  weather: '🌤️',
  selfcheck: '🔍',
  awakening: '✨',
  hotpanel: '📰',
  custom: '📋',
};

export function ACUICard({ type, title, children, timestamp, priority = 'low', onClose }: ACUICardProps) {
  const timeStr = timestamp.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`glass-panel rounded-xl p-4 mb-3 border-l-4 ${priorityBorders[priority]} animate-fadeIn`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcons[type]}</span>
          <h3 className="font-medium text-[var(--neb-text)]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--neb-text-secondary)]">{timeStr}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[var(--neb-text-secondary)] hover:text-[var(--neb-text)] transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-[var(--neb-text)]">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: 创建WeatherCard**

Create `src/ui/components/ACUI/WeatherCard.tsx`:

```tsx
import React from 'react';
import { ACUICard } from './ACUICard';

interface WeatherData {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  wind: string;
}

interface WeatherCardProps {
  data: WeatherData;
  timestamp: Date;
  onClose?: () => void;
}

export function WeatherCard({ data, timestamp, onClose }: WeatherCardProps) {
  return (
    <ACUICard type="weather" title="Weather" timestamp={timestamp} onClose={onClose}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-[var(--neb-warm)]">{data.temperature}°C</div>
          <div className="text-[var(--neb-text-secondary)]">{data.city}</div>
        </div>
        <div className="text-right">
          <div className="text-lg">{data.condition}</div>
          <div className="text-xs text-[var(--neb-text-secondary)]">
            💧 {data.humidity}% | 💨 {data.wind}
          </div>
        </div>
      </div>
    </ACUICard>
  );
}
```

- [ ] **Step 3: 创建SelfCheckCard**

Create `src/ui/components/ACUI/SelfCheckCard.tsx`:

```tsx
import React from 'react';
import { ACUICard } from './ACUICard';

interface SelfCheckData {
  status: 'healthy' | 'warning' | 'error';
  memoryUsage: number;
  uptime: string;
  tasksCompleted: number;
  issues: string[];
}

interface SelfCheckCardProps {
  data: SelfCheckData;
  timestamp: Date;
  onClose?: () => void;
}

const statusColors = {
  healthy: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

const statusLabels = {
  healthy: '✓ Healthy',
  warning: '⚠ Warning',
  error: '✗ Error',
};

export function SelfCheckCard({ data, timestamp, onClose }: SelfCheckCardProps) {
  return (
    <ACUICard type="selfcheck" title="System Self-Check" timestamp={timestamp} onClose={onClose}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`font-medium ${statusColors[data.status]}`}>
            {statusLabels[data.status]}
          </span>
          <span className="text-xs text-[var(--neb-text-secondary)]">Uptime: {data.uptime}</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[var(--neb-bg2)] rounded p-2">
            <div className="text-[var(--neb-text-secondary)]">Memory</div>
            <div className="text-[var(--neb-cool)] font-medium">{data.memoryUsage}%</div>
          </div>
          <div className="bg-[var(--neb-bg2)] rounded p-2">
            <div className="text-[var(--neb-text-secondary)]">Tasks Done</div>
            <div className="text-[var(--neb-cool)] font-medium">{data.tasksCompleted}</div>
          </div>
        </div>

        {data.issues.length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-[var(--neb-text-secondary)] mb-1">Issues:</div>
            <ul className="text-xs text-yellow-400 list-disc list-inside">
              {data.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ACUICard>
  );
}
```

- [ ] **Step 4: 提交**

```bash
git add src/ui/components/ACUI/
git commit -m "feat: add ACUI card system with Weather and SelfCheck cards"
```

---

## Task 9: 创建ThemeSelector组件

**Files:**
- Create: `src/ui/components/Settings/ThemeSelector.tsx`
- Modify: `src/ui/components/Settings/SettingsPage.tsx`

- [ ] **Step 1: 创建ThemeSelector组件**

Create `src/ui/components/Settings/ThemeSelector.tsx`:

```tsx
import React from 'react';
import { useTheme } from '../../contexts/ThemingProvider';

export function ThemeSelector() {
  const { currentTheme, setTheme, themes } = useTheme();

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--neb-text)]">Select Theme</h3>
      <div className="grid grid-cols-4 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className={`relative p-3 rounded-xl border-2 transition-all ${
              currentTheme.id === theme.id
                ? 'border-[var(--neb-cool)] bg-[var(--neb-bg2)]'
                : 'border-[var(--neb-border)] hover:border-[var(--neb-cool)] bg-[var(--neb-bg1)]'
            }`}
          >
            {/* 预览色块 */}
            <div className="flex gap-1 mb-2">
              <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.colors.bg0 }} />
              <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.colors.cool }} />
              <div className="w-6 h-6 rounded" style={{ backgroundColor: theme.colors.warm }} />
            </div>
            
            {/* 主题名 */}
            <div className="text-sm text-[var(--neb-text)]">{theme.name}</div>
            
            {/* 选中标记 */}
            {currentTheme.id === theme.id && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--neb-cool)] flex items-center justify-center">
                <span className="text-xs text-[var(--neb-bg0)]">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在SettingsPage中集成ThemeSelector**

在 `SettingsPage.tsx` 的外观Tab中替换原有主题选择器：

```tsx
// 导入ThemeSelector
import { ThemeSelector } from './ThemeSelector';

// 在外观Tab内容中
<TabContent>
  <ThemeSelector />
</TabContent>
```

- [ ] **Step 3: 提交**

```bash
git add src/ui/components/Settings/ThemeSelector.tsx src/ui/components/Settings/SettingsPage.tsx
git commit -m "feat: add ThemeSelector with 7 nebula theme cards"
```

---

## Task 10: 更新ChatInput毛玻璃效果

**Files:**
- Modify: `src/ui/components/Chat/ChatInput.tsx`

- [ ] **Step 1: 更新ChatInput样式**

在 `ChatInput.tsx` 中，找到输入框容器，添加毛玻璃效果：

```tsx
// 找到ChatInput的根容器
<div className="glass-panel border-t border-[var(--neb-border)] p-4">
  ...
</div>
```

- [ ] **Step 2: 提交**

```bash
git add src/ui/components/Chat/ChatInput.tsx
git commit -m "feat: add glass effect to ChatInput"
```

---

## Task 11: 更新CommandMenu毛玻璃效果

**Files:**
- Modify: `src/ui/components/CommandMenu/CommandMenu.tsx`

- [ ] **Step 1: 更新CommandMenu样式**

在 `CommandMenu.tsx` 中，找到弹窗容器，添加毛玻璃效果：

```tsx
// 找到CommandMenu的弹窗容器
<div className="glass-panel rounded-xl shadow-2xl ...">
  ...
</div>
```

- [ ] **Step 2: 提交**

```bash
git add src/ui/components/CommandMenu/CommandMenu.tsx
git commit -m "feat: add glass effect to CommandMenu"
```

---

## Task 12: 更新StatusBar样式

**Files:**
- Modify: `src/ui/components/StatusBar/StatusBar.tsx`

- [ ] **Step 1: 更新StatusBar样式**

在 `StatusBar.tsx` 中，将背景色替换为使用主题变量：

```tsx
// 找到StatusBar容器
<div className="h-7 glass-panel border-t border-[var(--neb-border)] flex items-center px-4 ...">
  ...
</div>
```

- [ ] **Step 2: 提交**

```bash
git add src/ui/components/StatusBar/StatusBar.tsx
git commit -m "feat: update StatusBar to use nebula theme variables"
```

---

## Task 13: 联调测试

- [ ] **Step 1: 启动开发服务器**

Run: `cd F:\Product\Agent\Friday\my-agent-platform && npm run dev`

- [ ] **Step 2: 验证主题切换**

1. 打开Settings → 外观
2. 依次点击7个主题卡片
3. 验证所有组件颜色跟随变化

- [ ] **Step 3: 验证毛玻璃效果**

1. 检查Header、Sidebar、ChatInput、CommandMenu的毛玻璃效果
2. 验证背景星云渐变正常显示

- [ ] **Step 4: 验证思考流面板**

1. 按 Ctrl+T 或点击Header按钮
2. 验证面板可折叠显示
3. 验证可拖拽调整宽度

- [ ] **Step 5: 验证记忆图谱**

1. 点击 "🧠 Memory" Tab
2. 验证D3力导向图正常渲染
3. 测试拖拽、缩放、搜索功能

- [ ] **Step 6: 验证动画效果**

1. 检查Logo呼吸动画
2. 检查状态指示灯发光动画

- [ ] **Step 7: 构建生产版本**

Run: `cd F:\Product\Agent\Friday\my-agent-platform && npm run build`

- [ ] **Step 8: 最终提交**

```bash
git add -A
git commit -m "feat: complete Bailongma UI fusion - themes, glass effects, ThoughtStream, MemoryGraph, ACUI cards"
```

---

## 完成

所有任务完成后，Friday将拥有：
- ✅ 7套星云主题可切换
- ✅ 毛玻璃效果 (Header/Sidebar/ChatInput/CommandMenu)
- ✅ 星云背景渐变
- ✅ 呼吸/发光动画
- ✅ 思考流面板 (L1/L2)
- ✅ D3.js 记忆图谱
- ✅ ACUI 卡片系统
- ✅ 现有功能完整保留
