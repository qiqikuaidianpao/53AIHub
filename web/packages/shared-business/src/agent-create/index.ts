// Adapters
export {
  AdapterProvider,
  AdapterContext,
  useAgentCreateAdapter,
  useSupportedPlatforms,
} from './adapters'

export type {
  AgentType,
  ConfigKey,
  GroupOption,
  ModelOption,
  ChannelOption,
  AgentFormData,
  Settings,
  CustomConfig,
  CompletionParams,
  FileParseConfig,
  ImageParseConfig,
  SuggestedQuestion,
  FieldItem,
  RelateAgent,
  PageLayoutProps,
  ModelSelectProps,
  GroupSelectProps,
  IAgentCreateAdapter,
  AdapterContextValue,
  AdapterProviderProps,
  // CreateAgentDialog types
  AgentTypeOption,
  AgentPlatformOption,
  CreateAgentDialogProps,
  CreateAgentDialogResult,
  AvatarSlotProps,
} from './adapters'

// Types (includes default value factories)
export type {
  AgentFormState,
  AgentFormActions,
  AgentFormStore,
  AgentFormRef,
  UseAgentFormReturn,
  ChannelConfigData,
  ChannelFormState,
} from './types'

export {
  getDefaultSettings,
  getDefaultCustomConfig,
  getInitialFormData,
  getDefaultFieldItem,
  getInitialState,
} from './types'

// Store
export { useAgentFormStore } from './store'

// Hooks
export { useAgentForm, usePlatformChannel } from './hooks'
export type { UsePlatformChannelOptions, UsePlatformChannelReturn } from './hooks'

// Components
export {
  AgentDrawer,
  AgentGuide,
  CreatePageLayout,
  ChannelConfigContext,
  useChannelConfig,
  AgentBasicInfo,
  AgentUsageGuide,
  AgentInfo,
  AgentTypeSelector,
  UseScope,
  BaseConfig,
  ExpandConfig,
  FieldInput,
  FieldInputSetting,
  LimitConfig,
  RelateAgents,
  RelateAgentsDialog,
  RelateAgentsSetting,
  Chat,
  Completion,
} from './components'

export type {
  AgentDrawerRef,
  ChannelConfig,
  CreatePageLayoutProps,
  AgentBasicInfoProps,
  AgentBasicInfoValue,
  AgentUsageGuideProps,
  UseCaseItem,
  ChannelItem,
  CaseItem,
  SceneItem,
  ChatRef,
  CompletionRef,
} from './components'

// Constants
export { AGENT_TYPES, BACKEND_AGENT_TYPE, AGENT_MODES } from './constants'
export type { AgentPlatformType } from './constants'

// AgentForm (platform router)
export { AgentForm } from './platform'
export type { AgentFormRef as PlatformAgentFormRef } from './platform'

// Openclaw config component
export { OpenclawConfig } from './platform/Openclaw'
export type { OpenclawConfigProps } from './platform/Openclaw'

// Language pack
export { agentCreateMessages } from './locales'

// CreateAgentDialog (add agent)
export { CreateAgentDialog } from './components/add'

// Platform config
export {
  AGENT_TYPE_OPTIONS,
  createPlatformsByType,
  createFrontPlatformsByType,
  createConsoleTypeOptions,
  createFrontTypeOptions,
} from './platformConfig'
