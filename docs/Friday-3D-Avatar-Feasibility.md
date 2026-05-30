# Friday 3D 虚拟形象可行性分析

> **目标：** 用 3D 交互式虚拟形象替代现有 D3.js 知识图谱，让 Friday 从"图表"变成"存在"。

---

## 📋 文档信息

| 属性 | 值 |
|------|-----|
| **文档版本** | v1.0 |
| **创建日期** | 2026-05-29 |
| **目标路径** | `F:\Product\Agent\Friday\my-agent-platform` |
| **关联设计** | [[女娲美术设计.md]] · [[Friday Kernel]] |

---

## 1. 可行性结论

### ✅ 完全可行，且与现有架构天然契合

| 维度 | 评估 | 说明 |
|------|------|------|
| **技术栈兼容** | ✅ 100% | Electron + React + TypeScript + Vite，Three.js / React Three Fiber 无缝集成 |
| **通信层兼容** | ✅ 100% | 已有 WebSocket 双向通信，可直接传递状态事件驱动形象动画 |
| **性能影响** | ✅ 可控 | WebGL 渲染在 GPU，不阻塞主线程，CPU 开销 <5% |
| **开发成本** | ⚠️ 中等 | 模型获取/制作是主要成本，代码集成约 2-3 天 |
| **打包体积** | ⚠️ +30-80MB | VRM 模型 + Three.js 运行时，Electron 打包可接受 |

---

## 2. 现有架构分析

### 2.1 当前 CenterArea 结构

```
src/ui/components/CenterArea/
├── ChatPanel.tsx          # 对话面板
├── MemoryGraph.tsx        # D3.js 知识图谱 ← 要替换的目标
└── ...
```

**现状：** 中心区域是 D3.js 力导向图谱 + 聊天面板的组合布局。

### 2.2 已有状态管理

```
src/stores/
├── emotionStore.ts    # 情感识别状态
├── kernelStore.ts     # Kernel 连接状态
├── chatStore.ts       # 对话状态
└── agentStore.ts      # Agent 编排状态
```

**关键：** 这些 store 已经可以驱动虚拟形象的状态动画，无需额外通信层。

### 2.3 已有女娲设计

`女娲美术设计.md` 已定义了完整的角色规范：
- 角色形象（瓷白肤色、琥珀色眼睛、微光电路）
- 三景别（全景/中景/特写）
- 7 种状态机（待唤醒/唤醒中/聆听/对话/工作/通知/休眠）
- 色彩体系、光影风格

---

## 3. 技术方案对比

### 3.1 渲染方案选型

| 方案 | 模型格式 | 性能 | 效果 | 开发难度 | 推荐 |
|------|---------|------|------|---------|------|
| **React Three Fiber + VRM** | VRM/GLB | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 中 | ✅ **首选** |
| Three.js 原生 | GLB/GLTF | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 高 | 备选 |
| Live2D Cubism | .moc3 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 中 | 轻量备选 |
| 2D 序列帧 | PNG 序列 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 低 | MVP 快速验证 |
| Convai Web SDK | 自定义 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 低 | 含 AI 对话能力 |

### 3.2 推荐方案：React Three Fiber + VRM

**理由：**
1. **React 生态原生**：R3F 是 React 的 3D 渲染方案，与现有代码风格一致
2. **VRM 标准**：开放标准，大量免费/付费模型可用，支持表情和动画
3. **@pixiv/three-vrm**：官方库，支持唇形同步、眨眼、表情控制
4. **骨骼动画**：支持 Idle/Talking/Emotion 等动画状态机

---

## 4. 架构设计

### 4.1 组件结构

