/**
 * AvatarScene - 3D 虚拟形象场景容器
 */

import { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { AvatarModel } from './AvatarModel'
import { useAvatarState } from './hooks/useAvatarState'

interface AvatarSceneProps {
  className?: string
  modelUrl?: string
}

/** 加载中占位 */
function LoadingFallback() {
  return (
    <mesh>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshBasicMaterial color="#4ae0d0" wireframe />
    </mesh>
  )
}

/** 错误边界 */
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center h-full text-red-400 text-sm">
      <div className="text-center">
        <p>加载失败</p>
        <p className="text-xs mt-2 opacity-60">{error.message}</p>
      </div>
    </div>
  )
}

export function AvatarScene({
  className = '',
  modelUrl = '/models/Friday0.0.vrm',
}: AvatarSceneProps) {
  const state = useAvatarState()
  const [error] = useState<Error | null>(null)
  const [canvasKey, setCanvasKey] = useState(0)

  // 强制重新挂载 Canvas
  useEffect(() => {
    setCanvasKey((k) => k + 1)
  }, [])

  if (error) {
    return <ErrorFallback error={error} />
  }

  return (
    <div
      className={`${className}`}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        background: 'linear-gradient(180deg, #0f1822 0%, #0a1118 100%)',
      }}
    >
      <Canvas
        key={canvasKey}
        camera={{
          position: [0, 1.0, 2.8],
          fov: 30,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        }}
        style={{
          width: '100%',
          height: '100%',
          background: '#0f1822',
        }}
        dpr={[1, 1.5]}
        onCreated={() => {
          console.log('[Avatar] Canvas created')
        }}
      >
        {/* 基础光照 */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={0.8} color="#ffffff" />
        <pointLight position={[0, 2, 3]} intensity={0.5} color="#4ae0d0" />

        {/* VRM 模型 */}
        <Suspense fallback={<LoadingFallback />}>
          <AvatarModel
            url={modelUrl}
            state={state}
            position={[0, -1.0, 0]}
            scale={1}
          />
        </Suspense>

        {/* 轨道控制 */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.5}
          maxDistance={5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
          autoRotate={state.main === 'idle'}
          autoRotateSpeed={0.3}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* 状态指示器 */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background:
              state.main === 'speaking'
                ? '#10b981'
                : state.main === 'thinking'
                ? '#7c3aed'
                : '#4ae0d0',
            animation: state.main !== 'idle' ? 'pulse 1.5s infinite' : 'none',
          }}
        />
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
          {state.main === 'idle'
            ? '待机'
            : state.main === 'listening'
            ? '聆听'
            : state.main === 'thinking'
            ? '思考'
            : state.main === 'speaking'
            ? '说话'
            : state.main}
        </span>
      </div>
    </div>
  )
}
