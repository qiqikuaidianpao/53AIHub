/**
 * System Log 模块状态管理
 * 使用 Zustand 统一管理列表页状态
 */
import { create } from 'zustand'
import { systemLogApi, getDefaultListParams, transformSystemLogList } from './api/systemLogApi'
import { DEFAULT_PAGE_SIZE } from './constants'
import type {
  SystemLogDisplayItem,
  SystemLogListParams,
  ActionItem,
  ModuleItem,
} from './types'

interface SystemLogState {
  // 数据状态
  list: SystemLogDisplayItem[]
  total: number
  actions: ActionItem[]
  modules: ModuleItem[]

  // 筛选状态
  params: SystemLogListParams
  dateRange: [number | null, number | null]

  // UI 状态
  loading: boolean

  // Actions
  loadList: (params?: Partial<SystemLogListParams>) => Promise<void>
  loadActions: () => Promise<void>
  loadModules: () => Promise<void>
  setParams: (params: Partial<SystemLogListParams>) => void
  setFilterParams: (params: Partial<SystemLogListParams>) => void
  setDateRange: (range: [number | null, number | null]) => void
  resetParams: () => void
  refresh: () => Promise<void>
}

/**
 * 计算当前页码
 */
export function calculateCurrentPage(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1
}

/**
 * 计算偏移量
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize
}

export const useSystemLogStore = create<SystemLogState>((set, get) => ({
  // 初始状态
  list: [],
  total: 0,
  actions: [],
  modules: [],
  params: getDefaultListParams(),
  dateRange: [null, null],
  loading: false,

  // 加载日志列表
  loadList: async (overrideParams?: Partial<SystemLogListParams>) => {
    const { params, dateRange } = get()
    const finalParams: SystemLogListParams = {
      ...params,
      ...overrideParams,
      start_time: dateRange[0],
      end_time: dateRange[1],
    }

    set({ loading: true })
    try {
      const response = await systemLogApi.list(finalParams)
      set({
        list: transformSystemLogList(response.system_logs || []),
        total: response.count || 0,
        params: finalParams,
      })
    } finally {
      set({ loading: false })
    }
  },

  // 加载操作类型列表
  loadActions: async () => {
    const data = await systemLogApi.actions()
    set({ actions: data })
  },

  // 加载模块列表
  loadModules: async () => {
    const data = await systemLogApi.modules()
    set({ modules: data })
  },

  // 设置请求参数
  setParams: (newParams) => {
    const { params, loadList, dateRange } = get()
    const finalParams: SystemLogListParams = {
      ...params,
      ...newParams,
      start_time: dateRange[0],
      end_time: dateRange[1],
    }
    set({ params: finalParams })
    loadList()
  },

  // 设置筛选参数（会重置页码）
  setFilterParams: (newParams) => {
    const { params, loadList, dateRange } = get()
    const finalParams: SystemLogListParams = {
      ...params,
      ...newParams,
      offset: 0, // 筛选条件变化时重置页码
      start_time: dateRange[0],
      end_time: dateRange[1],
    }
    set({ params: finalParams })
    loadList()
  },

  // 设置日期范围（会重置页码）
  setDateRange: (range) => {
    const { params } = get()
    set({ dateRange: range })
    // 日期变化时重置页码并重新加载
    const finalParams: SystemLogListParams = {
      ...params,
      offset: 0,
      start_time: range[0],
      end_time: range[1],
    }
    set({ params: finalParams })
    get().loadList()
  },

  // 重置参数
  resetParams: () => {
    set({
      params: getDefaultListParams(),
      dateRange: [null, null],
    })
    get().loadList()
  },

  // 刷新数据
  refresh: async () => {
    await get().loadList()
  },
}))
