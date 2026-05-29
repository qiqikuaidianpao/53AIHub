/**
 * 基础响应类型
 */
export interface BaseResponse<T = any> {
  code: number
  message: string
  data: T
}

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T = any> {
  code: number
  message: string
  data: {
    list: T[]
    total: number
    offset: number
    limit: number
  }
}

/**
 * 列表查询参数
 */
export interface ListQueryParams {
  offset?: number
  limit?: number
  keyword?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
