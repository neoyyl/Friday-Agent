# Friday Agent Phase 3 设计文档：语音识别完善

**项目**: Friday Agent Platform
**版本**: v2.2.0
**日期**: 2026-05-31
**状态**: 待批准

---

## 1. 背景与目标

### 1.1 项目现状

经过代码审查，当前语音功能状态：

**已实现功能**：
- TTS（语音合成）：
  - macOS say 命令
  - Windows PowerShell SAPI
  - eSpeak 通用
  - EdgeTTSProvider（目前用浏览器原生）
- 说话人管理：注册、删除、识别

**未实现功能**：
- ASR（语音识别）：
  - `VoiceService.transcribe()` 返回空结果
  - 无浏览器 Web Speech API 支持
  - 无 Whisper 本地模型支持
  - 无云 API 支持
  - 语音输入 UI 未集成

### 1.2 Phase 3 目标

根据之前选择的方案（先用浏览器原生 + 模拟，快速可用），本阶段将：

1. **实现浏览器 Web Speech API 的语音识别**
2. **添加模拟/测试模式**（无 API 时可用）
3. **为未来的 Whisper/云 API 预留扩展点**
4. **改进错误处理和状态管理**
5. **完善语音识别 IPC 集成**

---

## 2. 技术方案

### 2.1 架构设计

采用多引擎策略，按优先级尝试：

```
┌─────────────────────────────────────────────────┐
│            VoiceService.transcribe()             │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
         ┌─────────────────────┐
         │ 检测可用引擎        │
         └─────────┬───────────┘
                   │
         ┌─────────┴───────────┐
    1.   │ 浏览器 Web Speech  │  优先（实时）
         └─────────┬───────────┘
                   │
    2.   ┌─────────┴───────────┐
         │ 模拟模式            │  备选（快速可用）
         └─────────┬───────────┘
                   │
    3.   ┌─────────┴───────────┐
         │ Whisper 本地        │  预留（未来）
         └─────────┬───────────┘
                   │
    4.   ┌─────────┴───────────┐
         │ 云 API              │  预留（未来）
         └─────────────────────┘
```

### 2.2 核心实现

#### VoiceService 扩展

新增方法和属性：

```typescript
interface ASRState {
  listening: boolean
  engine: string
  supported: string[]
}

class VoiceService {
  // 新增
  private asr: ASRState = { listening: false, engine: 'none', supported: [] }
  
  async transcribe(audioBase64: string, lang = 'zh'): Promise<{
    text: string
    lang: string
    engine: string
    note?: string
    confidence?: number
  }>
  
  async startListening(lang = 'zh'): Promise<{ success: boolean; engine: string }>
  stopListening(): { success: boolean }
  getASRStatus(): ASRState
  
  // 私有方法
  private async transcribeWithBrowserAPI(lang: string): Promise<string>
  private transcribeWithMock(lang: string): string
}
```

#### 浏览器 Web Speech API 集成

在渲染进程实现语音识别控制，通过 IPC 与主进程通信。

---

## 3. 实施范围

| 功能 | 优先级 | 状态 |
|------|--------|------|
| 浏览器 Web Speech API 集成 | P0 | 待实现 |
| 模拟语音识别模式 | P0 | 待实现 |
| 多引擎自动切换逻辑 | P1 | 待实现 |
| 语音识别状态管理 | P1 | 待实现 |
| 改进错误处理 | P1 | 待实现 |
| Whisper 本地模型预留 | P2 | 待设计 |
| 云 API 预留 | P2 | 待设计 |

---

## 4. 验收标准

- [ ] 浏览器语音识别可用（Web Speech API）
- [ ] 模拟模式可用（无 API 时）
- [ ] 语音识别状态正确上报
- [ ] 完整的错误处理
- [ ] 与现有 IPC handler 集成
- [ ] 支持中英文识别

---

## 5. 后续阶段

- **Phase 4**: 调度任务执行
- **Phase 5**: 智能工作流
