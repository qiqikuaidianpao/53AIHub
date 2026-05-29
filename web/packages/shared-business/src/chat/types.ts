import type { IConversationApi, IAgentApi, IUploadApi, IWorkflowApi } from "./adapters/types";

// ============ Plugin Types ============

export type PluginType = "agent" | "knowledge" | "workspace";

export interface PluginConfig {
  type: PluginType;
  title?: string;
  logo?: string;
  userAvatar?: string;
  features?: {
    showRagStats?: boolean;
    showFileUpload?: boolean;
    showConversationList?: boolean;
  };
}

export interface PluginAdapters {
  conversationApi: IConversationApi;
  agentApi: IAgentApi;
  uploadApi: IUploadApi;
  workflowApi: IWorkflowApi;
}

export interface PluginContextValue {
  config: PluginConfig;
  adapters: PluginAdapters;
  isLoggedIn: boolean;
}

// ============ Message Types ============

export interface MessageFile {
  id: string;
  name: string;
  size?: number;
  mime_type?: string;
  preview_key?: string;
  url?: string;
}

export interface SpecifiedFile {
  id: string;
  name: string;
  icon?: string;
  library_id?: string;
  isfolder?: boolean;
  upload_file_id?: string;
  file_size?: number;
  file_mime?: string;
}

export interface Skill {
  skill_name: string;
  display_name: string;
}

export interface Message {
  id: string | number;
  question: string;
  answer: string;
  skill?: Skill;
  role: "user" | "assistant";
  loading?: boolean;
  error?: boolean;
  reasoning_content?: string;
  reasoning_expanded?: boolean;
  specified_files?: SpecifiedFile[];
  uploaded_files?: MessageFile[];
  specified_content?: string;
  outputFiles?: Array<{ id: string; file_name: string; url: string }>;
  process_records?: ProcessRecord[];
  skillRunItems?: SkillRunItem[];
  rag_stats?: RagStats | null;
  rag_temp?: any;
  rag_search_text?: string;
  knowledge_graph?: boolean;
  agent_id?: string;
  conversation_id?: string | number;
  // Feedback fields
  feedbackId?: number | null;
  feedbackVisible?: boolean;
  feedbackTypeOptions?: any[] | null;
  submitBtnDisabled?: boolean;
  feedbackSuccessful?: boolean;
  feedback_type?: string;
  feedbackLoading?: boolean;
}

// ============ Process Step Types ============

export type SkillRunItemStatus = "pending" | "running" | "completed";

export type StepStatus = "start" | "completed" | "success" | "streaming";

export interface SkillRunScriptItem {
  type: "script";
  title: string;
  bash: string;
  output: string;
  status: SkillRunItemStatus;
}

export interface SkillRunLlmItem {
  type: "llm";
  title: string;
  content: string;
  status: SkillRunItemStatus;
}

export interface SkillRunSearchItem {
  type: "search";
  title: string;
  icon?: string;
  sourceCount?: number;
  tags?: string[];
  sources?: Array<{ title: string; url?: string; icon?: string }>;
  status?: SkillRunItemStatus;
}

export interface IntentData {
  intent?: string;
  skill_name?: string;
  confidence?: number;
  reasoning?: string;
  keywords?: string[];
  answer?: string;
  expanded_queries?: unknown;
}

export interface SkillRunSkillItem {
  type: "skill";
  title: string;
  status: SkillRunItemStatus;
  skillName?: string;
  intentData?: IntentData;
  _bash?: string;
  _toolCallId?: string;
}

export type SkillRunItem =
  | SkillRunScriptItem
  | SkillRunSearchItem
  | SkillRunSkillItem
  | SkillRunLlmItem;

export interface ProcessStep {
  step_code: string;
  status: StepStatus;
  message: string;
  data?: unknown;
}

export interface ProcessRecord {
  step_code: string;
  status: string;
  data: string | { files?: Array<{ id: string; file_name: string; url: string }> };
}

// ============ RAG Stats Types ============

export interface RagChunk {
  chunk_id?: string;
  chunk_type?: string;
  file_id?: string;
  file_name?: string;
  file_path?: string;
  library_id?: string;
  source_key?: string;
  content?: string;
  score?: number;
  source?: string;
  url?: string;
  icon?: string;
  file_icon?: string;
}

export interface RagStats {
  type?: string;
  chunks?: RagChunk[];
  document_quotations?: string[];
  file_quotations?: string[];
  library_search?: RagChunk[];
  files_search?: RagChunk[];
  document_search?: {
    chunks?: RagChunk[];
  };
}

// ============ Send Message Options ============

export interface SendMessageOptions {
  question: string;
  agent_id: string;
  conversation_id?: string | number;
  modelId?: string;
  completion_params?: any;
  messageList?: Message[];
  links?: SpecifiedFile[];
  networkSearch?: boolean;
  knowledgeGraph?: boolean;
  library?: { value: string[] | number[] };
  agentInfo?: any;
  files?: MessageFile[];
  fileInfo?: any;
  slideContent?: string;
  options?: {
    prompt?: string;
    text?: string;
  };
  minimalParams?: boolean;
  skill?: Skill;
  type?: string;
  onMessageListChange?: (updater: (list: Message[]) => Message[], newMessage?: Message) => void;
  onProgress?: (data: any) => void;
}

// ============ Conversation Types ============

export interface ConversationInfo {
  conversation_id: string | number;
  title: string;
  agent_id?: number;
  agent?: any;
  created_time?: number;
  updated_time?: number;
  created_at?: string;
  updated_at?: string;
  is_valid?: number;
  top?: number;
  conversation_type?: number;
}

/** 会话类型枚举 */
export enum ConversationType {
  /** 普通会话 */
  NORMAL = 0,
  /** 正式会话（Openclaw 等场景使用） */
  FORMAL = 1,
}

// ============ SSE Event Types ============

export interface AgentRunReplayEvent {
  seq: number;
  event_type: string;
  message_id: string | number;
  payload: Record<string, any>;
  payload_json?: string;
  created_at?: number;
}
