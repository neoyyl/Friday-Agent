export const DEFAULT_TARGET_RETENTION = 0.7
export const DEFAULT_FORGET_THRESHOLD = 0.15
export const BASE_STRENGTH = 4
export const STRENGTH_PER_IMPORTANCE = 3

export function computeRetention(elapsedHours: number, strength: number): number {
  if (strength <= 0) return 0
  if (elapsedHours <= 0) return 1
  return Math.exp(-elapsedHours / strength)
}

export function computeNextReview(strength: number): number {
  if (strength <= 0) return 0
  const hours = -strength * Math.log(DEFAULT_TARGET_RETENTION)
  return Math.max(1, Math.round(hours))
}

export function computeStrengthAfterRecall(currentStrength: number): number {
  if (currentStrength <= 0) return BASE_STRENGTH
  const boost = 1 + 2 / (1 + currentStrength / 8)
  return Math.round(currentStrength * boost)
}

export function shouldForget(retention: number, threshold: number): boolean {
  return retention < threshold
}

export function computeInitialStrength(importance: number): number {
  return BASE_STRENGTH + Math.max(0, importance) * STRENGTH_PER_IMPORTANCE
}
