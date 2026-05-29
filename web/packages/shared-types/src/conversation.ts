/**
 * 会话相关类型定义
 */

export interface ConversationInfo {
  agent_id: number
  conversation_id: string
  created_time: number
  deleted_time: number
  eid: number
  last_message: string
  quota: number
  status: number
  title: string
  total_tokens: number
  updated_time: number
  user_id: number
  virtual_id: string
  created_at: string
  updated_at: string
}

export interface ConversationUserFile {
  type: 'image'
  content: string
  filename: string
  size: number
  mime_type: string
  url: string
}

export interface ConversationMessage {
  agent_id: number
  answer: string
  channel: number
  completion_tokens: number
  conversation_id: string
  created_time: number
  eid: number
  elapsed_time: number
  id: number
  is_stream: boolean
  message: string
  model_name: string
  prompt_tokens: number
  quota: number
  quota_content: string
  request_id: string
  total_tokens: number
  updated_time: number
  user_id: number
  query: string
  loading?: boolean
  user_files: ConversationUserFile[]
  reasoning_content?: string
  reasoning_expanded?: boolean
}

export interface ConversationSender {
  conversation_id: string
  frequency_penalty: number
  messages: {
    content: string
    role: 'user' | 'assistant'
  }[]
  model: string
  presence_penalty: number
  stream: boolean
  temperature: number
  top_p: number
}

export interface NextAgentPrepare {
  agent_id: number
  is_workflow: boolean
  execution_rule: 'auto' | 'manual'
  parameters: Record<string, any>
}
