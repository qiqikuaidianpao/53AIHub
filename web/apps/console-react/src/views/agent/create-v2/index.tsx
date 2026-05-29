/**
 * Agent 创建页面 v2 - console-react 版本
 *
 * 所有平台统一使用 Tab 三列布局
 * Header 包含编辑入口（点击编辑图标打开弹框）
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Modal, message } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { t } from '@/locales'
import { PageLayoutContent } from '@/components/PageLayout'
import { getSimpleDateFormatString } from '@km/shared-utils'
import {
  AdapterProvider,
  useAgentCreateAdapter,
  useAgentFormStore,
  AgentDrawerRef,
  CreatePageLayout,
  AgentBasicInfo,
  OpenclawConfig,
  AGENT_TYPES,
  createPlatformsByType
} from '@km/shared-business/agent-create'
import { eventBus } from '@km/shared-utils'
import { img_host } from '@/utils/config'
import { consoleAgentAdapter } from '@/adapters/agent-create-adapter'
import { attachDefaultImg } from '@/directive/default-img'
import { AgentDataTab } from './DataTab'
import { AgentIntegrateTab } from './IntegrateTab'

/**
 * 头像上传 slot 组件
 * 需要独立组件以正确使用 useRef
 */
function AvatarSlot({
  value,
  onChange,
}: {
  value: string
  onChange: (logo: string) => void
}) {
  const adapter = useAgentCreateAdapter()
  const ImageUploadComponent = adapter.ImageUploadComponent
  const imageUploadRef = useRef<{ trigger: () => void }>(null)

  if (!ImageUploadComponent) return null

  return (
    <div className="flex flex-col items-center gap-2">
      <ImageUploadComponent
        ref={imageUploadRef}
        className="!size-[72px]"
        value={value}
        onChange={onChange}
      />
      <Button
        className="w-[72px] text-xs"
        onClick={() => imageUploadRef.current?.trigger()}
      >
        {t('change_avatar')}
      </Button>
    </div>
  )
}

/**
 * 页面内容组件（Tab 三列布局，所有平台统一）
 */