```
src/ui/components/
├── Avatar3D/                    # 新增：3D 虚拟形象模块
│   ├── AvatarScene.tsx          # R3F Canvas 容器
│   ├── AvatarModel.tsx          # VRM 模型加载与控制
│   ├── AvatarController.tsx     # 状态机 → 动画映射
│   ├── AvatarEffects.tsx        # 光效/粒子（电路微光）
│   ├── hooks/
│   │   ├── useVRM.ts            # VRM 加载 hook
│   │   ├── useLipSync.ts        # 唇形同步 hook
│   │   └── useAvatarState.ts    # 状态订阅 hook
│   └── types.ts                 # 类型定义
├── CenterArea/
│   ├── ChatPanel.tsx            # 保留
│   └── IndexView.tsx            # 重构：图谱 ↔ 形象切换
└── ...
```

### 4.2 状态驱动架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Zustand Stores                            │
│  emotionStore  kernelStore  chatStore  agentStore            │
└───────────────┬─────────────────────────────────────────────┘
                │ WebSocket + React 订阅
                ▼
┌─────────────────────────────────────────────────────────────┐
│              AvatarController (状态机)                       │
│                                                             │
│  idle ──► listening ──► thinking ──► speaking ──► idle       │
│    │                      │            │                    │
│    ▼                      ▼            ▼                    │
│  微呼吸动画           低头沉思      抬头+手势+唇形同步        │
└───────────────┬─────────────────────────────────────────────┘
                │ 动画指令
                ▼
┌─────────────────────────────────────────────────────────────┐
│              AvatarModel (VRM 渲染)                         │
│                                                             │
│  ① 骨骼动画层：Idle / Talking / Gesture                     │
│  ② 表情层：Morph Target（happy/thinking/listening）         │
│  ③ 唇形层：Viseme 音素 → 嘴型                              │
│  ④ 特效层：电路微光、环境粒子                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 与 Kernel 通信协议

现有 WebSocket 协议扩展：

```typescript
// 新增消息类型
interface AvatarStateEvent {
  type: 'avatar:state';
  payload: {
    state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'working' | 'notify';
    emotion?: 'neutral' | 'happy' | 'thinking' | 'surprised';
    lipSyncData?: Float32Array;  // 音频帧数据
  };
}

// Kernel 端发送
ws.send(JSON.stringify({
  type: 'avatar:state',
  payload: { state: 'thinking', emotion: 'thinking' }
}));
```

---

## 5. VRM 模型方案

### 5.1 模型获取路径

| 方案 | 成本 | 时间 | 定制化 | 推荐场景 |
|------|------|------|--------|---------|
| **VRoid Hub 免费模型** | 免费 | 即时 | 低 | MVP 验证 |
| **VRoid Studio 自制** | 免费 | 2-4h | 中 | 个性化形象 |
| **购买商用模型** | ¥50-500 | 即时 | 中 | 快速上线 |
| **委托 3D 建模** | ¥2000+ | 1-2周 | 高 | 品牌形象 |

### 5.2 推荐：VRoid Studio 自制

**VRoid Studio**（免费）可创建动漫/半写实风格的 VRM 模型：

1. 下载 VRoid Studio（Windows/Mac）
2. 基于模板调整体型、面部、发型
3. 绘制纹理（肤色、眼睛、服装）
4. 导出为 VRM 0.x 格式
5. 放入 `public/models/aira.vrm`

### 5.3 模型规格要求

```typescript
interface VRMModelSpec {
  format: 'VRM0' | 'VRM1';
  polyCount: < 100000;        // 面数限制
  textureSize: [1024, 2048];  // 纹理尺寸
  requiredBlendshapes: [
    'aa', 'ih', 'ue', 'ee', 'oh',  // 唇形（日语元音）
    'blink', 'blinkLeft', 'blinkRight',
    'happy', 'angry', 'sad', 'relaxed',
    'lookUp', 'lookDown', 'lookLeft', 'lookRight'
  ];
  boneStructure: ' humanoid'; // 标准人形骨骼
}
```

---

## 6. 核心代码实现

### 6.1 安装依赖

```bash
npm install three @react-three/fiber @react-three/drei @pixiv/three-vrm
npm install -D @types/three
```

### 6.2 AvatarScene 主组件

