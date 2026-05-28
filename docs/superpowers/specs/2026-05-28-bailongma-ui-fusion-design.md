# Friday × 白龙马 UI 深度融合设计文档

> **日期**: 2026-05-28
> **方案**: 深度融合 (Deep Fusion)
> **状态**: 已批准

---

## 一、项目概述

### 1.1 目标

将 Bailongma (白龙马) 的星云美学UI设计融入 Friday AI Agent 平台，实现视觉风格 + 布局结构 + 功能组件的全面融合。

### 1.2 源项目分析

| 属性 | Bailongma | Friday |
|------|-----------|--------|
| 风格 | 深色科幻/星云美学 | 现代暖橙色聊天应用 |
| 布局 | 三栏 (思考流+图谱+思考流) | 侧栏+聊天+状态栏 |
| 主题 | 6套可切换 | 浅色/深色/系统 |
| 特色 | D3记忆图谱、思考流、毛玻璃 | CommandMenu、标准对话界面 |

### 1.3 设计原则

1. **保留Friday易用性** — 保持侧栏+聊天的核心交互不变
2. **融入白龙马精髓** — 星云主题、毛玻璃、呼吸动画、思考流
3. **功能增强** — 添加记忆图谱、ACUI卡片系统
4. **主题可切换** — 7套主题（6套星云 + 1套Friday橙）

---

## 二、整体布局

