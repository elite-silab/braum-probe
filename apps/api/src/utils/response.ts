// Braum 布隆 CF 探针 — 统一响应格式化

/** 成功响应 */
export function success<T>(data: T) {
  return { code: 0, message: 'ok', data }
}

/** 分页响应 */
export function paginated<T>(data: T[], meta: { page: number; page_size: number; total: number; total_pages: number }) {
  return { code: 0, message: 'ok', data, meta }
}

/** 404 错误 */
export function notFound(message = 'Not Found') {
  return { code: 40400, message, data: null }
}

/** 400 错误 */
export function badRequest(message = 'Bad Request') {
  return { code: 40000, message, data: null }
}

/** 401 错误 */
export function unauthorized(message = 'Unauthorized') {
  return { code: 40100, message, data: null }
}

/** 403 错误 */
export function forbidden(message = 'Forbidden') {
  return { code: 40300, message, data: null }
}

/** 500 错误 */
export function serverError(message = 'Internal Server Error') {
  return { code: 50000, message, data: null }
}