```tsx
// src/ui/components/Avatar3D/AvatarScene.tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { AvatarModel } from './AvatarModel'
import { useAvatarState } from './hooks/useAvatarState'

export function AvatarScene({ className }: { className?: string }) {
  const state = useAvatarState()

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 1.2, 2.5], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* 光照 */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[-2, 3, 1]}
          intensity={0.8}
          color="#fff5e6"
        />
        <pointLight
          position={[0, 0, 2]}
          intensity={0.3}
          color="#4ae0d0"
        />

        {/* VRM 模型 */}
        <AvatarModel
          url="/models/aira.vrm"
          state={state}
        />

        {/* 环境 */}
        <Environment preset="studio" />

        {/* 轨道控制（开发用，生产可禁用） */}
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={4}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  )
}
```

### 6.3 AvatarModel 模型控制

```tsx
// src/ui/components/Avatar3D/AvatarModel.tsx
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVRM } from './hooks/useVRM'
import { useLipSync } from './hooks/useLipSync'
import type { AvatarState } from './types'

interface Props {
  url: string
  state: AvatarState
}

export function AvatarModel({ url, state }: Props) {
  const group = useRef<THREE.Group>(null)
  const { vrm, mixer } = useVRM(url)
  const { update: updateLipSync } = useLipSync(vrm)

  // 呼吸动画
  useFrame((_, delta) => {
    if (!vrm) return

    // 眨眼
    vrm.expressionManager?.update(delta)

    // 呼吸 - 胸部微动
    const breath = Math.sin(Date.now() * 0.001) * 0.003
    vrm.humanoid?.getNormalizedBoneNode('spine')?.rotation.x

    // 唇形同步
    if (state === 'speaking' && state.lipSyncData) {
      updateLipSync(state.lipSyncData)
    }
  })

  // 状态 → 表情映射
  useEffect(() => {
    if (!vrm?.expressionManager) return

    const exprMap: Record<string, string> = {
      idle: 'relaxed',
      listening: 'blink',
      thinking: 'thinking',
      speaking: 'aa',
    }

    // 重置所有表情
    vrm.expressionManager.setValue('happy', 0)
    vrm.expressionManager.setValue('angry', 0)
    vrm.expressionManager.setValue('sad', 0)

    // 设置当前表情
    const expr = exprMap[state.main] || 'relaxed'
    vrm.expressionManager.setValue(expr, 1)
  }, [state.main, vrm])

  // 状态 → 动画映射
  useEffect(() => {
    if (!vrm || !mixer) return

    const animMap: Record<string, string> = {
      idle: '/animations/idle.vrma',
      speaking: '/animations/talking.vrma',
      thinking: '/animations/thinking.vrma',
    }

    const clip = animMap[state.main]
    if (clip) {
      // 加载并播放动画
      loadAnimation(clip).then(action => {
        mixer.stopAllAction()
        action?.play()
      })
    }
  }, [state.main, vrm, mixer])

  return (
    <group ref={group}>
      {vrm && <primitive object={vrm.scene} />}
    </group>
  )
}
```

### 6.4 状态订阅 Hook

```tsx
// src/ui/components/Avatar3D/hooks/useAvatarState.ts
import { useEffect, useState } from 'react'
import { useEmotionStore } from '../../../stores/emotionStore'
import { useKernelStore } from '../../../stores/kernelStore'
import { useChatStore } from '../../../stores/chatStore'

export interface AvatarState {
  main: 'idle' | 'listening' | 'thinking' | 'speaking' | 'working' | 'notify'
  emotion: 'neutral' | 'happy' | 'thinking' | 'surprised'
  lipSyncData?: Float32Array
}

export function useAvatarState(): AvatarState {
  const [state, setState] = useState<AvatarState>({
    main: 'idle',
    emotion: 'neutral',
  })

  const emotion = useEmotionStore(s => s.currentEmotion)
  const kernelState = useKernelStore(s => s.state)
  const isSpeaking = useChatStore(s => s.isSpeaking)
  const isListening = useChatStore(s => s.isListening)

  useEffect(() => {
    let main: AvatarState['main'] = 'idle'

    if (isListening) main = 'listening'
    else if (kernelState === 'thinking') main = 'thinking'
    else if (isSpeaking) main = 'speaking'
    else if (kernelState === 'working') main = 'working'

    const emotionMap: Record<string, AvatarState['emotion']> = {
      neutral: 'neutral',
      happy: 'happy',
      sad: 'thinking',
      angry: 'surprised',
      surprised: 'surprised',
    }

    setState({
      main,
      emotion: emotionMap[emotion] || 'neutral',
    })
  }, [emotion, kernelState, isSpeaking, isListening])

  return state
}
```

