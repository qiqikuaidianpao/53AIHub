import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, message } from 'antd'
import { Dropdown } from '@km/shared-components-react'
import { PlusOutlined, EditOutlined, DeleteOutlined, MoreOutlined } from '@ant-design/icons'
import { SvgIcon } from '@km/shared-components-react'
import { useAgentStore } from '@/stores/modules/agent'
import agentsApi from '@/api/modules/agents'
import { checkPermission } from '@/utils/permission'
import AddMyList from './AddMyList'
import { t } from '@/locales'
import { getPublicPath } from '@/utils/config'

const DEFAULT_IMG = '/images/default_agent.png'

interface MyListProps {
  keyword?: string
  sort?: 'created_time' | 'updated_time'
  className?: string
  onRefresh?: () => void
}

export function MyList({ keyword = '', sort = 'created_time', className = '', onRefresh }: MyListProps) {
  const navigate = useNavigate()
  const agentStore = useAgentStore()
  const [showAddDialog, setShowAddDialog] = useState(false)

  const filteredList = useMemo(() => {
    let list = agentStore.myAgentList

    // Keyword search
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      list = list.filter((item) => {
        return item.name.toLowerCase().includes(kw) || (item.description?.toLowerCase().includes(kw) ?? false)
      })
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'created_time':
          return (b.created_time || 0) - (a.created_time || 0)
        case 'updated_time':
          return (b.updated_time || 0) - (a.updated_time || 0)
        default:
          return 0
      }
    })

    return list
  }, [agentStore.myAgentList, keyword, sort])

  const handleAddAgent = () => {
    checkPermission({
      onClick: () => {
        setShowAddDialog(true)
      }
    })
  }

  const handleCardClick = (item: Agent.State) => {
    navigate({ pathname: '/chat', search: `?agent_id=${item.agent_id}&hide_bottom_actions=true&from=my` })
  }

  const handleCommand = async (command: string, item: Agent.State) => {
    if (command === 'edit') {
      navigate({ pathname: '/agent/create-v2', search: `?type=openclaw&id=${item.agent_id}` })
    } else if (command === 'delete') {
      Modal.confirm({
        title: t('agent.tip'),
        content: t('agent.confirm_delete_agent'),
        okText: t('action.ok'),
        cancelText: t('action.cancel'),
        onOk: async () => {
          try {
            await agentsApi.my.delete(item.agent_id)
            message.success(t('agent.delete_success'))
            onRefresh?.()
          } catch (error) {
            // Delete failed or cancelled
          }
        }
      })
    }
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement
    const fallback = getPublicPath(DEFAULT_IMG)
    if (target.src.endsWith(fallback)) return
    target.src = fallback
  }

  return (
    <div className={className}>
      {/* Add card */}
      <div
        className="relative flex items-center justify-center p-4 rounded-lg overflow-hidden border border-[#E8EEFA] bg-[#F7FAFF] hover:bg-[#F5F8FF] cursor-pointer transition-all duration-300 h-[150px]"
        onClick={handleAddAgent}
      >
        <div className="size-10 rounded-lg bg-[#E6EEFF] flex items-center justify-center mr-2">
          <PlusOutlined style={{ fontSize: 16, color: '#2563EB' }} />
        </div>
        <span className="text-sm text-[#2563EB]">{t('action.add')}</span>
      </div>

      {/* Loading skeleton */}
      {agentStore.myAgentLoading && (
        <>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col p-4 rounded-lg border border-[#ECECEC] min-h-[160px]">
              <div className="flex items-start flex-1">
                <div className="w-[48px] h-[48px] bg-gray-200 rounded-lg mr-3 flex-none"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-4"></div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Agent cards */}
      {!agentStore.myAgentLoading && filteredList.length > 0 && (
        <>
          {filteredList.map((item) => (
            <div
              key={item.agent_id}
              className="relative flex flex-col p-4 rounded-lg overflow-hidden border border-[#ECECEC] hover:shadow-md transition-all duration-300 bg-white h-[150px] cursor-pointer"
            >
              <div className="flex items-start flex-1" onClick={() => handleCardClick(item)}>
                <img
                  className="flex-none size-[48px] mr-3 rounded-lg object-cover"
                  src={item.logo}
                  alt={item.name}
                  onError={handleImageError}
                />
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-base font-medium mb-2 line-clamp-1 text-primary" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="text-sm text-placeholder line-clamp-2 leading-relaxed" title={item.description}>
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="bg-[#F4F4F7] flex items-center px-2 py-1 gap-1 rounded-bl-lg">
                  <SvgIcon name="agent" className="h-3 w-[14px] text-[#939499]" />
                  <p className="text-xs text-[#939499]">Openclaw</p>
                </div>
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'edit',
                        icon: <EditOutlined style={{ fontSize: 16 }} />,
                        label: t('action.edit')
                      },
                      {
                        key: 'delete',
                        danger: true,
                        icon: <DeleteOutlined style={{ fontSize: 16 }} />,
                        label: t('action.delete')
                      }
                    ],
                    onClick: ({ key }) => handleCommand(key, item)
                  }}
                >
                  <div
                    className="size-8 flex items-center justify-center cursor-pointer hover:bg-[#F5F5F7] rounded-md border"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreOutlined style={{ fontSize: 14, transform: 'rotate(90deg)' }} />
                  </div>
                </Dropdown>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add dialog */}
      <AddMyList
        visible={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={() => {
          onRefresh?.()
        }}
      />
    </div>
  )
}

export default MyList
