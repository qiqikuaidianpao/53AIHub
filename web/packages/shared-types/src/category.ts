/**
 * 分组/分类相关类型定义
 */

export interface CategoryState {
  group_id: number
  eid: number
  created_by: number
  group_name: string
  group_type: number
  sort: number
  agents: any
  created_time: number
  updated_time: number
  visible?: boolean
}
