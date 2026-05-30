/**
 * AvatarModel - VRM 模型渲染与状态驱动
 */

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useVRM } from './hooks/useVRM'
import type { AvatarState } from './types'

interface AvatarModelProps {
  url: string
  state: AvatarState
  position?: [number, number, number]
  scale?: number
}

export function AvatarModel({
  url,
  state,
  position = [0, 0, 0],
  scale = 1,
}: AvatarModelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { vrm, loading, error } = useVRM(url)
  const [hovered, setHovered] = useState(false)

  // 上一次状态
  const prevStateRef = useRef<AvatarState['main']>('idle')
  const boneLoggedRef = useRef(false)

  // 呼吸、待机动画 + 手臂姿态
  useFrame(({ clock }) => {
    if (!vrm || !groupRef.current) return

    const time = clock.elapsedTime

    // ---- 手臂自然下垂（每帧强制设置） ----
    try {
      const humanoid = vrm.humanoid
      if (humanoid) {
        // 左臂：自然下垂（Z 轴负方向旋转 = 向下）
        const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm')
        if (leftUpperArm) {
          leftUpperArm.rotation.z = -Math.PI * 0.38
          leftUpperArm.rotation.x = Math.PI * 0.06
        }

        // 右臂：自然下垂（Z 轴正方向旋转 = 向下，相对于 -X 方向）
        const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm')
        if (rightUpperArm) {
          rightUpperArm.rotation.z = Math.PI * 0.38
          rightUpperArm.rotation.x = Math.PI * 0.06
        }

        // 左前臂：微弯
        const leftLowerArm = humanoid.getNormalizedBoneNode('leftLowerArm')
        if (leftLowerArm) {
          leftLowerArm.rotation.z = -Math.PI * 0.04
        }

        // 右前臂：微弯
        const rightLowerArm = humanoid.getNormalizedBoneNode('rightLowerArm')
        if (rightLowerArm) {
          rightLowerArm.rotation.z = Math.PI * 0.04
        }

        // 手掌：自然放松
        const leftHand = humanoid.getNormalizedBoneNode('leftHand')
        if (leftHand) {
          leftHand.rotation.z = Math.PI * 0.06
        }

        const rightHand = humanoid.getNormalizedBoneNode('rightHand')
        if (rightHand) {
          rightHand.rotation.z = -Math.PI * 0.06
        }
      }
    } catch (e) {
      // 骨骼操作失败静默处理
    }

    // ---- 骨骼查找诊断（仅打印一次） ----
    if (!boneLoggedRef.current && vrm?.humanoid) {
      const bones = ['leftUpperArm', 'rightUpperArm', 'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'spine', 'head']
      const found: string[] = []
      const missing: string[] = []
      bones.forEach((name) => {
        const node = vrm.humanoid!.getNormalizedBoneNode(name as any)
        if (node) { found.push(name) } else { missing.push(name) }
      })
      console.log(`[Avatar] Bones found: [${found.join(', ')}]  missing: [${missing.join(', ')}]`)
      boneLoggedRef.current = true
    }

    // ---- 呼吸动画 - 胸部微动 ----
    try {
      const spine = vrm.humanoid?.getNormalizedBoneNode('spine')
      if (spine) {
        spine.rotation.x = Math.sin(time * 1.5) * 0.003
      }
    } catch (e) {
      // 忽略
    }

    // ---- 微小的身体晃动 ----
    if (state.main === 'idle' && groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(time * 0.8) * 0.005
    }

    // ---- 眨眼 ----
    try {
      if (vrm.expressionManager) {
        const blinkCycle = time % 4
        if (blinkCycle > 3.8 && blinkCycle < 3.95) {
          vrm.expressionManager.setValue('blink', 1)
        } else {
          vrm.expressionManager.setValue('blink', 0)
        }
      }
    } catch (e) {
      // 忽略
    }
  })

  // 状态变化 → 表情切换
  useEffect(() => {
    if (!vrm?.expressionManager) return

    const prevState = prevStateRef.current
    prevStateRef.current = state.main

    try {
      // 重置所有表情
      const expressions = ['happy', 'angry', 'sad', 'relaxed', 'neutral', 'surprised']
      expressions.forEach((expr) => {
        vrm.expressionManager?.setValue(expr, 0)
      })

      // 根据情感设置表情
      const emotionMap: Record<string, string> = {
        neutral: 'neutral',
        happy: 'happy',
        thinking: 'relaxed',
        surprised: 'surprised',
        sad: 'sad',
      }

      const targetExpression = emotionMap[state.emotion] || 'neutral'
      vrm.expressionManager.setValue(targetExpression, 1)

      if (prevState !== state.main) {
        console.log(`[Avatar] State: ${prevState} → ${state.main}`)
      }
    } catch (e) {
      console.warn('[Avatar] Expression update failed:', e)
    }
  }, [state.main, state.emotion, vrm])

  // 加载状态显示
  if (loading) {
    return (
      <group ref={groupRef} position={position}>
        <mesh>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color="#4ae0d0" wireframe />
        </mesh>
        {/* 加载提示 */}
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#4ae0d0" />
        </mesh>
      </group>
    )
  }

  // 错误状态
  if (error || !vrm) {
    return (
      <group ref={groupRef} position={position}>
        <mesh>
          <boxGeometry args={[0.3, 0.5, 0.2]} />
          <meshBasicMaterial color="#666" wireframe />
        </mesh>
        {/* 错误提示 */}
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#ff6b6b" />
        </mesh>
      </group>
    )
  }

  return (
    <group
      ref={groupRef}
      position={position}
      scale={[scale, scale, scale]}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <primitive object={vrm.scene} />
      {/* 悬停高亮 */}
      {hovered && (
        <pointLight position={[0, 1, 1]} intensity={0.3} color="#4ae0d0" />
      )}
    </group>
  )
}
