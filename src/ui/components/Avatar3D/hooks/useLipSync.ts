/**
 * useLipSync - 唇形同步 Hook
 */

import { useCallback, useRef } from 'react'
import type { VRM } from '@pixiv/three-vrm'

interface UseLipSyncResult {
  /** 更新唇形 */
  update: (audioData: number[]) => void
  /** 重置唇形 */
  reset: () => void
}

export function useLipSync(vrm: VRM | null): UseLipSyncResult {
  const lastUpdateRef = useRef<number>(0)

  const update = useCallback(
    (audioData: number[]) => {
      if (!vrm?.expressionManager) return

      // 节流：每 50ms 最多更新一次（20fps 足够唇形）
      const now = Date.now()
      if (now - lastUpdateRef.current < 50) return
      lastUpdateRef.current = now

      // 计算音频能量（简单 RMS）
      const rms = Math.sqrt(
        audioData.reduce((sum, val) => sum + val * val, 0) / audioData.length
      )

      // 映射到嘴型开合度
      const mouthOpen = Math.min(1, rms * 3) // 放大系数

      // 更新 VRM 嘴型
      // aa 是张嘴表情，relaxed 是闭嘴
      vrm.expressionManager.setValue('aa', mouthOpen * 0.8)
      vrm.expressionManager.setValue('oh', mouthOpen * 0.2)
    },
    [vrm]
  )

  const reset = useCallback(() => {
    if (!vrm?.expressionManager) return

    vrm.expressionManager.setValue('aa', 0)
    vrm.expressionManager.setValue('ih', 0)
    vrm.expressionManager.setValue('ue', 0)
    vrm.expressionManager.setValue('ee', 0)
    vrm.expressionManager.setValue('oh', 0)
  }, [vrm])

  return { update, reset }
}
