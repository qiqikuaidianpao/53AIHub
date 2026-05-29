import { useState, useMemo, useCallback, useEffect } from 'react'
import { Collapse, Tooltip, message, Spin } from 'antd'
import { CopyOutlined, SyncOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { useAgentCreateAdapter } from '../adapters'
import { useAgentFormStore } from '../store'
import { UseScope } from '../components/shared/UseScope'
import { AgentUsageGuide, type UseCaseItem } from '../components/shared/AgentUsageGuide'

export interface OpenclawConfigProps {
  className?: string
  /** 头像上传组件 slot（编辑弹窗使用） */
  avatarSlot?: (props: { value: string; onChange: (logo: string) => void }) => React.ReactNode
}

/**
 * Openclaw 配置组件
 * 只渲染配置内容（Collapse），不含 Header 和编辑弹框
 * 用于嵌入三列布局
 */
export function OpenclawConfig({ className, avatarSlot }: OpenclawConfigProps) {
  const adapter = useAgentCreateAdapter()
  const t = adapter.t || ((key: string) => key)
  const GroupSelect = adapter.GroupSelectComponent
  const ImageUploadComponent = adapter.ImageUploadComponent

  // 从 store 读取状态
  const formData = useAgentFormStore((state) => state.form_data)
  const agentId = useAgentFormStore((state) => state.agent_id)
  const loading = useAgentFormStore((state) => state.loading)
  const setFormData = useAgentFormStore((state) => state.setFormData)
  const setAgentData = useAgentFormStore((state) => state.setAgentData)
  const setLoading = useAgentFormStore((state) => state.setLoading)

  const [activeCollapse, setActiveCollapse] = useState(['config', 'process', 'scope', 'usage'])

  // 使用说明数据
  const [useCases, setUseCases] = useState<UseCaseItem[]>([])

  // 同步 useCases 到 formData
  useEffect(() => {
    setUseCases(formData.use_cases || [])
  }, [formData.use_cases])

  // 从 formData 获取配置
  const botId = useMemo(() => {
    return formData.bot_id?.toString() || ''
  }, [formData.bot_id])

  const secret = useMemo(() => {
    return formData.custom_config?.openclaw_app_secret || ''
  }, [formData.custom_config?.openclaw_app_secret])

  const wsUrl = useMemo(() => {
    const apiHost = adapter.apiHost || ''
    return `ws://${apiHost.replace('https://', '').replace('http://', '')}/api/v1/openclaw/ws/connect`
  }, [adapter.apiHost])

  // 配置文本（用于复制）
  const configText = useMemo(
    () => `${t('agent.bot_id')}：${botId}\n${t('agent.secret')}：${secret}\n${t('agent.ws_url')}：${wsUrl}`,
    [botId, secret, wsUrl, t]
  )

  // 复制到剪贴板
  const handleCopy = useCallback(async (text: string) => {
    if (adapter.copyToClip) {
      const success = await adapter.copyToClip(text)
      if (success) {
        message.success(t('action.copy_success'))
      }
    }
  }, [adapter, t])

  // 重置密钥
  const resetSecret = useCallback(async () => {
    if (adapter.resetSecret && agentId) {
      try {
        const data = await adapter.resetSecret(agentId)
        setFormData({
          custom_config: {
            ...formData.custom_config,
            openclaw_app_secret: data.secret,
          },
        })
        message.success(t('action.reset_success') || t('action.success'))
      } catch (error) {
        // Ignore
      }
    }
  }, [adapter, agentId, formData.custom_config, setFormData, t])

  // 使用说明变更
  const handleUseCasesChange = useCallback((newUseCases: UseCaseItem[]) => {
    setUseCases(newUseCases)
    setFormData({ use_cases: newUseCases })
  }, [setFormData])

  // Collapse items
  const collapseItems = [
    // 访问配置
    {
      key: 'config',
      label: t('agent.access_config'),
      children: (
        <div className="space-y-4 px-2">
          {/* Bot ID */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-20 shrink-0">
              <span className="text-sm text-[#333]">{t('agent.bot_id')}</span>
              <Tooltip title={t('agent.bot_id_tooltip')}>
                <QuestionCircleOutlined className="text-[#999] cursor-pointer" style={{ fontSize: 14 }} />
              </Tooltip>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#E9EBF2] rounded">
              <span className="text-sm text-[#333] flex-1">{botId}</span>
              <Tooltip title={t('action.copy')}>
                <CopyOutlined
                  className="cursor-pointer text-[#999] hover:text-[#666]"
                  style={{ fontSize: 16 }}
                  onClick={() => handleCopy(botId)}
                />
              </Tooltip>
            </div>
          </div>
          {/* Secret */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-20 shrink-0">
              <span className="text-sm text-[#333]">{t('agent.secret')}</span>
              <Tooltip title={t('agent.secret_tooltip')}>
                <QuestionCircleOutlined className="text-[#999] cursor-pointer" style={{ fontSize: 14 }} />
              </Tooltip>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#E9EBF2] rounded">
              <span className="text-sm text-[#333] flex-1 font-mono">{secret}</span>
              <Tooltip title={t('action.reset')}>
                <SyncOutlined
                  className="cursor-pointer text-[#999] hover:text-[#666]"
                  style={{ fontSize: 16 }}
                  onClick={resetSecret}
                />
              </Tooltip>
              <Tooltip title={t('action.copy')}>
                <CopyOutlined
                  className="cursor-pointer text-[#999] hover:text-[#666]"
                  style={{ fontSize: 16 }}
                  onClick={() => handleCopy(secret)}
                />
              </Tooltip>
            </div>
          </div>
          {/* WS Url */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 w-20 shrink-0">
              <span className="text-sm text-[#333]">{t('agent.ws_url')}</span>
              <Tooltip title={t('agent.ws_url_tooltip')}>
                <QuestionCircleOutlined className="text-[#999] cursor-pointer" style={{ fontSize: 14 }} />
              </Tooltip>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#E9EBF2] rounded">
              <span className="text-sm text-[#333] flex-1">{wsUrl}</span>
              <Tooltip title={t('action.copy')}>
                <CopyOutlined
                  className="cursor-pointer text-[#999] hover:text-[#666]"
                  style={{ fontSize: 16 }}
                  onClick={() => handleCopy(wsUrl)}
                />
              </Tooltip>
            </div>
          </div>
        </div>
      ),
    },
    // 接入流程
    {
      key: 'process',
      label: t('agent.access_process'),
      children: (
        <div className="space-y-6 px-2">
          {/* Step 1 */}
          <div>
            <p className="text-sm text-[#9CA3AF] mb-2">{t('agent.step1_install_plugin')}</p>
            <div className="flex items-center gap-2 rounded px-3 py-2 bg-[#F5F5F7]">
              <code className="flex-1 text-sm text-[#333] font-mono">
                npm install @53ai/53ai-openclaw
              </code>
              <Tooltip title={t('action.copy')}>
                <CopyOutlined
                  className="cursor-pointer text-[#999] hover:text-[#666]"
                  onClick={() => handleCopy('npm install @53ai/53ai-openclaw')}
                />
              </Tooltip>
            </div>
          </div>
          {/* Step 2 */}
          <div>
            <p className="text-sm text-[#9CA3AF] mb-2">{t('agent.step2_config_secret')}</p>
            <div className="flex gap-2 px-3 py-2 bg-[#F5F5F7]">
              <div className="flex-1 rounded space-y-3">
                <div className="text-sm text-[#333]">{t('agent.bot_id')}：{botId}</div>
                <div className="text-sm text-[#333]">{t('agent.secret')}：{secret}</div>
                <div className="text-sm text-[#333]">{t('agent.ws_url')}：{wsUrl}</div>
              </div>
              <div className="flex justify-end mt-2">
                <Tooltip title={t('action.copy')}>
                  <CopyOutlined
                    className="cursor-pointer text-[#999] hover:text-[#666]"
                    onClick={() => handleCopy(configText)}
                  />
                </Tooltip>
              </div>
            </div>
          </div>
          {/* Step 3 */}
          <div>
            <p className="text-sm text-[#9CA3AF] mb-2">{t('agent.step3_restart_service')}</p>
            <div className="flex items-center gap-2 rounded px-3 py-2 bg-[#F5F5F7]">
              <code className="flex-1 text-sm text-[#333]">openclaw gateway restart</code>
              <Tooltip title={t('action.copy')}>
                <CopyOutlined
                  className="cursor-pointer text-[#999] hover:text-[#666]"
                  onClick={() => handleCopy('openclaw gateway restart')}
                />
              </Tooltip>
            </div>
          </div>
        </div>
      ),
    },
    // 权限配置（仅后台显示）
    GroupSelect && {
      key: 'scope',
      label: t('usage_range'),
      children: <div className="px-2"><UseScope /></div>,
    },
    // 使用说明
    {
      key: 'usage',
      label: t('agent.usage_guide_title'),
      children: (
        <AgentUsageGuide
          value={useCases}
          onChange={handleUseCasesChange}
          ImageUploadComponent={ImageUploadComponent}
          t={t}
          className="px-2"
        />
      ),
    },
  ].filter(Boolean) as any[]

  return (
    <div className={`flex flex-col overflow-hidden ${className || ''}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
          <Spin size="large" />
        </div>
      )}
      <Collapse
        activeKey={activeCollapse}
        ghost
        onChange={(keys) => setActiveCollapse(keys as string[])}
        expandIconPosition="start"
        items={collapseItems}
      />
    </div>
  )
}

export default OpenclawConfig
