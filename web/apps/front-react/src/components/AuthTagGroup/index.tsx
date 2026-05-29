import { useState, useEffect, useMemo } from 'react'
import { Skeleton, Divider } from 'antd'
import { SvgIcon } from '@km/shared-components-react'
import { subscriptionApi } from '@/api/modules/subscription'
import groupApi from '@/api/modules/group'
import { useEnterpriseType } from '@/stores/modules/enterprise'
import { GROUP_TYPE } from '@/constants/group'
import { getPublicPath } from '@/utils/config'
import { t } from '@/locales'
import './index.css'

interface AuthTagGroupProps {
  value?: (string | number)[]
  label?: string
  labelPosition?: 'left' | 'top'
  hideLabel?: boolean
  emptyText?: string
}

interface SubscriptionItem {
  group_id: number
  group_name: string
  logo?: string
}

interface UserGroupItem {
  group_id: number
  group_name: string
}

export function AuthTagGroup({
  value = [],
  label,
  labelPosition = 'left',
  hideLabel = false,
  emptyText = '--'
}: AuthTagGroupProps) {
  const { isIndependent, isEnterprise } = useEnterpriseType()
  const [loading, setLoading] = useState(false)
  const [subscriptionList, setSubscriptionList] = useState<SubscriptionItem[]>([])
  const [userGroupList, setUserGroupList] = useState<UserGroupItem[]>([])

  const labelText = label || t('authority.use_range')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [subRes, groupRes] = await Promise.all([
          subscriptionApi.list(),
          groupApi.current_list(GROUP_TYPE.INTERNAL_USER)
        ])
        setSubscriptionList(subRes.list || [])
        setUserGroupList(groupRes || [])
      } catch (error) {
        console.error('Failed to fetch auth tag data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const hasVisibleSubscriptionItems = useMemo(() => {
    return subscriptionList.some((item) => value.includes(item.group_id))
  }, [subscriptionList, value])

  const hasVisibleUserGroupItems = useMemo(() => {
    return userGroupList.some((item) => value.includes(item.group_id))
  }, [userGroupList, value])

  const hasVisibleItems = hasVisibleSubscriptionItems || hasVisibleUserGroupItems

  const getLogoSrc = (item: SubscriptionItem) => {
    if (!value.includes(item.group_id)) {
      return getPublicPath('/images/subscription/vip-0.png')
    }
    if (item.logo && !/\.png$/.test(item.logo)) {
      return getPublicPath(`/images/subscription/${item.logo}.png`)
    }
    return item.logo || ''
  }

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton.Button key={i} active size="small" style={{ width: 80, height: 24 }} />
        ))}
      </div>
    )
  }

  return (
    <ul className="flex flex-wrap items-center gap-4 auth-tag-group">
      {!hideLabel && (
        <label
          className={`inline-block text-sm text-regular ${labelPosition === 'top' ? 'w-full -mb-1' : ''}`}
        >
          {labelText}:
        </label>
      )}

      {!hasVisibleItems && (
        <span className="text-sm text-placeholder">{emptyText}</span>
      )}

      {/* Subscription groups for independent/industry */}
      {isIndependent && subscriptionList.map((item) => (
        <li
          key={item.group_id}
          className={`flex items-center gap-1 text-sm ${value.includes(item.group_id) ? 'text-primary' : 'hidden'}`}
        >
          <img
            src={getLogoSrc(item)}
            className="flex-none size-6 rounded-full overflow-auto"
            alt={item.group_name}
          />
          {item.group_name}
        </li>
      ))}

      {/* User groups for enterprise/industry */}
      {isEnterprise && userGroupList.length > 0 && hasVisibleSubscriptionItems && hasVisibleUserGroupItems && (
        <Divider type="vertical" className="!mx-0" />
      )}

      {isEnterprise && userGroupList.map((item) => (
        <li
          key={item.group_id}
          className={`flex items-center gap-1 text-sm ${value.includes(item.group_id) ? 'text-primary' : 'hidden'}`}
        >
          <SvgIcon
            name="user-group"
            className={`flex-none size-6 ${value.includes(item.group_id) ? 'text-theme' : 'text-placeholder'}`}
          />
          {item.group_name}
        </li>
      ))}
    </ul>
  )
}

export default AuthTagGroup
