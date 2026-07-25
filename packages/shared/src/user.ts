// Braum 布隆 CF 探针 — 用户类型定义

/** 用户角色 */
export type UserRole = 'owner' | 'admin' | 'viewer'

/** 用户状态 */
export type UserStatus = 'active' | 'disabled'

/** 管理员用户 */
export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url?: string | null
  status: UserStatus
  last_login_at?: string | null
  created_at: string
  updated_at: string
}

/** 创建用户请求 */
export interface CreateUserInput {
  email: string
  name: string
  role: UserRole
}

/** 更新用户请求 */
export interface UpdateUserInput {
  name?: string
  role?: UserRole
  status?: UserStatus
}
