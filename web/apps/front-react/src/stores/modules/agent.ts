import { create } from 'zustand'
import { useMemo } from 'react'
import groupApi from '@/api/modules/group'
import agentApi from '@/api/modules/agents/index'
import { cacheManager as cache } from '@km/shared-utils'
import { GROUP_TYPE } from '@/constants/group'
import { useConversationStore } from './conversation'

// 缓存key常量
const CACHE_KEYS = {
  AGENT_LIST: 'agent_list',
  MY_AGENT_LIST: 'my_agent_list',
  CATEGORY_LIST: 'category_list'
} as const

export const DEFAULT_AGENT: Agent.State = {
  name: '',
  logo: '',
  agent_id: '',
  configs: '{}',
  custom_config_obj: {},
  settings_obj: {},
  description: '',
  user_group_ids: [],
}

interface AgentState {
  categorys: Category.State[]
  agentList: Agent.State[]
  myAgentList: Agent.State[]
  myAgentLoading: boolean
  boxHeight: number
  setBoxHeight: (height: number) => void
  loadAgentList: () => Promise<Agent.State[]>
  loadCategorys: () => Promise<void>
  loadMyAgentList: (isRefresh?: boolean) => Promise<Agent.State[]>
  findAgentByAgentId: (agent_id: string) => Agent.State | undefined
}

export const useAgentStore = create<AgentState>((set, get) => ({
  categorys: [],
  agentList: [],
  myAgentList: [],
  myAgentLoading: false,
  boxHeight: 0,

  setBoxHeight: (height: number) => {
    set({ boxHeight: height })
  },

  loadAgentList: async () => {
    const fetchAgents = async () => {
      // const userStore = useUserStore()
      // const { is_internal } = userStore.info
      // 接口不用区分内外部，直接展示，然后点击时候判断权限
      // const { data: { agents = [] } = {} } = is_internal ? await agentApi.internalList() : await agentApi.list()
      const { data: { agents = [] } = {} } = await agentApi.available({ limit: 500 })
      return agents.map((originalItem: Agent.State) => {
        const item = { ...originalItem }
        item.custom_config_obj = item.custom_config ? JSON.parse(item.custom_config) : {}
        item.settings_obj = item.settings ? JSON.parse(item.settings) : {}
        return item
      })
    }

    const agentList = await cache.getOrFetch(CACHE_KEYS.AGENT_LIST, fetchAgents)
    set({ agentList })
    return agentList
  },

  loadCategorys: async () => {
    const fetchCategories = async () => {
      const data = await groupApi.current_list(GROUP_TYPE.AGENT)
      return [{ group_id: 0, group_name: '全部' }].concat(
        data
      ) as Category.State[]
    }

    const categorys = await cache.getOrFetch(CACHE_KEYS.CATEGORY_LIST, fetchCategories)
    set({ categorys })
  },

  loadMyAgentList: async (isRefresh = false) => {
    set({ myAgentLoading: true })
    try {
      const fetchMyAgents = async () => {
        const res = await agentApi.my.list({ offset: 0, limit: 100 })
        const data = res.data || res
        const list = data.agents || data || []
        return list.map((originalItem: Agent.State) => {
          const item = { ...originalItem }
          item.custom_config_obj = item.custom_config ? JSON.parse(item.custom_config) : {}
          item.settings_obj = item.settings ? JSON.parse(item.settings) : {}
          return item
        })
      }
      let myAgentList: Agent.State[]
      if (isRefresh) {
        myAgentList = await fetchMyAgents()
      } else {
        myAgentList = await cache.getOrFetch(CACHE_KEYS.MY_AGENT_LIST, fetchMyAgents)
      }
      set({ myAgentList })
      return myAgentList
    } finally {
      set({ myAgentLoading: false })
    }
  },

  findAgentByAgentId: (agent_id) => {
    const state = get()
    return state.myAgentList.find((item) => item.agent_id === agent_id) ||
      state.agentList.find((item) => item.agent_id === agent_id)
  }
}))

export function useCurrentAgent() {
  const currentAgentId = useConversationStore((state) => state.current_agentid)
  const agentList = useAgentStore((state) => state.agentList)
  const myAgentList = useAgentStore((state) => state.myAgentList)
  return useMemo(
    () =>
      myAgentList.find((item) => item.agent_id === currentAgentId) ||
      agentList.find((item) => item.agent_id === currentAgentId) ||
      DEFAULT_AGENT,
    [myAgentList, agentList, currentAgentId]
  )
}
