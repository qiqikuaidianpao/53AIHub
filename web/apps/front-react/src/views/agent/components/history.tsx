import { useMemo } from 'react'
import { Modal, Input } from 'antd'
import { Dropdown } from '@km/shared-components-react'
import { SvgIcon } from '@km/shared-components-react'
import { useConversationStore } from '@/stores/modules/conversation'
import { t } from '@/locales'
import { useAgentStore } from '@/stores/modules/agent'

interface AgentHistoryProps {
  className?: string
  onCollapse?: () => void
  onNewChat?: () => void
}

export function AgentHistory({ className = '', onCollapse, onNewChat }: AgentHistoryProps) {
  const convStore = useConversationStore()
  const agentStore = useAgentStore()

  const toggleCollapse = () => {
    onCollapse?.()
  }

  const handleNewChat = () => {
    onNewChat?.()
  }

  const handleSelectConversation = (conv: Conversation.Info) => {
    // 先关闭面板
    onCollapse?.()
    // 使用 window.location 强制页面刷新，确保 useEffect 正确触发
    window.location.href = `/chat?agent_id=${conv.agent_id}&conversation_id=${conv.conversation_id}`
  }

  const handleDeleteConversation = (conv: Conversation.Info) => {
    Modal.confirm({
      title: t('chat.conversation_confirm_delete'),
      content: t('action.del'),
      okText: t('action.del'),
      cancelText: t('action.cancel'),
      okButtonProps: { danger: true },
      onOk: () => convStore.delConversation(conv)
    })
  }

  const menuItems = (item: Conversation.Info) => [
    {
      key: 'del',
      danger: true,
      label: (
        <span className="text-[#FA5151] flex items-center">
          <SvgIcon name="del" className="mr-1" />
          {t('action.del')}
        </span>
      )
    }
  ]

  const handleCommand = (key: string, item: Conversation.Info) => {
    if (key === 'del') {
      handleDeleteConversation(item)
    }
  }

  // 获取会话对应的智能体名称
  const getAgentName = (agentId: number) => {
    const agent = agentStore.findAgentByAgentId(agentId)
    return agent?.name || agent?.display_name || ''
  }

  const currentConversationId = useMemo(() => {
    return convStore.current_conversationid
  }, [convStore.current_conversationid])

  return (
    <div className={`h-full bg-white border-r border-gray-200 flex flex-col ${className}`}>
      {/* 头部区域 */}
      <div className="flex-none px-3 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <SvgIcon name="history" className="w-4 h-4 text-gray-600" />
            </div>
            <h2 className="text-base font-medium text-gray-900">{t('agent.history_conversation')}</h2>
          </div>
          <button type="button" className="text-gray-500 hover:text-gray-700" onClick={toggleCollapse}>
            <SvgIcon name="double-left" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 新会话按钮 */}
      <div className="flex-none px-3 mb-3">
        <div
          className="h-9 flex items-center justify-center cursor-pointer gap-2 border rounded-lg hover:shadow"
          onClick={handleNewChat}
        >
          <SvgIcon name="add-chat" className="w-4 h-4 mr-1 text-[#1D1E1F]" />
          <span className="text-sm text-[#1D1E1F]">{t('chat.new_chat')}</span>
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="flex flex-col gap-2">
          {convStore.conversations.map((item, index) => (
            <div
              key={item.conversation_id || `conv-${index}`}
              className={`group p-3 rounded cursor-pointer hover:bg-[#F5F6FA] ${
                currentConversationId === item.conversation_id ? 'bg-[#F5F6FA]' : ''
              }`}
              onClick={() => handleSelectConversation(item)}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary truncate">{item.title || t('chat.new_conversation')}</div>
                  {item.agent_id && (
                    <div className="text-xs text-secondary truncate mt-1">{getAgentName(item.agent_id)}</div>
                  )}
                </div>
                <Dropdown
                  menu={{
                    items: menuItems(item),
                    onClick: ({ key }) => handleCommand(key, item)
                  }}
                  trigger={['click']}
                >
                  <div
                    className="size-7 flex-center cursor-pointer invisible group-hover:visible"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SvgIcon name="more-h" />
                  </div>
                </Dropdown>
              </div>
              <div className="mt-2 text-xs text-secondary">{item.created_at}</div>
            </div>
          ))}
          {convStore.conversations.length === 0 && (
            <div className="text-center text-gray-400 py-8 text-sm">{t('common.no_data')}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AgentHistory
