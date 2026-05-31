import { describe, it, expect } from 'vitest'
import {
  computeRetention,
  computeNextReview,
  computeStrengthAfterRecall,
  shouldForget,
  computeInitialStrength,
} from './ForgettingCurve'

describe('ForgettingCurve', () => {
  describe('computeRetention', () => {
    it('returns 1 at elapsed=0 regardless of strength', () => {
      expect(computeRetention(0, 1)).toBeCloseTo(1, 10)
      expect(computeRetention(0, 100)).toBeCloseTo(1, 10)
    })

    it('decays exponentially with R = e^(-t/S)', () => {
      const S = 10
      expect(computeRetention(S, S)).toBeCloseTo(Math.exp(-1), 5)
      expect(computeRetention(2 * S, S)).toBeCloseTo(Math.exp(-2), 5)
    })

    it('decreases monotonically as time passes', () => {
      const r1 = computeRetention(1, 10)
      const r2 = computeRetention(10, 10)
      const r3 = computeRetention(100, 10)
      expect(r2).toBeLessThan(r1)
      expect(r3).toBeLessThan(r2)
    })

    it('returns 0 for zero strength', () => {
      expect(computeRetention(10, 0)).toBe(0)
    })

    it('returns 0 for negative strength', () => {
      expect(computeRetention(10, -1)).toBe(0)
    })

    it('asymptotically approaches 0 over time', () => {
      const r = computeRetention(1000, 10)
      expect(r).toBeGreaterThan(0)
      expect(r).toBeLessThan(1e-40)
    })

    it('stronger memory retains better at same elapsed time', () => {
      const rWeak = computeRetention(24, 24)
      const rStrong = computeRetention(24, 72)
      expect(rStrong).toBeGreaterThan(rWeak)
    })
  })

  describe('computeNextReview', () => {
    it('returns positive integer for any positive strength', () => {
      expect(computeNextReview(1)).toBeGreaterThanOrEqual(1)
      expect(computeNextReview(24)).toBeGreaterThanOrEqual(1)
      expect(computeNextReview(1000)).toBeGreaterThanOrEqual(1)
      expect(Number.isInteger(computeNextReview(10))).toBe(true)
    })

    it('returns larger interval for stronger memories', () => {
      const t1 = computeNextReview(10)
      const t2 = computeNextReview(100)
      expect(t2).toBeGreaterThan(t1)
    })

    it('returns 0 for zero or negative strength', () => {
      expect(computeNextReview(0)).toBe(0)
      expect(computeNextReview(-5)).toBe(0)
    })

    it('computes interval based on target retention = 0.7', () => {
      const S = 100
      const expected = Math.max(1, Math.round(-S * Math.log(0.7)))
      expect(computeNextReview(S)).toBe(expected)
    })
  })

  describe('computeStrengthAfterRecall', () => {
    it('increases strength after recall', () => {
      const result = computeStrengthAfterRecall(10)
      expect(result).toBeGreaterThan(10)
    })

    it('returns base strength for zero or negative input', () => {
      expect(computeStrengthAfterRecall(0)).toBe(4)
      expect(computeStrengthAfterRecall(-5)).toBe(4)
    })

    it('has diminishing returns for stronger memories', () => {
      const ratio1 = computeStrengthAfterRecall(4) / 4
      const ratio10 = computeStrengthAfterRecall(100) / 100
      expect(ratio10).toBeLessThan(ratio1)
    })

    it('returns an integer', () => {
      expect(Number.isInteger(computeStrengthAfterRecall(7))).toBe(true)
    })

    it('always at least doubles very weak memories', () => {
      const result = computeStrengthAfterRecall(1)
      expect(result).toBeGreaterThanOrEqual(2)
    })
  })

  describe('shouldForget', () => {
    it('returns true when retention below threshold', () => {
      expect(shouldForget(0.1, 0.15)).toBe(true)
    })

    it('returns false when retention above threshold', () => {
      expect(shouldForget(0.5, 0.15)).toBe(false)
    })

    it('returns false when retention equals threshold', () => {
      expect(shouldForget(0.15, 0.15)).toBe(false)
    })

    it('returns true for zero retention', () => {
      expect(shouldForget(0, 0.001)).toBe(true)
    })
  })

  describe('computeInitialStrength', () => {
    it('scales with importance', () => {
      expect(computeInitialStrength(1)).toBeLessThan(computeInitialStrength(5))
    })

    it('returns at least base strength for zero importance', () => {
      expect(computeInitialStrength(0)).toBe(4)
    })

    it('ignores negative importance', () => {
      expect(computeInitialStrength(-10)).toBe(4)
    })
  })
})
