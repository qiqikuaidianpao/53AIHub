import { useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { Spin, Empty } from 'antd'
import { useSpaceStore } from '@/stores/modules/space'
import { t } from '@/locales'

export function SpaceLayout() {
  const navigate = useNavigate()
  const params = useParams()
  const location = useLocation()
  const spaceStore = useSpaceStore()

  const [loading, setLoading] = useState(true)
  const spaceId = params.space_id as string

  useEffect(() => {
    setLoading(true)
    spaceStore.loadSpaceList()
      .then(() => {
        // 不在 KnowledgeChat 路由时才自动重定向
        if (!spaceId && spaceStore.spaceList.length > 0 && location.pathname !== '/knowledge/chat') {
          // 没有指定 space_id，重定向到第一个空间
          navigate(`/space/${spaceStore.spaceList[0].id}`, { replace: true })
        } else if (spaceId) {
          spaceStore.setSpaceId(spaceId)
        }
      })
      .finally(() => {
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: navigate and spaceStore are stable references from zustand/hooks
    // We only want to re-run when spaceId changes
  }, [spaceId])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (spaceStore.spaceList.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Empty description={t('common.no_data')} />
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  )
}

export default SpaceLayout