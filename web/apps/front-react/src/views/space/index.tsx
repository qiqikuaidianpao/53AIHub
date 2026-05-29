import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spin, message } from 'antd'
import { Dropdown } from '@km/shared-components-react'
import type { MenuProps } from 'antd'
import { SvgIcon } from '@km/shared-components-react'
import { useSpaceStore } from '@/stores/modules/space'
import { useShortcutsStore } from '@/stores/modules/shortcuts'
import { VirtualLogo } from '@/components/VirtualLogo'
import { PermissionEmpty } from '@/components/KMPermission'
import { PERMISSION_TYPE, RESOURCE_TYPE, type PermissionType } from '@/components/KMPermission/constant'
import { checkHasKMPermission } from '@/utils/km-permission'
import { checkVersion } from '@/utils/version'
import { VERSION_MODULE } from '@/constants/enterprise'
import librariesApi, { type LibraryItem } from '@/api/modules/libraries'
import permissionsApi from '@/api/modules/permissions'
import favoritesApi from '@/api/modules/favorites'
import { InfoSaveDialog, type InfoSaveDialogRef } from './components/InfoSaveDialog'
import { ApplyDialog, type ApplyDialogRef } from '@/views/library/components/apply'
import { ExpandSidebarButton } from '@/components/Layout/ExpandSidebarButton'
import { t } from '@/locales'
import './space.css'
import { formatFile } from '@/api/modules/files/transform'

interface FormattedFile {
  id: string | number
  name: string
  updated_date: string
}

interface LibraryDisplayItem extends LibraryItem {
  recentlyFiles: FormattedFile[]
  isPlaceholder: boolean
  isAdd: boolean
  permission: PermissionType
}

const MAX_SHOW = 4



// Simple cache manager
const cache = new Map<string, any>()
const cacheManager = {
  get<T>(key: string): T | undefined {
    return cache.get(key)
  },
  set(key: string, value: any) {
    cache.set(key, value)
  },
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (cache.has(key)) {
      return cache.get(key)
    }
    const value = await fetcher()
    cache.set(key, value)
    return value
  }
}

