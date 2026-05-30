/**
 * useVRM - VRM 模型加载与管理 Hook
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm'

interface UseVRMResult {
  /** VRM 实例 */
  vrm: VRM | null
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 动画混合器 */
  mixer: THREE.AnimationMixer | null
}

export function useVRM(url: string): UseVRMResult {
  const [vrm, setVrm] = useState<VRM | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null)
  const loaderRef = useRef<GLTFLoader | null>(null)

  useEffect(() => {
    if (!url) {
      setLoading(false)
      return
    }

    let cancelled = false

    const loadVRM = async () => {
      try {
        setLoading(true)
        setError(null)

        // 创建加载器
        if (!loaderRef.current) {
          loaderRef.current = new GLTFLoader()
          loaderRef.current.register((parser) => new VRMLoaderPlugin(parser))
        }

        // 加载模型
        const gltf = await new Promise<GLTF>((resolve, reject) => {
          loaderRef.current!.load(
            url,
            (gltf) => resolve(gltf),
            undefined,
            (err) => reject(err)
          )
        })

        if (cancelled) return

        // 提取 VRM
        const vrmInstance = gltf.userData.vrm as VRM

        if (vrmInstance) {
          // 旋转模型朝向相机
          vrmInstance.scene.rotation.y = Math.PI

          // 创建动画混合器
          const animMixer = new THREE.AnimationMixer(vrmInstance.scene)

          setVrm(vrmInstance)
          setMixer(animMixer)
        } else {
          throw new Error('No VRM data found in model')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load VRM')
          console.error('VRM load error:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadVRM()

    return () => {
      cancelled = true
    }
  }, [url])

  // 清理资源
  useEffect(() => {
    return () => {
      if (vrm) {
        // 释放几何体和材质
        vrm.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose())
            } else {
              obj.material?.dispose()
            }
          }
        })
      }
    }
  }, [vrm])

  return { vrm, loading, error, mixer }
}
