// Braum 布隆 CF 探针 — response 工具函数测试

import { describe, it, expect } from 'vitest'
import { success, paginated, notFound, badRequest, unauthorized, serverError } from './response'

describe('success', () => {
  it('应返回 code=0 + data', () => {
    const result = success({ id: '1', name: 'test' })
    expect(result).toEqual({ code: 0, message: 'ok', data: { id: '1', name: 'test' } })
  })

  it('data 可以是 null', () => {
    expect(success(null)).toEqual({ code: 0, message: 'ok', data: null })
  })

  it('data 可以是数组', () => {
    const result = success([1, 2, 3])
    expect(result.data).toEqual([1, 2, 3])
  })

  it('data 可以是字符串', () => {
    expect(success('hello').data).toBe('hello')
  })
})

describe('paginated', () => {
  it('应返回带 meta 的分页格式', () => {
    const meta = { page: 1, page_size: 20, total: 100, total_pages: 5 }
    const result = paginated([{ id: '1' }], meta)
    expect(result).toEqual({
      code: 0,
      message: 'ok',
      data: [{ id: '1' }],
      meta,
    })
  })

  it('空数据列表也应正常返回', () => {
    const meta = { page: 1, page_size: 20, total: 0, total_pages: 0 }
    const result = paginated([], meta)
    expect(result.data).toEqual([])
    expect(result.meta.total).toBe(0)
  })

  it('meta 的 total_pages 应与 page_size 匹配', () => {
    const meta = { page: 2, page_size: 10, total: 25, total_pages: 3 }
    const result = paginated([], meta)
    expect(result.meta.total_pages).toBe(3)
    expect(result.meta.page).toBe(2)
  })
})

describe('notFound', () => {
  it('默认消息为 "Not Found"', () => {
    expect(notFound()).toEqual({ code: 40400, message: 'Not Found', data: null })
  })

  it('可自定义消息', () => {
    expect(notFound('Node not found')).toEqual({ code: 40400, message: 'Node not found', data: null })
  })
})

describe('badRequest', () => {
  it('默认消息为 "Bad Request"', () => {
    expect(badRequest()).toEqual({ code: 40000, message: 'Bad Request', data: null })
  })

  it('可自定义消息', () => {
    expect(badRequest('Missing email')).toEqual({ code: 40000, message: 'Missing email', data: null })
  })
})

describe('unauthorized', () => {
  it('默认消息为 "Unauthorized"', () => {
    expect(unauthorized()).toEqual({ code: 40100, message: 'Unauthorized', data: null })
  })

  it('可自定义消息', () => {
    expect(unauthorized('Token expired')).toEqual({ code: 40100, message: 'Token expired', data: null })
  })
})

describe('serverError', () => {
  it('默认消息为 "Internal Server Error"', () => {
    expect(serverError()).toEqual({ code: 50000, message: 'Internal Server Error', data: null })
  })

  it('可自定义消息', () => {
    expect(serverError('DB connection failed')).toEqual({ code: 50000, message: 'DB connection failed', data: null })
  })
})
