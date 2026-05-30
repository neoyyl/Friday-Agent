/**
 * Friday Avatar 3D - 类型定义
 */

/** 虚拟形象主状态 */
export type AvatarMainState =
  | 'idle'      // 待机
  | 'listening' // 聆听
  | 'thinking'  // 思考
  | 'speaking'  // 说话
  | 'working'   // 工作
  | 'notify'    // 通知

/** 情感状态 */
export type AvatarEmotion =
  | 'neutral'   // 中性
  | 'happy'     // 开心
  | 'thinking'  // 思考
  | 'surprised' // 惊讶
  | 'sad'       // 悲伤

/** 虚拟形象完整状态 */
export interface AvatarState {
  /** 主状态 */
  main: AvatarMainState
  /** 情感 */
  emotion: AvatarEmotion
  /** 唇形数据（音频帧） */
  lipSyncData?: number[]
  /** 是否激活 */
  active: boolean
}

/** VRM 模型配置 */
export interface VRMConfig {
  /** 模型路径 */
  url: string
  /** 是否启用眨眼 */
  enableBlinking?: boolean
  /** 是否启用唇形同步 */
  enableLipSync?: boolean
  /** 是否启用呼吸动画 */
  enableBreathing?: boolean
}

/** 动画配置 */
export interface AvatarAnimation {
  /** 动画名称 */
  name: string
  /** 动画文件路径 */
  url: string
  /** 过渡时间（秒） */
  duration?: number
}

/** 状态 → 动画映射 */
export const STATE_ANIMATION_MAP: Record<AvatarMainState, string> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'talking',
  working: 'working',
  notify: 'notify',
}

/** 状态 → 表情映射 */
export const STATE_EXPRESSION_MAP: Record<AvatarMainState, string> = {
  idle: 'relaxed',
  listening: 'neutral',
  thinking: 'thinking',
  speaking: 'neutral',
  working: 'neutral',
  notify: 'surprised',
}

/** 情感 → 表情映射 */
export const EMOTION_EXPRESSION_MAP: Record<AvatarEmotion, string> = {
  neutral: 'neutral',
  happy: 'happy',
  thinking: 'thinking',
  surprised: 'surprised',
  sad: 'sad',
}
