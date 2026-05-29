import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreOutlined, DeleteOutlined } from '@ant-design/icons'
import { Button, Switch, Tag, Tooltip, message, Modal } from 'antd'
import { Dropdown } from '@km/shared-components-react'
import type { MenuProps } from 'antd'
import { SvgIcon } from '@km/shared-components-react'
import { StarRating } from '@/components/StarRating'
import { useSkillsStore } from '@/stores/modules/skills'
import { skillApi } from '@/api/modules/skill'
import { calculateAverageScore } from '@/api/modules/skill/transform'
import type { Skill } from '@/api/modules/skill/types'

interface SkillCardProps {
  skill: Skill
  type: 'explore' | 'my'
  onAdd?: (id: string) => void
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, type, onAdd }) => {
  const navigate = useNavigate()
  const skillsStore = useSkillsStore()

  const isEnabled = skill.binding_status === 'enabled'

  const rating = useMemo(() => calculateAverageScore(skill), [skill])

  const handleClick = () => {
    navigate({
      pathname: '/skill-detail',
      search: `?id=${skill.id}&type=${type}`
    })
  }

  const handleToggle = async (checked: boolean) => {
    const newStatus = checked ? 'enabled' : 'disabled'
    const bindingId = skill.binding_id

    if (!bindingId) {
      message.error('技能绑定ID不存在')
      return
    }

    try {
      await skillApi.updateMySkillStatus(bindingId, { status: newStatus })
      await skillsStore.loadMySkillList(true, true) // silent=true 不触发骨架屏
      await skillsStore.loadSkillList({ isRefresh: true })
    } catch (error) {
      skill.binding_status = checked ? 'disabled' : 'enabled'
      message.error('状态更新失败，请重试')
    }
  }

  const handleAdd = async () => {
    if (skill.added) return

    try {
      await skillApi.addToMy(skill.id)
      await skillsStore.loadSkillList({ isRefresh: true })
      await skillsStore.loadMySkillList(true)
      message.success('添加成功')
      onAdd?.(skill.id)
    } catch (error) {
      message.error('添加失败，请重试')
    }
  }

  const handleUse = () => {
    if (!isEnabled) {
      message.warning('请先启用技能再使用')
      return
    }

    navigate({
      pathname: '/index',
      search: `?skill_id=${skill.id}&type=${type}`
    })
  }

  const handleCommand = async (command: string) => {
    if (command === 'delete') {
      Modal.confirm({
        title: '提示',
        content: `确认删除 ${skill.display_name} 技能吗？`,
        okType: 'danger',
        onOk: async () => {
          await skillApi.deleteMySkill(skill.binding_id)
          message.success('删除成功')
          await skillsStore.loadMySkillList(true)
          await skillsStore.loadSkillList({ isRefresh: true })
        }
      })
    }
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'delete',
      label: (
        <div className="flex items-center text-red-500">
          <DeleteOutlined className="mr-2" />
          删除
        </div>
      )
    }
  ]

  const isDisabled = skill.admin_status === 'disabled'
  const isGrayscale = type === 'my' && !isEnabled

  return (
    <Tooltip title={isDisabled ? '当前技能已禁用，请联系管理员' : ''} placement="top">
      <div
        className={`bg-white border border-[#E9EEF7] rounded-xl p-5 hover:shadow-lg transition-all duration-300 group cursor-pointer flex flex-col h-full relative ${isDisabled ? 'cursor-not-allowed' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`w-12 h-12 bg-[#F0F2F5] rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
          >
            <SvgIcon name="skill" size={24} color="#2563EB" />
          </div>

          <div className="flex-1 h-full flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <div
                className={`flex items-center gap-2 min-w-0 transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
              >
                <h3 className="text-base font-bold text-gray-900 truncate">
                  {skill.display_name}
                </h3>
                <Tag className="shrink-0 text-xs rounded-3xl truncate max-w-[80px]" title={skill.version}>{skill.version}</Tag>
              </div>

              {type === 'my' && (
                <Switch
                  checked={isEnabled}
                  disabled={isDisabled}
                  onClick={(_, e) => e.stopPropagation()}
                  onChange={handleToggle}
                />
              )}
            </div>
            <p
              className={`text-xs text-placeholder max-w-full truncate transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
            >
              {skill.skill_name}
            </p>
          </div>
        </div>

        <p
          className={`text-sm text-placeholder line-clamp-2 mb-5 flex-1 leading-relaxed transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
        >
          {skill.description}
        </p>

        {type === 'explore' && (
          <div
            className={`flex items-center justify-between pt-5 border-t border-[#E6E8EB] transition-all ${isGrayscale ? 'grayscale opacity-60' : ''}`}
          >
            <div className="flex items-center">
              <StarRating value={rating} gap="sm" />
            </div>

            <Button
              type="primary"
              disabled={skill.added}
              size="small"
              className={`!px-4 rounded ${skill.added ? 'opacity-60' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                handleAdd()
              }}
            >
              {skill.added ? '已添加' : '添加'}
            </Button>
          </div>
        )}

        {type === 'my' && (
          <div className="flex items-center gap-2 border-t border-gray-50 mt-auto">
            <Button
              disabled={isDisabled}
              onClick={(e) => {
                e.stopPropagation()
                handleUse()
              }}
              className="flex-1"
            >
              工作台使用
            </Button>

            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                disabled={isDisabled}
                trigger={['click']}
                menu={{ items: menuItems, onClick: (e) => handleCommand(e.key) }}
                placement="bottomRight"
              >
                <Button
                  disabled={isDisabled}
                  className="!p-2"
                >
                  <MoreOutlined className="rotate-90" />
                </Button>
              </Dropdown>
            </div>
          </div>
        )}
      </div>
    </Tooltip>
  )
}

export default SkillCard