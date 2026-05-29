import { useState, useMemo, useEffect } from 'react'
import { Modal, Button, message, Tooltip } from 'antd'
import { SvgIcon, OverflowTooltip } from '@km/shared-components-react'
import { AGENT_TYPE_OPTIONS } from '../../platformConfig'
import { AgentBasicInfo } from '../shared/AgentBasicInfo'
import type {
  CreateAgentDialogProps,
  AgentTypeOption,
  AgentPlatformOption,
} from '../../adapters/types'
import { BACKEND_AGENT_TYPE } from '../../constants'

// 初始状态
const INITIAL_BASIC_INFO = { name: '', description: '', logo: '' }
const DEFAULT_AGENT_TYPE = BACKEND_AGENT_TYPE.ASSISTANT

// 平台分组组件
function PlatformSection({
  title,
  platforms,
  selectedPlatform,
  onSelect,
}: {
  title: string
  platforms: AgentPlatformOption[]
  selectedPlatform: string
  onSelect: (platform: AgentPlatformOption) => void
}) {
  if (platforms.length === 0) return null
  return (
    <div>
      <div className="text-sm font-medium text-[#1D1E1F] mb-3">{title}</div>
      <div className="grid grid-cols-6 gap-3">
        {platforms.map((platform) => {
          const isActive = selectedPlatform === platform.value
          return (
            <div
              key={platform.value}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                isActive
                  ? 'border-[#2563EB] bg-[#F7FAFF] text-theme'
                  : 'border-transparent bg-[#F8F9FA] text-[#333] hover:border-[#2563EB]'
              }`}
              onClick={() => onSelect(platform)}
            >
              <img src={platform.icon} className="size-6" alt={platform.label} />
              <OverflowTooltip>
                <span className="text-md leading-tight truncate">{platform.label}</span>
              </OverflowTooltip>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CreateAgentDialog({
  visible,
  onClose,
  onConfirm,
  types = AGENT_TYPE_OPTIONS,
  platformsByType,
  groupValue,
  onGroupChange,
  groupOptions,
  avatarSlot,
  t: tProp
}: CreateAgentDialogProps) {
  // Fallback translation function when t is not provided
  const t = tProp ?? ((key: string) => key)

  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<number>(types[0]?.agent_type || DEFAULT_AGENT_TYPE)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('')
  const [basicInfo, setBasicInfo] = useState(INITIAL_BASIC_INFO)

  // 重置状态
  const resetState = () => {
    setSelectedType(types[0]?.agent_type || DEFAULT_AGENT_TYPE)
    setSelectedPlatform('')
    setBasicInfo(INITIAL_BASIC_INFO)
  }

  // 表单验证
  const validate = (): string | null => {
    if (!basicInfo.name.trim()) return t('dialog.error_name_required')
    if (!basicInfo.logo.trim()) return t('dialog.error_avatar_required')
    if (!selectedPlatform) return t('dialog.error_platform_required')
    return null
  }

  // 获取当前类型对应的平台列表
  const currentPlatforms = useMemo(() => {
    return platformsByType.filter(p => p.agent_type === selectedType)
  }, [selectedType, platformsByType])

  // 将平台分为"平台内置"和"三方接入"两组
  // 平台内置：channel_type === 0（如 Prompt）
  // 三方接入：channel_type !== 0（如 OpenClaw、扣子、Dify 等）
  const builtInPlatforms = useMemo(() => {
    return currentPlatforms.filter((p) => p.channel_type === 0)
  }, [currentPlatforms])

  const thirdPartyPlatforms = useMemo(() => {
    return currentPlatforms.filter((p) => p.channel_type !== 0)
  }, [currentPlatforms])

  // 初始化选中平台
  useEffect(() => {
    if (currentPlatforms.length > 0 && !selectedPlatform) {
      const firstPlatform = builtInPlatforms[0] || thirdPartyPlatforms[0] || currentPlatforms[0]
      setSelectedPlatform(firstPlatform.value)
      if (firstPlatform.icon) {
        setBasicInfo(prev => ({ ...prev, logo: firstPlatform.icon }))
      }
    }
  }, [currentPlatforms, selectedPlatform, builtInPlatforms, thirdPartyPlatforms])

  // 类型选择
  const handleTypeSelect = (type: AgentTypeOption) => {
    if (type.disabled) return
    setSelectedType(type.agent_type)
    setSelectedPlatform('')
    setBasicInfo(INITIAL_BASIC_INFO)
  }

  // 平台选择
  const handlePlatformSelect = (platform: AgentPlatformOption) => {
    setSelectedPlatform(platform.value)
    setBasicInfo(prev => ({ ...prev, logo: platform.icon }))
  }

  // 关闭弹窗
  const handleClose = () => {
    onClose()
    resetState()
  }

  // 提交
  const handleSubmit = async () => {
    const error = validate()
    if (error) {
      message.error(error)
      return
    }

    setLoading(true)
    try {
      await onConfirm({
        agentType: selectedPlatform,
        name: basicInfo.name,
        description: basicInfo.description,
        logo: basicInfo.logo,
        groupId: groupValue,
        backend_agent_type: selectedType,
        agent_mode: platformsByType.find(p => p.value === selectedPlatform)?.agent_mode || '',
      })
      handleClose()
    } catch (err) {
      message.error(t('dialog.error_create_failed'))
      console.error('Create agent failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={visible}
      title={t('action.add')}
      width={1000}
      onCancel={handleClose}
      footer={null}
      className="add-agent-dialog"
      destroyOnClose
    >
      <div className="space-y-6">
        {/* 类型选择 */}
        <div>
          <div className="text-sm font-medium text-[#1D1E1F] mb-3">{t('common.type')}</div>
          <div className="flex gap-3">
            {types.map((type) => {
              const isActive = selectedType === type.agent_type && !type.disabled
              return (
                <Tooltip
                  key={type.agent_type}
                  title={type.disabled ? t('dialog.feature_developing') : ''}
                >
                  <div
                    className={`flex-1 rounded-lg border p-4 transition-all ${
                      type.disabled
                        ? 'border-[#E5E5E5] cursor-not-allowed opacity-60'
                        : isActive
                          ? 'border-[#2563EB] bg-[#2563EB]/5 text-theme cursor-pointer'
                          : 'border-[#E5E5E5] text-[#1D1E1F] hover:border-[#D0D0D0] cursor-pointer'
                    }`}
                    onClick={() => handleTypeSelect(type)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <SvgIcon
                        name={type.icon}
                        size={18}
                      />
                      <span className="text-sm font-medium">
                        {type.label}
                      </span>
                      {type.subLabel && (
                        <span className="text-sm font-medium">
                          {type.subLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9A9A9A] leading-5">{type.desc}</p>
                  </div>
                </Tooltip>
              )
            })}
          </div>
        </div>

        {/* 平台选择 - 分为平台内置和三方接入 */}
        <div>
          <div className="space-y-4">
            <PlatformSection
              title={t('dialog.platform_builtin')}
              platforms={builtInPlatforms}
              selectedPlatform={selectedPlatform}
              onSelect={handlePlatformSelect}
            />
            <PlatformSection
              title={t('dialog.third_party')}
              platforms={thirdPartyPlatforms}
              selectedPlatform={selectedPlatform}
              onSelect={handlePlatformSelect}
            />
          </div>
        </div>

        {/* 基本信息 */}
        <div>
          <div className="text-sm font-medium text-[#1D1E1F] mb-3">{t('dialog.basic_info')}</div>
          <AgentBasicInfo
            value={basicInfo}
            onChange={setBasicInfo}
            avatarSlot={avatarSlot}
            groupValue={groupValue}
            onGroupChange={onGroupChange}
            groupOptions={groupOptions}
            t={t}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button onClick={handleClose}>{t('action.cancel')}</Button>
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          {t('action.confirm')}
        </Button>
      </div>
    </Modal>
  )
}

export default CreateAgentDialog
