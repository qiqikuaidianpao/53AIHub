import { create } from 'zustand'
import { useEnterpriseStore } from '@/stores/modules/enterprise'

const enterprise_store = useEnterpriseStore.getState()

const DEFAULT_COMPLETION_PARAMS = {
  temperature: 0.2,
  top_p: 0.75,
  presence_penalty: 0.5,
  frequency_penalty: 0.5,
}

interface AgentFormData {
  logo: string
  name: string
  group_id: number
  description: string
  channel_type: number
  model: string
  sort: number
  prompt: string
  user_group_ids: number[]
  subscription_group_ids: number[]
  tools: any[]
  use_cases: any[]
  configs: Record<string, any>
  custom_config: {
    agent_type: string
    agent_mode: string
    provider_id: number
    tencent_bot_id: string
    coze_workspace_id: string
    coze_bot_id: string
    coze_bot_url: string
    app_builder_bot_id: string
    chat53ai_agent_id: string
    channel_config: Record<string, any>
    [key: string]: any
  }
  settings: {
    opening_statement: string
    suggested_questions: string[]
    file_parse: {
      enable: boolean
    }
    image_parse: {
      vision: boolean
      enable: boolean
    }
    relate_agents: any[]
    input_fields: any[]
    output_fields: any[]
    [key: string]: any
  }
}

interface AgentFormState {
  saving: boolean
  loading: boolean
  agent_id: string
  agent_type: string
  form_data: AgentFormData
  agent_data: Record<string, any>
  group_options: any[]
  support_image: boolean
  is_new: boolean
  setSaving: (saving: boolean) => void
  setLoading: (loading: boolean) => void
  setAgentId: (id: string) => void
  setAgentType: (type: string) => void
  setFormData: (data: Partial<AgentFormData>) => void
  setAgentData: (data: Record<string, any>) => void
  reset: () => void
}

const initialFormData: AgentFormData = {
  logo: '',
  name: '',
  group_id: 0,
  description: '',
  channel_type: 0,
  model: '',
  sort: 0,
  prompt: '',
  user_group_ids: [],
  subscription_group_ids: [],
  tools: [],
  use_cases: [],
  configs: {},
  custom_config: {
    agent_type: 'prompt',
    agent_mode: 'chat',
    provider_id: 0,
    tencent_bot_id: '',
    coze_workspace_id: '',
    coze_bot_id: '',
    coze_bot_url: '',
    app_builder_bot_id: '',
    chat53ai_agent_id: '',
    channel_config: {},
  },
  settings: {
    opening_statement: '',
    suggested_questions: [],
    file_parse: {
      enable: false,
    },
    image_parse: {
      vision: false,
      enable: false,
    },
    relate_agents: [],
    input_fields: [],
    output_fields: [],
  },
}

export const useAgentFormStore = create<AgentFormState>((set, get) => ({
  saving: false,
  loading: false,
  agent_id: '',
  agent_type: 'prompt',
  form_data: { ...initialFormData },
  agent_data: {},
  group_options: [],
  support_image: false,
  is_new: false,

  setSaving: (saving) => set({ saving }),
  setLoading: (loading) => set({ loading }),
  setAgentId: (id) => set({ agent_id: id }),
  setAgentType: (type) => set({ agent_type: type }),
  setFormData: (data) => set((state) => ({
    form_data: { ...state.form_data, ...data }
  })),
  setAgentData: (data) => set({ agent_data: data }),
  reset: () => set({
    saving: false,
    loading: false,
    agent_id: '',
    agent_type: 'prompt',
    form_data: { ...initialFormData },
    agent_data: {},
    group_options: [],
    support_image: false,
    is_new: false,
  }),
}))

// Helper to update form data from agent detail
export const updateFormDataFromAgent = (
  agentData: Record<string, any>,
  setFormData: (data: Partial<AgentFormData>) => void,
  setAgentType: (type: string) => void
) => {
  const agentType = agentData.agent_type || 'prompt'
  setAgentType(agentType)

  setFormData({
    logo: agentData.logo || '',
    name: agentData.name || '',
    group_id: +agentData.group_id || 0,
    description: agentData.description || '',
    channel_type: +agentData.channel_type || 0,
    model: agentData.model || '',
    sort: +agentData.sort || 0,
    prompt: agentData.prompt || '',
    user_group_ids: agentData.user_group_ids || [],
    subscription_group_ids: agentData.user_group_ids || [],
    tools: agentData.tools || [],
    use_cases: agentData.use_cases || [],
    configs:
      agentData.configs && Object.keys(agentData.configs).length > 0
        ? agentData.configs
        : { completion_params: DEFAULT_COMPLETION_PARAMS },
    custom_config: {
      agent_type: agentType,
      provider_id: 0,
      channel_id: 0,
      coze_workspace_id: '',
      coze_bot_id: '',
      coze_bot_url: '',
      tencent_bot_id: '',
      app_builder_bot_id: '',
      chat53ai_agent_id: '',
      channel_config: {},
      ...(agentData.custom_config || {}),
    },
    settings: {
      opening_statement: '',
      suggested_questions: [],
      file_parse: {
        enable: false,
      },
      image_parse: {
        vision: false,
        enable: false,
      },
      relate_agents: [],
      input_fields: [],
      output_fields: [],
      ...(agentData.settings || {}),
    },
  })
}
