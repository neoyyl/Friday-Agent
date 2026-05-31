# Friday Agent Phase 3 实施计划：语音识别完善

**项目**: Friday Agent Platform
**版本**: v2.2.0
**日期**: 2026-05-31
**状态**: 待执行

---

## 目标

完善语音识别功能，实现浏览器 Web Speech API 支持和模拟模式。

---

## 任务清单

### Task 1: 完善 VoiceService 语音识别功能

**文件**: `electron/services/VoiceService.ts`

**目标**: 改进 VoiceService，支持多引擎策略

**步骤**:

1. **新增 ASR 状态**
   ```typescript
   interface ASRState {
     listening: boolean
     engine: string
     supported: string[]
   }
   
   class VoiceService {
     private asr: ASRState = {
       listening: false,
       engine: 'none',
       supported: ['mock']  // 默认支持 mock
     }
   }
   ```

2. **改进 init() 方法**
   ```typescript
   async init(): Promise<void> {
     this.tts.platform = os.platform()
     this.tts.engine = this.detectTTSEngine()
     
     // 检测支持的 ASR 引擎
     this.asr.supported = this.detectASREngines()
     
     this.setReady()
   }
   
   private detectASREngines(): string[] {
     const engines: string[] = ['mock']
     // 留空给未来检测 Whisper/云 API
     return engines
   }
   ```

3. **重写 transcribe() 方法**
   ```typescript
   async transcribe(audioBase64: string, lang = 'zh'): Promise<{
     text: string
     lang: string
     engine: string
     note?: string
     confidence?: number
   }> {
     // 按优先级尝试引擎
     const engines = this.asr.supported.filter(e => e !== 'mock')
     
     if (engines.length > 0) {
       // 这里调用真实引擎（目前不实现）
       // 保留给 Whisper/云 API
     }
     
     // 回退到 mock 模式
     return this.transcribeWithMock(audioBase64, lang)
   }
   ```

4. **实现模拟识别**
   ```typescript
   private transcribeWithMock(_audioBase64: string, lang = 'zh'): {
     text: string
     lang: string
     engine: string
     note?: string
     confidence?: number
   } {
     const mockTexts: Record<string, string[]> = {
       'zh': [
         '你好，我是 Friday，有什么可以帮你的吗？',
         '今天天气真不错！',
         '让我帮你搜索一下相关信息。',
         '好的，我明白了。',
         '这个问题很有趣，让我想想。',
         '请告诉我更多关于这个的信息。'
       ],
       'en': [
         'Hello, I am Friday, how can I help you?',
         'The weather is great today!',
         'Let me search for related information.',
         'Okay, I understand.',
         'That is an interesting question, let me think.',
         'Please tell me more about this.'
       ]
     }
     
     const texts = mockTexts[lang] || mockTexts['en']
     const text = texts[Math.floor(Math.random() * texts.length)]
     
     return {
       text,
       lang,
       engine: 'mock',
       confidence: 0.85,
       note: 'Mock mode - no real speech recognition'
     }
   }
   ```

5. **新增 getASRStatus()**
   ```typescript
   getASRStatus(): ASRState {
     return { ...this.asr }
   }
   ```

6. **新增 start/stopListening 存根**
   ```typescript
   async startListening(lang = 'zh'): Promise<{ success: boolean; engine: string }> {
     // 浏览器实时识别需要在渲染进程实现
     this.asr.listening = true
     this.asr.engine = 'mock'
     this.emit('asr.state', { listening: true, lang })
     return { success: true, engine: 'mock' }
   }
   
   stopListening(): { success: boolean } {
     this.asr.listening = false
     this.emit('asr.state', { listening: false })
     return { success: true }
   }
   ```

---

### Task 2: 在前端添加 Web Speech API 语音识别

**文件**: 检查现有语音输入组件，创建/修改

**目标**: 在渲染进程实现浏览器 Web Speech API

**步骤**:

1. **检查现有语音相关组件**
   - 查看是否有 `VoiceInput` 或类似组件

2. **创建语音识别 hook**（如果需要）
   ```typescript
   // src/hooks/useSpeechRecognition.ts
   import { useState, useEffect, useRef, useCallback } from 'react'
   
   interface SpeechRecognitionHook {
     isListening: boolean
     transcript: string
     startListening: (lang?: string) => void
     stopListening: () => void
     supported: boolean
   }
   
   export function useSpeechRecognition(): SpeechRecognitionHook {
     const [isListening, setIsListening] = useState(false)
     const [transcript, setTranscript] = useState('')
     const [supported, setSupported] = useState(false)
     const recognitionRef = useRef<any>(null)
     
     useEffect(() => {
       const SpeechRecognition = (window as any).SpeechRecognition ||
         (window as any).webkitSpeechRecognition
       
       if (SpeechRecognition) {
         setSupported(true)
         const recognition = new SpeechRecognition()
         recognition.continuous = false
         recognition.interimResults = true
         recognition.lang = 'zh-CN'
         
         recognition.onresult = (event: any) => {
           let finalTranscript = ''
           for (let i = event.resultIndex; i < event.results.length; i++) {
             finalTranscript += event.results[i][0].transcript
           }
           setTranscript(finalTranscript)
         }
         
         recognition.onend = () => {
           setIsListening(false)
         }
         
         recognitionRef.current = recognition
       }
     }, [])
     
     const startListening = useCallback((lang = 'zh-CN') => {
       if (recognitionRef.current) {
         recognitionRef.current.lang = lang
         recognitionRef.current.start()
         setIsListening(true)
         setTranscript('')
       }
     }, [])
     
     const stopListening = useCallback(() => {
       if (recognitionRef.current) {
         recognitionRef.current.stop()
       }
     }, [])
     
     return { isListening, transcript, startListening, stopListening, supported }
   }
   ```

---

### Task 3: 更新 IPC handlers

**文件**: `electron/handlers/backend.ts`

**目标**: 暴露语音识别状态和控制

**步骤**:

1. **添加 ASR 相关 IPC handlers**
   ```typescript
   ipcMain.handle('backend:asr:status', async () => {
     try { return success(svc.voice()?.getASRStatus()) } catch (e) { return wrapError(e) }
   })
   
   ipcMain.handle('backend:asr:start', async (_event, lang?: string) => {
     try { return success(await svc.voice()?.startListening(lang)) } catch (e) { return wrapError(e) }
   })
   
   ipcMain.handle('backend:asr:stop', async () => {
     try { return success(svc.voice()?.stopListening()) } catch (e) { return wrapError(e) }
   })
   ```

---

## 验收检查清单

- [ ] VoiceService 支持模拟语音识别
- [ ] 提供多种模拟文本（中文和英文）
- [ ] getASRStatus() 返回正确状态
- [ ] ASR 相关 IPC handlers 已添加
- [ ] 错误处理完善
- [ ] 代码编译无错误

---

## 预期交付时间

- Task 1: 30 分钟
- Task 2: 30 分钟
- Task 3: 15 分钟
- **总计**: ~75 分钟
