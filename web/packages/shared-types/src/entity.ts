/**
 * 实体类型枚举
 */
export const ENTITY_TYPE = {
  USER: 'user',
  GROUP: 'group',
} as const

export type EntityType = (typeof ENTITY_TYPE)[keyof typeof ENTITY_TYPE]

/**
 * 基础实体接口
 */
export interface BaseEntity {
  value: number
  label: string
}

/**
 * 用户信息类型定义
 */
export interface UserInfo extends BaseEntity {
  user_id: number
  nickname: string
  name: string
  avatar: string
  email: string
  mobile: string
  role: number
  status: number
  departments: unknown[]
  created_time: number
}

/**
 * 群组信息类型定义
 */
export interface GroupInfo extends BaseEntity {
  group_id: number
  group_name: string
  sort: number
  avatar?: string
}

/**
 * 统一实体类型
 */
export type EntityInfo = UserInfo | GroupInfo

/**
 * 实体显示配置
 */
export interface EntityDisplayConfig {
  /** 实体类型 */
  type: EntityType
  /** 实体ID */
  id: number | string
  /** 显示模式：avatar | name | full */
  mode: 'avatar' | 'name' | 'full'
  /** 头像大小 */
  avatarSize?: number | string
  /** 头像形状 */
  avatarShape?: 'circle' | 'square'
  /** 是否显示加载状态 */
  showLoading?: boolean
  /** 默认头像路径 */
  defaultAvatar?: string
}

/**
 * 实体缓存配置
 */
export interface EntityCacheConfig {
  /** 缓存时间（分钟） */
  duration: number
  /** 缓存键前缀 */
  keyPrefix: string
}

/**
 * 实体API参数类型
 */
export interface EntityApiParams {
  /** 用户API参数 */
  user: {
    status: number
    offset: number
    limit: number
  }
  /** 群组API参数 */
  group: {
    group_type: number
  }
}
