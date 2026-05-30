import type { KernelResponse } from '../types/electron-api.d'

/**
 * Safely unwrap a KernelResponse or fallback to raw data.
 * Common patterns handled:
 *   result.data?.agents
 *   result.agents
 *   result.data?.skills || result.skills
 *   result.data?.history || result.history || result.records || []
 */
export function unwrapResponse<T>(
  res: KernelResponse<T> | T | undefined | null,
  fallbackValue: T
): T {
  if (res == null) return fallbackValue
  if (typeof res !== 'object') return res

  const obj = res as Record<string, unknown>

  // Direct error
  if (obj.error) {
    console.warn('[unwrapResponse] Response contains error:', obj.error)
    return fallbackValue
  }

  // KernelResponse<T> pattern: { success, data }
  if ('data' in obj && 'success' in obj) {
    return (obj.data as T) ?? fallbackValue
  }

  // Already unwrapped, return as-is
  return res as T
}

/**
 * Get array from response, handling various nesting patterns.
 */
export function unwrapArray<T>(
  res: KernelResponse<T[]> | T[] | undefined | null,
  ...keys: string[]
): T[] {
  if (res == null) return []
  if (Array.isArray(res)) return res

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = res as any

  // KernelResponse<T> pattern
  if (obj?.data != null && 'success' in obj) {
    const data = obj.data
    if (Array.isArray(data)) return data as T[]
    if (typeof data === 'object') {
      for (const key of keys) {
        const val = data[key]
        if (Array.isArray(val)) return val as T[]
      }
    }
  }

  // Direct object with list keys
  for (const key of keys) {
    const val = obj?.[key]
    if (Array.isArray(val)) return val as T[]
  }

  return []
}
