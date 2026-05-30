/**
 * Avatar3D - Friday 虚拟形象模块
 */

export { AvatarScene } from './AvatarScene'
export { AvatarModel } from './AvatarModel'
export { useAvatarState, useAvatarMainState } from './hooks/useAvatarState'
export { useVRM } from './hooks/useVRM'
export { useLipSync } from './hooks/useLipSync'

export type {
  AvatarState,
  AvatarMainState,
  AvatarEmotion,
  VRMConfig,
} from './types'