```
┌─────────────────────────────────────────────────────────────────┐
│  Header (毛玻璃)                     [Cmd+K] [主题] [设置]     │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│ Sidebar  │        ChatContainer             │  ThoughtStream    │
│ (侧栏)   │        (聊天主区)                 │  (思考流面板)      │
│          │                                  │                   │
│ ┌──────┐ │  ┌──────────────────────────┐    │  ┌─────────────┐ │
│ │Logo  │ │  │ MessageList              │    │  │ L1 思考流    │ │
│ │搜索  │ │  │  - 欢迎页/消息列表        │    │  │ (用户消息)   │ │
│ │会话  │ │  │  - ToolCallDisplay       │    │  │             │ │
│ │列表  │ │  │                          │    │  ├─────────────┤ │
│ │      │ │  ├──────────────────────────┤    │  │ L2 思考流    │ │
│ │      │ │  │ ChatInput                │    │  │ (后台任务)   │ │
│ │      │ │  │  - 毛玻璃底栏             │    │  │             │ │
│ └──────┘ │  └──────────────────────────┘    │  └─────────────┘ │
│          │                                  │  [可折叠]         │
├──────────┴──────────────────────────────────┴───────────────────┤
│  StatusBar (状态栏)                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 布局规格

| 区域 | 宽度/高度 | 说明 |
|------|----------|------|
| Sidebar | w-72 (288px), 可折叠至 w-18 (72px) | 保持Friday原样 |
| Header | h-14 (56px) | 新增思考流开关+主题选择器 |
| ChatContainer | flex-1, max-w-4xl 居中 | 保持Friday原样 |
| ThoughtStream | w-80 (320px), 可折叠 0~400px | **新增** |
| StatusBar | h-7 (28px) | 保持Friday原样 |

---

## 三、主题系统

### 3.1 CSS变量体系

```css
:root {
  /* 星云基础色 */
  --neb-bg0: #0a1118;
  --neb-bg1: #0d1b2a;
  --neb-bg2: #1b2838;
  --neb-cool: #8fb6d8;
  --neb-warm: #d39872;
  --neb-glass: rgba(13, 27, 42, 0.7);
  
  /* Friday品牌色 (可选) */
  --friday-orange: #c96b3c;
  --friday-orange-hover: #b85a2b;
}
```

### 3.2 七套主题

| 主题 | 主背景 | 冷色 | 暖色 | 风格 |
|------|--------|------|------|------|
| midnight (默认) | #0a1118 | #8fb6d8 | #d39872 | 深蓝星云 |
| phosphor | #0a1a0a | #7cfc00 | #32cd32 | 绿色荧光 |
| violet | #1a0a2e | #9b59b6 | #e74c3c | 紫色星云 |
| rose | #1a0a1a | #e91e63 | #ff6b9d | 玫瑰暖色 |
| arctic | #f0f4f8 | #3498db | #2ecc71 | 极地白色 |
| sand | #1a1510 | #d4a574 | #c9956b | 沙漠暖黄 |
| friday | #f8f9fa | #5f6368 | #c96b3c | Friday橙 (保留) |

### 3.3 主题切换

- Settings → 外观 → 7个主题卡片（带预览色块）
- 主题选择持久化到 SQLite settings 表
- 切换时通过 CSS 变量全局生效，无需重启

---

## 四、视觉元素

### 4.1 毛玻璃效果

```css
.glass-panel {
  background: var(--neb-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(143, 182, 216, 0.1);
}
```

**应用位置：**
- Header
- Sidebar 背景
- ChatInput 底部栏
- ThoughtStream 面板
- CommandMenu
- Settings 弹窗

### 4.2 星云背景

```css
body {
  background: 
    radial-gradient(ellipse at 20% 50%, rgba(143,182,216,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(211,152,114,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(143,182,216,0.04) 0%, transparent 50%),
    var(--neb-bg0);
}
```

### 4.3 动画系统

```css
/* 呼吸动画 - Logo、状态灯 */
@keyframes neb-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}

/* 发光脉冲 - 活跃节点、运行中的工具 */
@keyframes neb-glow {
  0%, 100% { filter: drop-shadow(0 0 3px var(--neb-warm)); }
  50% { filter: drop-shadow(0 0 10px var(--neb-warm)); }
}

/* 思考点动画 */
@keyframes think-dot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* 打字光标 */
@keyframes neb-cursor {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

## 五、功能组件

### 5.1 思考流面板 (ThoughtStream)

**文件:** `src/ui/components/ThoughtStream/ThoughtStream.tsx`

```
┌─────────────────────────┐
│  ⚡ L1 思考流     [折叠] │
├─────────────────────────┤
│  ● user message         │
│    "帮我写一个函数"       │
│    14:32:01             │
│  ● tool call            │
│    code_generator       │
│    ⏳ running...        │
│  ● assistant response   │
│    已生成 add() 函数     │
│    14:32:15             │
└─────────────────────────┘
┌─────────────────────────┐
│  🧠 L2 思考流     [折叠] │
├─────────────────────────┤
│  ● heartbeat tick       │
│    检查记忆更新...       │
│  ● memory sync          │
│    同步 3 条新记忆       │
└─────────────────────────┘
```

**功能：**
- L1: 显示用户消息触发的处理过程（消息接收→工具调用→响应生成）
- L2: 显示 TICK 心跳触发的后台任务（记忆同步、自检等）
- 每条记录：彩色圆点 + 类型标签 + 时间戳 + 内容 + 状态
- 可拖拽调整面板宽度 (200px ~ 400px)
- `Ctrl+T` 切换显示/隐藏

**数据源：**
- 监听 IPC 事件 `thoughtstream:l1` 和 `thoughtstream:l2`
- 复用现有 `chatStore` 和 `systemStatusStore`

### 5.2 记忆图谱 (MemoryGraph)

**文件:** `src/ui/components/MemoryGraph/MemoryGraph.tsx`

作为**Tab页**集成到主内容区（与Chat并列）：

```
┌──────────┬──────────────────────────────────┐
│ Sidebar  │  [💬 Chat] [🧠 Memory] [🔧 Tools]│
│          ├──────────────────────────────────┤
│          │                                  │
│          │     D3.js 力导向图               │
│          │                                  │
│          │     [搜索] [缩放+] [缩放-] [重置] │
│          │     ┌──────────────────┐         │
│          │     │ 图例:            │         │
│          │     │ ● 核心  ● 记忆   │         │
│          │     │ ● 知识  ● 衰减   │         │
│          │     └──────────────────┘         │
└──────────┴──────────────────────────────────┘
```

**节点类型：**
- 核心节点 (Agent): 暖色 `--neb-warm`, 9px 半径
- 记忆节点: 冷色 `--neb-cool`, 按活跃度变色
- 知识节点: 绿色 `#22c55e`
- 衰减节点: 灰色 `#6b7280`

**交互：**
- D3 力导向模拟 (link, charge, center, collision)
- 节点拖拽 (D3 drag)
- 滚轮缩放
- 搜索高亮
- 悬浮信息卡片

**新增依赖:** `d3` + `@types/d3`

### 5.3 ACUI 卡片系统

**文件:** `src/ui/components/ACUI/ACUICard.tsx`

Agent可主动推送可视化卡片到聊天区：

```typescript
interface ACUICard {
  type: 'weather' | 'selfcheck' | 'awakening' | 'hotpanel' | 'custom';
  title: string;
  content: React.ReactNode;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}
```

**内置卡片类型：**
- `WeatherCard` — 天气信息
- `SelfCheckCard` — 系统自检报告
- `AwakeningCard` — 觉醒状态通知
- `HotPanelCard` — 热点新闻聚合

### 5.4 主题选择器

**文件:** `src/ui/components/Settings/ThemeSelector.tsx`

```
┌────────────────────────────────────────┐
│  选择主题                               │
├────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │midnight│ │phosphor│ │violet│          │
│  │  ★   │ │      │ │      │          │
│  └──────┘ └──────┘ └──────┘          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│  │ rose  │ │arctic│ │ sand │ │friday││
│  │      │ │      │ │      │ │  ●   ││
│  └──────┘ └──────┘ └──────┘ └──────┘│
└────────────────────────────────────────┘
```

每个主题卡片显示：预览色块 + 主题名 + 当前选中标记

---

## 六、组件改造清单

| 组件 | 文件 | 改造内容 |
|------|------|---------|
| `AppLayout` | `Layout/AppLayout.tsx` | 添加右侧 ThoughtStream 插槽；添加全局主题上下文 |
| `Sidebar` | `Sidebar/Sidebar.tsx` | 应用毛玻璃样式；Logo添加呼吸动画 |
| `Header` | `Layout/AppLayout.tsx` (内联) | 添加思考流开关按钮；添加主题选择器入口 |
| `ChatContainer` | `Chat/ChatContainer.tsx` | 背景改为星云渐变 |
| `MessageList` | `Chat/MessageList.tsx` | 欢迎页适配星云主题 |
| `MessageItem` | `Chat/MessageItem.tsx` | 头像/气泡颜色使用主题变量 |
| `ChatInput` | `Chat/ChatInput.tsx` | 底栏改为毛玻璃效果 |
| `ToolCallDisplay` | `Chat/ToolCallDisplay.tsx` | 状态图标添加发光动画 |
| `StatusBar` | `StatusBar/StatusBar.tsx` | 样式适配主题变量 |
| `SettingsPage` | `Settings/SettingsPage.tsx` | 集成 ThemeSelector；外观Tab重构 |
| `CommandMenu` | `CommandMenu/CommandMenu.tsx` | 毛玻璃背景 + 星云配色 |
| **新增** `ThoughtStream` | `ThoughtStream/ThoughtStream.tsx` | 思考流面板（L1+L2） |
| **新增** `ThoughtStreamItem` | `ThoughtStream/ThoughtStreamItem.tsx` | 单条思考流记录 |
| **新增** `MemoryGraph` | `MemoryGraph/MemoryGraph.tsx` | D3.js 记忆图谱 |
| **新增** `ACUICard` | `ACUI/ACUICard.tsx` | ACUI 卡片容器 |
| **新增** `WeatherCard` | `ACUI/WeatherCard.tsx` | 天气卡片 |
| **新增** `SelfCheckCard` | `ACUI/SelfCheckCard.tsx` | 自检报告卡片 |
| **新增** `ThemeSelector` | `Settings/ThemeSelector.tsx` | 主题选择器UI |
| **新增** `ThemingProvider` | `contexts/ThemingProvider.tsx` | 主题切换上下文 |

---

## 七、数据流

```
┌─────────────┐    IPC     ┌─────────────┐    Store    ┌─────────────┐
│  Main Process│ ────────→ │  Renderer   │ ─────────→ │   Zustand   │
│  (electron)  │ ←──────── │  (React)    │ ←───────── │   Stores    │
└─────────────┘           └─────────────┘            └─────────────┘
       │                         │                         │
       │ thoughtstream:l1/l2     │                         │
       └────────────────────────→│ ThoughtStream           │
                                 │                         │
       │ memory:graph            │                         │
       └────────────────────────→│ MemoryGraph             │
                                 │                         │
       │ acui:card               │                         │
       └────────────────────────→│ ACUICard → ChatList     │
```

---

## 八、新增依赖

```json
{
  "dependencies": {
    "d3": "^7.9.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3"
  }
}
```

---

## 九、实现顺序

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| Phase 1 | ThemingProvider + CSS变量体系 | 2h |
| Phase 2 | 毛玻璃 + 星云背景 + 动画 | 3h |
| Phase 3 | AppLayout 添加思考流插槽 | 1h |
| Phase 4 | ThoughtStream 组件 | 4h |
| Phase 5 | MemoryGraph + D3 集成 | 6h |
| Phase 6 | ACUI 卡片系统 | 3h |
| Phase 7 | Settings 主题选择器 | 2h |
| Phase 8 | 联调 + 细节打磨 | 3h |
| **合计** | | **~24h** |

---

## 十、验收标准

1. ✅ 7套主题可正常切换，所有组件颜色跟随变化
2. ✅ 毛玻璃效果在 Header/Sidebar/ChatInput/ThoughtStream 正常显示
3. ✅ 星云背景渐变在浅色/深色模式下均可正常显示
4. ✅ 呼吸动画在 Logo 和状态指示灯上正常运行
5. ✅ ThoughtStream 面板可折叠，L1/L2 内容正确显示
6. ✅ MemoryGraph D3 力导向图可交互（拖拽/缩放/搜索）
7. ✅ ACUI 卡片可在聊天区正常渲染
8. ✅ 现有功能（CommandMenu、Settings、StatusBar）不受影响
9. ✅ 性能无明显下降（帧率 ≥ 30fps）

---

*设计完成，待进入实现阶段。*