export function SpaceView() {
  const navigate = useNavigate()
  const params = useParams()

  const spaceStore = useSpaceStore()
  const shortcutsStore = useShortcutsStore()

  const spaceId = String(params.space_id)

  const [loading, setLoading] = useState(false)
  const [libraryList, setLibraryList] = useState<LibraryDisplayItem[]>([])
  const [spacePermission, setSpacePermission] = useState<PermissionType>(PERMISSION_TYPE.viewer)
  const [sortOrder, setSortOrder] = useState<'updated_time' | 'created_time'>('updated_time')

  const infoSaveDialogRef = useRef<InfoSaveDialogRef>(null)
  const applyDialogRef = useRef<ApplyDialogRef>(null)

  const hasManagePermission = useMemo(() => {
    return checkHasKMPermission(spacePermission, PERMISSION_TYPE.manage)
  }, [spacePermission])

  const hasViewPermission = useMemo(() => {
    return spaceStore.currentSpace?.visibility
      ? true
      : checkHasKMPermission(spacePermission, PERMISSION_TYPE.viewer)
  }, [spacePermission, spaceStore.currentSpace])

  const fillPlaceholderItems = useCallback((items: LibraryDisplayItem[]) => {
    const totalItems = 6
    const realItems = items.filter(item => !item.isPlaceholder && !item.isAdd)
    const placeholderCount = Math.max(0, totalItems - realItems.length)
    const placeholderItems: LibraryDisplayItem[] = Array.from({ length: placeholderCount }, (_, index) => ({
      id: `placeholder-${index}`,
      isAdd: index === 0 && hasManagePermission,
      name: '',
      icon: '',
      description: '',
      permission: PERMISSION_TYPE.viewer,
      recent: [],
      recentlyFiles: [],
      isPlaceholder: true,
      created_time: 0,
      updated_time: 0,
      is_favorite: false,
      space_id: ''
    }))
    return [...realItems, ...placeholderItems]
  }, [hasManagePermission])

  const loadLibraryList = useCallback(async () => {
    const list = await librariesApi.list({
      space_id: spaceId,
      get_recently: MAX_SHOW,
      limit: 100
    })

    const realItems: LibraryDisplayItem[] = list.map((item: any) => ({
      ...item,
      recentlyFiles: (item.recent || []).slice(0, MAX_SHOW).map(formatFile),
      isPlaceholder: false,
      isAdd: false
    }))

    const sortedItems = [...realItems].sort((a, b) => (b[sortOrder] || 0) - (a[sortOrder] || 0))
    const filledList = fillPlaceholderItems(sortedItems)
    setLibraryList(filledList)

    // Load permissions for all libraries in batch
    if (realItems.length > 0) {
      try {
        const permissionMap = await permissionsApi.myBatch({
          resource_type: RESOURCE_TYPE.library,
          resource_ids: realItems.map(item => item.id)
        })
        setLibraryList(prev =>
          prev.map(li => {
            if (li.isPlaceholder) return li
            const key = `${RESOURCE_TYPE.library}:${li.id}`
            // 如果 myBatch 没有返回权限，使用 list 返回的原始权限（继承权限）
            const batchPermission = permissionMap[key]
            const originalItem = list.find((item: any) => item.id === li.id)
            const originalPermission = originalItem?.permission ?? PERMISSION_TYPE.none
            const permission = batchPermission !== undefined ? batchPermission : originalPermission
            return { ...li, permission }
          })
        )
      } catch (error) {
        console.error('Failed to load library permissions')
      }
    }
  }, [spaceId, sortOrder, fillPlaceholderItems])

  const loadSpacePermission = useCallback(async () => {
    const res = await permissionsApi.my({
      resource_type: RESOURCE_TYPE.space,
      resource_id: spaceId
    })
    setSpacePermission(res.max_permission)
    return res.max_permission
  }, [spaceId])

  const handleCreate = useCallback(() => {
    if (!checkVersion(VERSION_MODULE.LIBRARY_COUNT)) {
      message.warning(t('common.feature_over_limit', { functionName: t('library.name') }))
      return
    }
    infoSaveDialogRef.current?.open()
  }, [])

  const handleCommand = useCallback(async (command: string, item: LibraryDisplayItem) => {
    if (command === 'edit') {
      navigate(`/library/${item.id}/setting`)
    } else if (command === 'fav') {
      await favoritesApi.toggle({
        resource_type: RESOURCE_TYPE.library,
        resource_id: item.id
      })
      setLibraryList(prev =>
        prev.map(li =>
          li.id === item.id ? { ...li, is_favorite: !li.is_favorite } : li
        )
      )
      message.success(item.is_favorite ? t('action.unfavorite') : t('action.favorite'))
    } else if (command === 'add-shortcut') {
      await shortcutsStore.addShortcut('library', item.id)
    } else if (command === 'remove-shortcut') {
      await shortcutsStore.removeShortcut('library', item.id)
    }
  }, [navigate, shortcutsStore])

  const handleOpenLibrary = useCallback((item: LibraryDisplayItem) => {
    if (item.isPlaceholder || item.permission === PERMISSION_TYPE.loading || item.permission === PERMISSION_TYPE.none) {
      return
    }
    navigate(`/library/${item.id}`)
  }, [navigate])

  const handleApplyOpen = useCallback((item: LibraryDisplayItem) => {
    applyDialogRef.current?.open({
      permission: PERMISSION_TYPE.viewer,
      resource: item,
      resourceType: RESOURCE_TYPE.library
    })
  }, [])

  const handleSortOrder = useCallback((order: 'updated_time' | 'created_time') => {
    setSortOrder(order)
    setLibraryList(prev => {
      const realItems = prev.filter(item => !item.isPlaceholder && !item.isAdd)
      if (realItems.length) {
        const sorted = [...realItems].sort((a, b) => (b[order] || 0) - (a[order] || 0))
        return fillPlaceholderItems(sorted)
      }
      return prev
    })
  }, [fillPlaceholderItems])

  // Initialize data on spaceId change
  useEffect(() => {
    let mounted = true

    const init = async () => {
      setLoading(true)
      try {
        const permission = await loadSpacePermission()
        if (!mounted) return

        // Check visibility or permission directly from API response
        if (spaceStore.currentSpace?.visibility || permission >= PERMISSION_TYPE.viewer) {
          await loadLibraryList()
        } else if (mounted) {
          setLibraryList(fillPlaceholderItems([]))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    init()
    spaceStore.setSpaceId(spaceId)

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: loadSpacePermission, loadLibraryList, fillPlaceholderItems are stable callbacks
    // spaceStore is a stable zustand store reference
    // We only want to re-run when spaceId changes
  }, [spaceId])

  const sortMenuItems: MenuProps['items'] = [
    {
      key: 'updated_time',
      label: t('space.sort_by_updated'),
      onClick: () => handleSortOrder('updated_time')
    },
    {
      key: 'created_time',
      label: t('space.sort_by_created'),
      onClick: () => handleSortOrder('created_time')
    }
  ]

  const getLibraryMenuItems = useCallback((item: LibraryDisplayItem): MenuProps['items'] => {
    const items: MenuProps['items'] = []

    if (shortcutsStore.getShortcut('library', item.id)) {
      items.push({
        key: 'remove-shortcut',
        icon: <SvgIcon name="delete-mode" size={16} />,
        label: t('shortcut.remove'),
        onClick: () => handleCommand('remove-shortcut', item)
      })
    } else {
      items.push({
        key: 'add-shortcut',
        icon: <SvgIcon name="add-mode" size={16} />,
        label: t('shortcut.add'),
        onClick: () => handleCommand('add-shortcut', item)
      })
    }

    if (checkHasKMPermission(item.permission, PERMISSION_TYPE.manage)) {
      items.push({
        key: 'edit',
        icon: <SvgIcon name="setting2" size={16} />,
        label: t('action.manage'),
        onClick: () => handleCommand('edit', item)
      })
    }

    items.push({
      key: 'fav',
      icon: <SvgIcon name="label" size={16} />,
      label: item.is_favorite ? t('action.unfavorite') : t('action.favorite'),
      onClick: () => handleCommand('fav', item)
    })

    return items
  }, [shortcutsStore, handleCommand])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!hasViewPermission) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <PermissionEmpty>
          <Button type="primary" onClick={() => navigate('/')}>
            {t('common.back_home')}
          </Button>
        </PermissionEmpty>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-none h-14 px-6 flex items-center justify-between">
        <ExpandSidebarButton />
        <h2 className="flex-1 text-base text-[#1D1E1F]">
          {t('module.space')}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-5">
          {/* Space Header */}
          <div className="h-[120px] flex items-center gap-5 mt-10">
            <div className="size-20 flex items-center justify-center border-4 border-white rounded-full shadow-md">
              {spaceStore.currentSpace?.icon ? (
                <img
                  src={spaceStore.currentSpace.icon}
                  className="w-full h-full rounded-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-medium">
                  {spaceStore.currentSpace?.name?.charAt(0) || 'S'}
                </div>
              )}
            </div>
            <p className="flex-1 text-3xl whitespace-nowrap overflow-hidden text-ellipsis">
              {spaceStore.currentSpace?.name}
            </p>
            {hasManagePermission && (
              <Button type="primary" ghost onClick={handleCreate} className="bg-white px-3">
                <div className="flex items-center gap-1">
                  <SvgIcon name="plus" size={20} />
                  {t('action.create')}{t('module.library')}
                </div>
              </Button>
            )}
          </div>

          {/* Library List Header */}
          <div className="flex items-center gap-3 mt-9">
            <p className="text-base text-[#1D1E1F]">{t('space.team_library')}</p>
            <Dropdown menu={{ items: sortMenuItems }} trigger={['click']} placement="bottomLeft">
              <div className="size-6 flex items-center justify-center rounded hover:border cursor-pointer">
                <SvgIcon name="sort-one" />
              </div>
            </Dropdown>
          </div>

          {/* Library Grid */}
          <div className="mt-7 grid grid-cols-3 gap-5 max-md:grid-cols-2">
            {libraryList.map((item, index) => (
              <div key={item.id}>
                {/* Add Library Card */}
                {item.isAdd && hasManagePermission && (
                  <div
                    className="h-[186px] !rounded-lg !rounded-tl-none bg-[#F8FAFD] flex justify-center items-center cursor-pointer transition-all duration-300 relative ease-linear hover:shadow-lg"
                    onClick={handleCreate}
                  >
                    <Button className="!bg-[#F8FAFD] border-0">
                      <div className="flex flex-col items-center justify-center">
                        <div className="size-7 flex items-center justify-center">
                          <SvgIcon name="plus" size={20} />
                        </div>
                        <div className="text-sm">
                          {index === 0 ? t('knowledge.create_first') : `${t('action.create')}${t('module.library')}`}
                        </div>
                      </div>
                    </Button>
                    <div className="h-2.5 absolute left-0 -top-2.5 w-24 bg-[#F8FAFD] rounded-tl diagonal-cut" />
                  </div>
                )}

                {/* Library Card */}
                {!item.isAdd && (
                  <div
                    className={`h-[186px] bg-[#F8FAFD] rounded-lg p-4 transition-all duration-300 ease-linear flex flex-col relative ${
                      item.isPlaceholder ? '' : 'cursor-pointer hover:shadow-lg'
                    }`}
                    onClick={() => handleOpenLibrary(item)}
                  >
                    {!item.isPlaceholder && (
                      <>
                        {/* Card Header */}
                        <div className="flex-none h-9 flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <VirtualLogo text={item.name} src={item.icon} size={36} />
                            <p className="whitespace-nowrap text-base text-[#1D1E1F] truncate">
                              {item.name}
                            </p>
                          </div>
                          {item.permission > PERMISSION_TYPE.none && (
                            <Dropdown
                              menu={{ items: getLibraryMenuItems(item) }}
                              trigger={['click']}
                              placement="bottomRight"
                            >
                              <div
                                className="size-6 flex items-center justify-center rounded hover:border"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <SvgIcon name="more-h" />
                              </div>
                            </Dropdown>
                          )}
                        </div>

                        {/* Card Content */}
                        {item.permission === PERMISSION_TYPE.none ? (
                          <div className="flex-1 flex justify-center items-center">
                            <Button
                              type="link"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleApplyOpen(item)
                              }}
                            >
                              <SvgIcon name="lock" size={14} className="mr-1" />
                              {t('knowledge.apply_permission')}
                            </Button>
                          </div>
                        ) : item.recentlyFiles.length === 0 ? (
                          <div className="flex-1 flex justify-center items-center">
                            <p className="text-sm text-[#939499]">{t('knowledge.empty_content')}</p>
                          </div>
                        ) : (
                          <div className="flex-1 overflow-hidden">
                            {item.recentlyFiles.map((file) => (
                              <div key={file.id} className="mt-2 flex justify-between text-sm">
                                <p className="flex-1 text-[#4F5052] whitespace-nowrap overflow-hidden text-ellipsis">
                                  ·{file.name}
                                </p>
                                <div className="text-[#9A9A9A] whitespace-nowrap overflow-hidden text-ellipsis">
                                  {file.updated_date}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <div
                      className={`h-2.5 absolute left-0 -top-2.5 w-24 rounded-tl diagonal-cut ${
                        item.isPlaceholder ? 'bg-[#F8FAFD]' : 'bg-[#EFF5FF]'
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <InfoSaveDialog
        ref={infoSaveDialogRef}
        spaceId={spaceId}
        onSuccess={loadLibraryList}
      />
      <ApplyDialog ref={applyDialogRef} />
    </div>
  )
}

export default SpaceView