---

## 7. 视觉效果实现

### 7.1 电路微光特效

```tsx
// src/ui/components/Avatar3D/AvatarEffects.tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CircuitGlow({ intensity = 1 }: { intensity?: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.elapsedTime
    }
  })

  return (
    <mesh position={[0, 1.5, 0]}>
      <sphereGeometry args={[0.02, 16, 16]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          time: { value: 0 },
          color: { value: new THREE.Color('#4ae0d0') },
          intensity: { value: intensity },
        }}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          uniform vec3 color;
          uniform float intensity;
          varying vec3 vNormal;
          void main() {
            float glow = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
            float pulse = sin(time * 2.0) * 0.3 + 0.7;
            gl_FragColor = vec4(color * intensity * pulse, glow * 0.6);
          }
        `}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
```

### 7.2 状态切换动画

```css
/* 状态切换平滑过渡 */
.avatar-container {
  transition: filter 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.avatar-state-idle {
  filter: brightness(0.9) saturate(0.8);
}

.avatar-state-speaking {
  filter: brightness(1.1) saturate(1.2);
}

.avatar-state-thinking {
  filter: brightness(1.0) saturate(1.0) hue-rotate(10deg);
}
```

---

## 8. 与 D3 知识图谱的共存方案

### 8.1 视图切换

```tsx
// src/ui/components/CenterArea/IndexView.tsx
import { useState } from 'react'
import { AvatarScene } from '../Avatar3D/AvatarScene'
import { MemoryGraph } from '../MemoryGraph'

type ViewMode = 'avatar' | 'graph'

export function IndexView() {
  const [viewMode, setViewMode] = useState<ViewMode>('avatar')

  return (
    <div className="relative w-full h-full">
      {/* 切换按钮 */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        <button
          onClick={() => setViewMode('avatar')}
          className={`px-3 py-1 rounded ${viewMode === 'avatar' ? 'bg-cyan-500' : 'bg-gray-700'}`}
        >
          🧑‍💼 形象
        </button>
        <button
          onClick={() => setViewMode('graph')}
          className={`px-3 py-1 rounded ${viewMode === 'graph' ? 'bg-cyan-500' : 'bg-gray-700'}`}
        >
          🕸️ 图谱
        </button>
      </div>

      {/* 内容区 */}
      {viewMode === 'avatar' ? (
        <AvatarScene className="w-full h-full" />
      ) : (
        <MemoryGraph className="w-full h-full" />
      )}
    </div>
  )
}
```

### 8.2 智能切换（可选）

```typescript
// 根据状态自动切换视图
useEffect(() => {
  // 工作中 → 显示图谱（信息密度高）
  if (kernelState === 'working') {
    setViewMode('graph')
  }
  // 对话中 → 显示形象（情感连接）
  else if (isSpeaking || isListening) {
    setViewMode('avatar')
  }
}, [kernelState, isSpeaking, isListening])
```

---

## 9. 性能优化策略

| 策略 | 实现 | 效果 |
|------|------|------|
| **模型轻量化** | VRM 面数 < 50K，纹理 1024px | 加载 < 500ms |
| **按需渲染** | `frameloop="demand"` 仅状态变化时渲染 | GPU 占用降 60% |
| **LOD 降级** | 远景时降低模型精度 | 低端机可用 |
| **动画复用** | 共享骨骼动画 clip | 内存 -30% |
| **懒加载** | 形象视图激活时才加载模型 | 首屏无影响 |

```tsx
// 按需渲染配置
<Canvas frameloop="demand">
  {/* 只在状态变化或用户交互时渲染帧 */}
</Canvas>
```

---

## 10. 实施计划

### Phase 1：MVP（3-5 天）

| 任务 | 时间 | 产出 |
|------|------|------|
| 安装 R3F + VRM 依赖 | 0.5d | 环境就绪 |
| 加载 VRM 模型 + 基础渲染 | 1d | 能看到形象 |
| 接入状态 store + 表情映射 | 1d | 状态驱动动画 |
| 视图切换（图谱 ↔ 形象） | 0.5d | 可切换 |
| 基础唇形同步 | 1d | 说话时嘴动 |
| 联调测试 | 0.5d | 端到端跑通 |

**MVP 交付物：** 能显示 VRM 形象、根据对话状态切换表情和动画、可与图谱视图切换。

### Phase 2：体验打磨（+5 天）

- 电路微光特效
- 环境粒子效果
- 多表情过渡动画
- 响应式布局（多分辨率）
- 性能优化

### Phase 3：产品化（+5 天）

- First-run 形象选择向导
- 形象自定义（发色/服装）
- 打包优化（模型压缩）
- 低端机降级方案

---

## 11. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| VRM 模型版权问题 | 中 | 高 | 使用 VRoid Studio 自制或明确授权的模型 |
| 低端 GPU 性能不足 | 中 | 中 | 按需渲染 + LOD + CSS 降级方案 |
| 唇形同步延迟 | 低 | 中 | 本地音频分析 + 预测插值 |
| 打包体积增大 | 低 | 低 | 模型压缩 + asar 打包 |
| 与 Electron GPU 冲突 | 低 | 高 | 测试阶段充分验证，禁用硬件加速备选 |

---

## 12. 资源清单

### 12.1 依赖包

```json
{
  "three": "^0.160.0",
  "@react-three/fiber": "^8.15.0",
  "@react-three/drei": "^9.88.0",
  "@pixiv/three-vrm": "^2.1.0",
  "@types/three": "^0.160.0"
}
```

### 12.2 模型资源

| 资源 | 来源 | 用途 |
|------|------|------|
| VRoid Studio | [vroid.com](https://vroid.com) | 免费制作 VRM 模型 |
| VRoid Hub | [hub.vroid.com](https://hub.vroid.com) | 免费/付费模型库 |
| ReadyPlayer.me | [readyplayer.me](https://readyplayer.me) | 头像生成 |
| Mixamo | [mixamo.com](https://mixamo.com) | 免费骨骼动画 |

### 12.3 参考项目

| 项目 | 说明 |
|------|------|
| [pixiv/three-vrm](https://github.com/pixiv/three-vrm) | VRM 官方 Three.js 库 |
| [three-ws/three.ws](https://github.com/three-ws/three.ws) | 3D AI Agent 平台 |
| [khavee-ai/khavee-sdk](https://github.com/khavee-ai/khavee-sdk) | React Three Fiber VRM SDK |
| [agentic-avatars](https://github.com/NavodPeiris/agentic-avatars) | 零基础设施 3D 头像组件 |

---

## 13. 总结

| 维度 | 结论 |
|------|------|
| **可行性** | ✅ 完全可行 |
| **推荐方案** | React Three Fiber + VRM |
| **开发周期** | MVP 3-5 天，完整版 2-3 周 |
| **核心收益** | 从"图表"升级为"存在"，情感连接更强 |
| **下一步** | 安装依赖 → 加载模型 → 接入状态 → 联调 |

---

*本文档为活文档，随项目迭代更新。*
*关联文件：[[女娲美术设计.md]] · [[Friday Kernel]] · [[Friday-Improvement-Plan.md]]*
