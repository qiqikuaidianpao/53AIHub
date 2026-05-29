import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Empty } from 'antd'
import { SvgIcon } from '@km/shared-components-react'
import { getPublicPath } from '@/utils/config'
import { t } from '@/locales'
import { AGENT_TYPES } from '@/constants/platform/config'

const DEFAULT_IMG = '/images/default_agent.png'

interface AgentListProps {
  list: Agent.State[]
  loading?: boolean
  keyword?: string
  className?: string
}

export default function AgentList({ list, loading = false, keyword = '', className = '' }: AgentListProps) {
  const navigate = useNavigate()

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement
    const fallback = getPublicPath(DEFAULT_IMG)
    if (target.src.endsWith(fallback)) return
    target.src = fallback
  }

  const showList = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) {
      return list
    }
    return list.filter((item) => {
      return item.name.toLowerCase().includes(kw) || (item.description?.toLowerCase().includes(kw) ?? false)
    })
  }, [list, keyword])

  const highlightKeyword = (text: string, kw: string) => {
    if (!kw.trim()) return text
    const regex = new RegExp(`(${kw})`, 'gi')
    return text.replace(regex, "<span class='text-theme'>$1</span>")
  }

  // 判断是否为 Openclaw 智能体
  const isOpenclawAgent = (item: Agent.State) => {
    return item.custom_config_obj?.agent_type === AGENT_TYPES.OPENCLAW
  }

  // 获取跳转参数
  const getNavigateSearch = (item: Agent.State) => {
    if (isOpenclawAgent(item)) {
      return `?agent_id=${item.agent_id}&hide_bottom_actions=true&type=openclaw`
    }
    return `?agent_id=${item.agent_id}`
  }

  if (loading) {
    return (
      <div className={className}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start p-4 bg-[#FFF8FF] rounded-lg animate-pulse">
            <div className="w-[70px] h-[70px] bg-gray-200 rounded-full mr-4"></div>
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (showList.length === 0) {
    return (
      <div className={className}>
        <div className="col-span-full flex flex-col items-center justify-center">
          <Empty description={t('agent.no_data')} image={getPublicPath('/images/chat/completion_empty.png')} />
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {showList.map((item) => (
        <div
          key={item.agent_id}
          className="relative flex flex-col justify-between p-4 rounded-lg overflow-hidden bg-cover cursor-pointer border border-[#ECECEC] hover:shadow-md transition-all duration-300 bg-white"
          onClick={() => navigate({ pathname: '/chat', search: getNavigateSearch(item) })}
        >
          <div className="flex items-start">
            <img className="flex-none size-[50px] mr-4 rounded-full" src={item.logo} alt={item.name} onError={handleImageError} />
            <div className="flex-1 overflow-hidden">
              <h3
                className="text-base font-medium mb-1 mt-1 line-clamp-1 text-primary"
                title={item.name}
                dangerouslySetInnerHTML={{
                  __html: highlightKeyword(item.name, keyword)
                }}
              />
              <p
                className="text-sm line-clamp-2 text-placeholder"
                title={item.description}
                dangerouslySetInnerHTML={{
                  __html: highlightKeyword(item.description || '', keyword)
                }}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between">
            <div className="bg-[#F4F4F7] flex items-center px-2 py-1 gap-1 rounded-bl-lg">
              <SvgIcon
                name={
                  item.custom_config_obj?.agent_mode === 'chat'
                    ? 'chat_v2'
                    : item.custom_config_obj?.agent_mode === 'assistant'
                      ? 'agent'
                      : 'app-one'
                }
                className="h-3 w-[14px] text-[#939499]"
              />
              <p className="text-xs text-[#939499]">
                {item.custom_config_obj?.agent_mode === 'chat'
                  ? t('agent.dialogue_type')
                  : item.custom_config_obj?.agent_mode === 'assistant'
                    ? t('agent.assistant_type')
                    : t('agent.applied_type')}
              </p>
            </div>
            <div className="flex items-center text-sm text-placeholder">
              <div className="size-[14px] flex-center">
                <SvgIcon name="hot" className="w-[14px] h-[14px]" />
              </div>
              <span className="ml-1">
                {t('index.use_history', { count: item.conversation_count || 0 })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
