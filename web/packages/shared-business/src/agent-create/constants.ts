/** Agent 平台类型常量 */
export const AGENT_TYPES = {
  PROMPT: 'prompt',
  COZE_AGENT_CN: 'coze_agent_cn',
  COZE_WORKFLOW_CN: 'coze_workflow_cn',
  COZE_AGENT_OSV: 'coze_agent_osv',
  COZE_WORKFLOW_OSV: 'coze_workflow_osv',
  APP_BUILDER: 'app_builder',
  '53AI_AGENT': '53ai_agent',
  '53AI_WORKFLOW': '53ai_workflow',
  DIFY_AGENT: 'dify_agent',
  DIFY_WORKFLOW: 'dify_workflow',
  BAILIAN: 'bailian',
  VOLCENGINE: 'volcengine',
  YUANQI: 'yuanqi',
  FASTGPT_AGENT: 'fastgpt_agent',
  FASTGPT_WORKFLOW: 'fastgpt_workflow',
  MAXKB_AGENT: 'maxkb_agent',
  N8N_WORKFLOW: 'n8n_workflow',
  TENCENT: 'tencent',
  OPENCLAW: 'openclaw',
} as const

export type AgentPlatformType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES]

export const BACKEND_AGENT_TYPE = {
  AGENT: 0,
  WORKFLOW: 1,
  ASSISTANT: 2,
} as const

export const AGENT_MODES = {
  CHAT: 'chat',
  COMPLETION: 'completion',
  ASSISTANT: 'assistant',

} as const

/** 输入字段类型项 */
export interface FieldTypeItem {
  label: string
  type: string
  allowed?: string[]
}

/** 输入字段类型列表 */
export const inputTypeList: FieldTypeItem[] = [
  {
    label: 'variable_type.text',
    type: 'text',
  },
  {
    label: 'variable_type.textarea',
    type: 'textarea',
  },
  {
    label: 'variable_type.inputNumber',
    type: 'inputNumber',
  },
  {
    label: 'variable_type.select',
    type: 'select',
  },
  { label: 'variable_type.date', type: 'date', allowed: ['53ai_workflow'] },
  { label: 'variable_type.tag', type: 'tag', allowed: ['53ai_workflow'] },
  { label: 'variable_type.file', type: 'file' },
  {
    label: 'variable_type.array_text',
    type: 'array_text',
    allowed: ['coze_workflow_cn'],
  },
  {
    label: 'variable_type.array_image',
    type: 'array_image',
    allowed: ['coze_workflow_cn'],
  },
  {
    label: 'variable_type.array_audio',
    type: 'array_audio',
    allowed: ['coze_workflow_cn'],
  },
  {
    label: 'variable_type.array_video',
    type: 'array_video',
    allowed: ['coze_workflow_cn'],
  },
  {
    label: 'variable_type.array_file',
    type: 'array_file',
    allowed: ['coze_workflow_cn'],
  },
]

/** 输出字段类型列表 */
export const outputTypeList: FieldTypeItem[] = [
  { label: 'variable_type.textarea', type: 'textarea' },
  { label: 'variable_type.image', type: 'image' },
  { label: 'variable_type.audio', type: 'audio' },
  { label: 'variable_type.video', type: 'video' },
  { label: 'variable_type.markdown', type: 'markdown' },
  { label: 'variable_type.array_text', type: 'array_text' },
  { label: 'variable_type.array_image', type: 'array_image' },
  { label: 'variable_type.array_audio', type: 'array_audio' },
  { label: 'variable_type.array_video', type: 'array_video' },
]