function AgentCreatePageContent() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const adapter = useAgentCreateAdapter()

  // Tab 状态
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'config'
  })

  // 编辑弹框状态
  const [editVisible, setEditVisible] = useState(false)
  const [editBasicInfo, setEditBasicInfo] = useState({ name: '', description: '', logo: '' })

  // 从 store 读取状态
  const saving = useAgentFormStore((state) => state.saving)
  const loading = useAgentFormStore((state) => state.loading)
  const initializing = useAgentFormStore((state) => state.initializing)
  const formData = useAgentFormStore((state) => state.form_data)
  const agentType = useAgentFormStore((state) => state.agent_type)
  const agentId = useAgentFormStore((state) => state.agent_id)
  const agentData = useAgentFormStore((state) => state.agent_data)
  const groupOptions = useAgentFormStore((state) => state.group_options)
  const setFormData = useAgentFormStore((state) => state.setFormData)
  const setAgentData = useAgentFormStore((state) => state.setAgentData)

  const infoDrawerRef = useRef<AgentDrawerRef>(null)
  const channelConfig = useRef<Record<string, any>>({})

  // 从 URL 获取类型参数（用于初始渲染时计算类型）
  const urlTypeParam = searchParams.get('type')

  // 获取当前平台配置

  // 获取类型名称（backend_agent_type: 0=对话, 1=补全, 2=助手）
  const getTypeName = (backendAgentType?: number) => {
    if (backendAgentType === 0) return t('agent_type_chat_v2')
    if (backendAgentType === 1) return t('agent_type_completion_v2')
    if (backendAgentType === 2) return t('agent_type.assistant')
    return '--'
  }

  // 根据 agent_type 推断 backend_agent_type
  const getBackendAgentType = (agentTypeValue: string): number | undefined => {
    // 如果 agentType 为空或无效，返回 undefined
    if (!agentTypeValue) return undefined
    const config = adapter.getAgentConfig?.(agentTypeValue)
    const mode = config?.mode
    if (mode === 'completion') return 1 // 应用型/工作流
    if (mode === 'assistant') return 2 // 助理型
    if (mode === 'chat') return 0 // 对话型
    return undefined
  }

  // 优先使用 agentData 中的 backend_agent_type，其次用 URL 参数推断，最后用 store 中的 agentType
  // 注意：创建模式下 agentData 为空，需要使用 URL 参数 (urlTypeParam) 而非 store 中的 agentType
  // 因为 store 更新可能有延迟，第一次渲染时 agentType 可能是旧值
  const backendAgentType = agentData?.backend_agent_type ?? getBackendAgentType(urlTypeParam || agentType)
  const typeName = getTypeName(backendAgentType)

  // 判断是否为 Openclaw
  const isOpenclaw = agentType === AGENT_TYPES.OPENCLAW

  // 格式化最近保存时间
  const lastSavedAt = agentId && agentData?.updated_time
    ? getSimpleDateFormatString({ date: agentData.updated_time, format: 'YYYY-MM-DD hh:mm:ss' })
    : ''

  // 编辑弹窗的 avatarSlot
  const avatarSlot = adapter.ImageUploadComponent
    ? ({ value, onChange }: { value: string; onChange: (logo: string) => void }) => (
        <AvatarSlot value={value} onChange={onChange} />
      )
    : undefined

  // 保存
  const onSave = async () => {
    const store = useAgentFormStore.getState()
    if (store.saving) return

    useAgentFormStore.setState({ saving: true })

    try {
      if (isOpenclaw) {
        // Openclaw 直接调用 store 的保存方法
        await store.saveAgentData({ hideToast: true })
      } else {
        // 其他平台通过 drawer 保存
        await infoDrawerRef.current?.handleSave()
      }
      message.success(t('action_save_success'))
      setAgentData({
        ...useAgentFormStore.getState().agent_data,
        updated_time: Date.now(),
      })

      const currentState = useAgentFormStore.getState()
      if (currentState.is_new) {
        eventBus.emit('agent-create')
        if (currentState.agent_id) {
          navigate(
            {
              pathname: '/agent/create-v2',
              search: `?type=${currentState.agent_type}&agent_id=${currentState.agent_id}`,
            },
            { replace: true },
          )
        }
      } else {
        eventBus.emit('agent-update')
      }
    } finally {
      useAgentFormStore.setState({ saving: false })
    }
  }

  // Tab 切换
  const handleTabChange = (key: string) => {
    setActiveTab(key)
  }

  // 打开编辑弹框
  const handleEditOpen = useCallback(() => {
    setEditBasicInfo({
      name: formData.name || '',
      description: formData.description || '',
      logo: formData.logo || '',
    })
    setEditVisible(true)
  }, [formData.name, formData.description, formData.logo])

  // 保存编辑
  const handleEditSave = useCallback(() => {
    setFormData({
      name: editBasicInfo.name,
      description: editBasicInfo.description,
      logo: editBasicInfo.logo,
    })
    setEditVisible(false)
  }, [setFormData, editBasicInfo])

  // 分组变更
  const handleGroupChange = (value: number) => {
    setFormData({ group_id: value })
  }

  // 初始化
  const agentIdParam = searchParams.get('agent_id')
  const typeParam = searchParams.get('type')

  useEffect(() => {
    const agentId = agentIdParam || '0'
    const agentTypeFromUrl = (typeParam as string) || adapter.defaultPlatform
    const isNew = searchParams.get('is_new') === 'true'

    // 如果 URL 有 type，立即更新 store
    if (typeParam) {
      useAgentFormStore.setState({ agent_type: typeParam })
    }

    const init = async () => {
      if (!isNew && agentId) {
        // 编辑模式：先重置状态，再加载数据，最后打开 drawer
        useAgentFormStore.getState().reset()
        useAgentFormStore.setState({
          is_new: false,
          agent_id: agentId,
          initializing: true,
        })

        // 加载详情数据和分组选项
        await useAgentFormStore.getState().loadDetailData()
        await useAgentFormStore.getState().loadGroupOptions()

        // 获取加载后的 agent_type
        const loadedAgentType = useAgentFormStore.getState().agent_type

        // 设置平台配置
        if (loadedAgentType !== 'prompt') {
          const config = adapter.getAgentConfig?.(loadedAgentType) || {}
          channelConfig.current.name = config.channelName || ''
          channelConfig.current.channel_type = config.channelType || 0
        }

        useAgentFormStore.setState({ initializing: false })

        // 打开 drawer（cache 模式，不重置已加载的数据）
        infoDrawerRef.current?.open({
          agent_type: loadedAgentType,
          agent_id: agentId,
          cache: true,
          data: {
            channel_config: channelConfig.current,
          },
        })
      } else {
        // 创建模式：打开 drawer（cache 模式，保留添加弹框写入的数据）
        const agentInfo = createPlatformsByType(img_host).find((item) => item.value === agentTypeFromUrl) || { label: '', icon: '' }
        useAgentFormStore.setState({
          is_new: true,
          agent_id: 0,
          agent_type: agentTypeFromUrl,
        })

        setFormData({
          ...formData,
          name: formData.name || agentInfo.label,
          logo: formData.logo || agentInfo.icon,
        })

        infoDrawerRef.current?.open({
          agent_type: agentTypeFromUrl,
          agent_id: 0,
          cache: true,
          data: {
            channel_config: {},
          },
        })
      }
    }

    init()

    return () => {
      useAgentFormStore.getState().reset()
    }
  }, [agentIdParam, typeParam, adapter])

  // 加载分组选项
  useEffect(() => {
    useAgentFormStore.getState().loadGroupOptions()
  }, [])

  // 渲染内容区
  const renderContent = () => {
    switch (activeTab) {
      case 'config':
        // Openclaw 使用专用配置组件
        if (isOpenclaw) {
          return (
            <div className="h-full flex-1 flex min-h-0">
              {/* 左侧配置 */}
              <div className="w-1/2 border-r overflow-y-auto p-4">
                <OpenclawConfig avatarSlot={avatarSlot} />
              </div>
              {/* 右侧预览 */}
              <div className="w-1/2 overflow-hidden bg-white">
                <adapter.InlinePreviewComponent className="h-full" />
              </div>
            </div>
          )
        }
        // 其他平台使用 CreatePageLayout
        return (
          <CreatePageLayout
            drawerRef={infoDrawerRef}
            loading={loading}
            initializing={initializing}
            channelConfig={channelConfig.current}
            onSuccess={() => eventBus.emit('agent-change')}
            embedded
          />
        )
      case 'data':
        return <AgentDataTab agentId={agentId} />
      case 'integrate':
        return <AgentIntegrateTab agentId={agentId} />
      default:
        return null
    }
  }

  // Tab 配置
  const tabItems = [
    { key: 'config', label: t('agent.tab_config') },
    { key: 'data', label: t('agent.tab_data') },
    { key: 'integrate', label: t('agent.tab_integrate') },
  ]

  return (
    <PageLayoutContent
      className="fixed inset-0 !px-0 !py-0 bg-[#F7F9FC]"
      header={{
        title: (
          <div className="flex items-center gap-2">
            <span>{formData.name || t('agent_create_title')}</span>
            <EditOutlined
              className="cursor-pointer text-[#999] hover:text-[#666]"
              style={{ fontSize: 14 }}
              onClick={handleEditOpen}
            />
          </div>
        ),
        back: true,
        onBack: () => navigate('/agent'),
        titlePrefix: formData.logo ? (
          <img
            src={formData.logo}
            className="w-8 rounded"
            alt=""
            onError={(e) => {
              attachDefaultImg(e.currentTarget)
            }}
          />
        ) : (
          <div className="size-8 rounded" />
        ),
        description: (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 truncate max-w-[200px]">
              {formData.description || t('agent.no_desc')}
            </span>
            <span className="px-2 py-0.5 bg-white rounded text-[#666] text-xs">
              {typeName}
            </span>
            <span className="px-2 py-0.5 bg-white rounded text-[#666] text-xs">
              {t(`agent_app.${agentType}`) || '--'}
            </span>
          </div>
        ),
        center: (
          <div className="flex gap-1">
            { !!(agentId) && tabItems.map((item) => (
              <div
                key={item.key}
                className={`h-8 px-5 flex items-center cursor-pointer rounded-md ${
                  activeTab === item.key ? 'bg-white text-[#2563EB] shadow' : 'text-[#2029459E] hover:bg-white hover:text-[#2563eb]'
                }`}
                onClick={() => handleTabChange(item.key)}
              >
                {item.label}
              </div>
            ))}
          </div>
        ),
        right: (
          <div className="flex items-center gap-3">
            {lastSavedAt && (
              <span className="text-xs text-placeholder">
                {t('agent.last_saved')}：{lastSavedAt}
              </span>
            )}
            <Button type="primary" loading={saving} onClick={onSave}>
              {t('action_publish')}
            </Button>
          </div>
        ),
      }}
      headerClassName="h-16 px-4 border-b border-[#E9EEF7]"
      contentClassName="flex-1 flex overflow-hidden !bg-[#F7F7FA]"
      scrollable={false}
    >
      {renderContent()}
      {/* 编辑基本信息弹框 */}
      <Modal
        open={editVisible}
        title={t('agent.edit_info')}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditSave}
        width="50%"
      >
        <AgentBasicInfo
          value={editBasicInfo}
          onChange={setEditBasicInfo}
          avatarSlot={avatarSlot}
          groupValue={formData.group_id}
          onGroupChange={handleGroupChange}
          groupOptions={groupOptions}
          t={t}
        />
      </Modal>
    </PageLayoutContent>
  )
}

export function AgentCreatePageV2() {
  return (
    <AdapterProvider adapter={consoleAgentAdapter}>
      <AgentCreatePageContent />
    </AdapterProvider>
  )
}

export default AgentCreatePageV2
