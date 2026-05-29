import { useState, useMemo } from 'react'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { Search, Tabs } from '@km/shared-components-react'
import { useAgentStore } from '@/stores/modules/agent'
import { useIsSoftStyle } from '@/stores/modules/enterprise'
import AgentList from './list'
import { t } from '@/locales'

export function ExploreAgent() {
  const [keyword, setKeyword] = useState('')
  const [groupId, setGroupId] = useState(0)
  const loading = useState(false)[0]

  const agentStore = useAgentStore()
  const isSoftStyle = useIsSoftStyle()

  const showAgentList = useMemo(() => {
    let list = groupId === 0
      ? agentStore.agentList
      : agentStore.agentList.filter((item) => item.group_id === groupId)
    list = list.filter((item) => item.user_group_ids && item.user_group_ids.length > 0)
    return list
  }, [agentStore.agentList, groupId])

  const tabItems = useMemo(() => {
    return agentStore.categorys.map((cat) => ({
      key: String(cat.group_id),
      label: cat.group_name
    }))
  }, [agentStore.categorys])

  const handleTabChange = (key: string) => {
    setGroupId(Number(key))
  }

  return (
    <div>
      {/* 功能选择标签 */}
      <div
        className="sticky z-[100] bg-white"
        style={{ top: isSoftStyle ? '100px' : '66px' }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-2">
          <Tabs
            items={tabItems}
            activeKey={String(groupId)}
            onChange={handleTabChange}
            className="flex-1 index-tabs overflow-hidden"
          />
          <div className="w-full md:w-auto">
            <Search
              value={keyword}
              onChange={setKeyword}
              className="hidden md:flex"
              placeholder={t('action.search') + t('module.agent')}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              size="large"
              className="w-full md:hidden el-input--main"
              placeholder={t('action.search') + t('module.agent')}
              prefix={<SearchOutlined />}
            />
          </div>
        </div>
      </div>
      {/* 功能卡片网格 */}
      <AgentList
        loading={loading}
        keyword={keyword}
        list={showAgentList}
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? 'mt-4 mb-16' : 'my-3'}`}
      />
    </div>
  )
}

export default ExploreAgent
