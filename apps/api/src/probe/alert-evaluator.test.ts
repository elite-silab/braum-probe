// Braum 布隆 CF 探针 — 告警评估器测试

import { describe, it, expect, vi } from 'vitest'
import { compareValue, evaluateAlerts } from './alert-evaluator'

describe('compareValue', () => {
  describe('< (小于)', () => {
    it('值小于阈值 → true', () => {
      expect(compareValue(5, '<', 10)).toBe(true)
    })
    it('值等于阈值 → false', () => {
      expect(compareValue(10, '<', 10)).toBe(false)
    })
    it('值大于阈值 → false', () => {
      expect(compareValue(15, '<', 10)).toBe(false)
    })
  })

  describe('> (大于)', () => {
    it('值大于阈值 → true', () => {
      expect(compareValue(15, '>', 10)).toBe(true)
    })
    it('值等于阈值 → false', () => {
      expect(compareValue(10, '>', 10)).toBe(false)
    })
    it('值小于阈值 → false', () => {
      expect(compareValue(5, '>', 10)).toBe(false)
    })
  })

  describe('<= (小于等于)', () => {
    it('值小于阈值 → true', () => {
      expect(compareValue(5, '<=', 10)).toBe(true)
    })
    it('值等于阈值 → true', () => {
      expect(compareValue(10, '<=', 10)).toBe(true)
    })
    it('值大于阈值 → false', () => {
      expect(compareValue(15, '<=', 10)).toBe(false)
    })
  })

  describe('>= (大于等于)', () => {
    it('值大于阈值 → true', () => {
      expect(compareValue(15, '>=', 10)).toBe(true)
    })
    it('值等于阈值 → true', () => {
      expect(compareValue(10, '>=', 10)).toBe(true)
    })
    it('值小于阈值 → false', () => {
      expect(compareValue(5, '>=', 10)).toBe(false)
    })
  })

  describe('== (等于)', () => {
    it('值等于阈值 → true', () => {
      expect(compareValue(10, '==', 10)).toBe(true)
    })
    it('值不等于阈值 → false', () => {
      expect(compareValue(11, '==', 10)).toBe(false)
    })
  })

  describe('边界情况', () => {
    it('未知运算符 → false', () => {
      expect(compareValue(10, 'unknown', 10)).toBe(false)
      expect(compareValue(10, '', 10)).toBe(false)
    })

    it('0 值比较', () => {
      expect(compareValue(0, '<', 1)).toBe(true)
      expect(compareValue(0, '==', 0)).toBe(true)
      expect(compareValue(0, '>', 0)).toBe(false)
    })

    it('负数比较', () => {
      expect(compareValue(-5, '<', 0)).toBe(true)
      expect(compareValue(-5, '>', -10)).toBe(true)
    })

    it('浮点数比较', () => {
      expect(compareValue(0.95, '>', 0.9)).toBe(true)
      expect(compareValue(0.95, '<', 0.99)).toBe(true)
    })
  })
})

describe('evaluateAlerts', () => {
  it('无启用的规则时直接返回', async () => {
    const mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      },
    } as any

    await evaluateAlerts(mockEnv)
    expect(mockEnv.DB.prepare).toHaveBeenCalledWith('SELECT * FROM alert_rules WHERE enabled = 1')
  })

  it('DB.prepare 被调用', async () => {
    const mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      },
    } as any

    await evaluateAlerts(mockEnv)
    expect(mockEnv.DB.prepare).toHaveBeenCalledTimes(1)
  })
})
