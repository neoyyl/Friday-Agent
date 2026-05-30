/**
 * useAvatarState - 从 Zustand Stores 订阅虚拟形象状态
 */

import { useMemo } from 'react'
import { useChatStore } from '../../../../stores/chatStore'
import { useEmotionStore } from '../../../../stores/emotionStore'
import { useKernelStore } from '../../../../stores/kernelStore'
import type { AvatarState, AvatarMainState, AvatarEmotion } from '../types'

/** 情感类型映射 */
const EMOTION_MAP: Record<string, AvatarEmotion> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'surprised',
  fear: 'surprised',
  surprise: 'surprised',
  neutral: 'neutral',
  disgust: 'sad',
  anticipation: 'thinking',
}

/**
 * 从 stores 计算虚拟形象状态
 */
export function useAvatarState(): AvatarState {
  const isLoading = useChatStore((s) => s.isLoading)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const currentEmotion = useEmotionStore((s) => s.currentEmotion)
  const kernelStatus = useKernelStore((s) => s.status)

  const state = useMemo<AvatarState>(() => {
    // 计算主状态
    let main: AvatarMainState = 'idle'

    if (kernelStatus === 'starting') {
      main = 'thinking'
    } else if (kernelStatus === 'error') {
      main = 'idle'
    } else if (isLoading || isStreaming) {
      // 根据加载阶段区分 thinking 和 speaking
      main = isStreaming ? 'speaking' : 'thinking'
    } else {
      // 空闲状态，根据情感微调
      main = 'idle'
    }

    // 计算情感
    const emotion: AvatarEmotion = currentEmotion
      ? EMOTION_MAP[currentEmotion] || 'neutral'
      : 'neutral'

    return {
      main,
      emotion,
      active: kernelStatus === 'running',
    }
  }, [isLoading, isStreaming, currentEmotion, kernelStatus])

  return state
}

/**
 * 简化版状态订阅，只返回主要状态字符串
 */
export function useAvatarMainState(): AvatarMainState {
  const { main } = useAvatarState()
  return main
}
