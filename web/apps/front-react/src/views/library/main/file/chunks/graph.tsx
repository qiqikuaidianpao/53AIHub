import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Input, Tooltip, Modal, message, Empty, Spin, Radio, Button } from 'antd'
import { Dropdown } from '@km/shared-components-react'
import { useLibraryStore } from '@/stores/modules/library'
import filesApi from '@/api/modules/files'
import { NodeDetailDrawer } from './components/NodeDetailDrawer'
import { SvgIcon } from '@km/shared-components-react'
import loadLib from '@/utils/loadLib'
import { getPublicPath } from '@/utils/config'
import './graph.css'

const MIN_ZOOM = 0.2
const MAX_ZOOM = 3
const DEFAULT_ZOOM = 1
const ZOOM_STEP = 0.1
const ZOOM_RANGE = [3, 1.5, 1, 0.5, 0.2]

// G6 Graph instance interface
interface G6GraphInstance {
  getZoom: () => number
  zoomTo: (ratio: number, center?: { x: number; y: number }) => void
  fitCenter: () => void
  fitView: (padding?: number[]) => void
  destroy: () => void
  getNodeData: (id: string) => unknown
  getEdgeData: (id: string) => unknown
  addItem: (type: string, model: unknown) => void
  removeItem: (item: unknown) => void
  updateItem: (item: unknown, model: unknown) => void
  refreshItem: (item: unknown) => void
  findById: (id: string) => unknown
  [key: string]: unknown
}

// Fixed 60 entity colors
const ENTITY_COLORS = [
  '#0EBB80', '#F49E0B', '#5C61FF', '#E74C3C', '#3498DB',
  '#9B59B6', '#1ABC9C', '#E67E22', '#2ECC71', '#34495E',
  '#16A085', '#27AE60', '#2980B9', '#8E44AD', '#2C3E50',
  '#F39C12', '#D35400', '#C0392B', '#BDC3C7', '#7F8C8D',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FFD700',
  '#FF4500', '#1E90FF', '#00FA9A', '#FF1493', '#00BFFF',
  '#ADFF2F', '#FF6347', '#40E0D0', '#EE82EE', '#F0E68C',
  '#ADD8E6', '#90EE90', '#FFB6C1', '#20B2AA', '#87CEEB',
  '#778899', '#B0C4DE', '#FFFFE0', '#00FF00', '#FF00FF',
  '#00FFFF', '#FF0000', '#0000FF', '#008000', '#800080',
]

interface EntityItem {
  id: string
  entity_name: string
  type?: string
  properties?: Record<string, string>
  chunk_ids?: string[]
}

interface RelationItem {
  id: string
  sourceEntity: { id: string; entity_name: string }
  targetEntity: { id: string; entity_name: string }
  predicate?: string
  chunk_ids?: string[]
}

interface GraphViewProps {
  isSupportSearch?: boolean
  isAdjustToolbarCenter?: boolean
}

interface GraphViewRef {
  refresh: () => void
}

export const GraphView = forwardRef<GraphViewRef, GraphViewProps>(
  ({ isSupportSearch = true, isAdjustToolbarCenter = false }, ref) => {
    const libraryStore = useLibraryStore()
    const graphContainerRef = useRef<HTMLDivElement>(null)
    const graphInstanceRef = useRef<G6GraphInstance | null>(null)
    const nodeDetailDrawerRef = useRef<NodeDetailDrawer>(null)

    // Refs for latest values (avoid stale closure in G6 behavior callbacks)
    const relationDataRef = useRef<RelationItem[]>([])
    const currentFileRef = useRef<any>(null)

    const [isLoading, setIsLoading] = useState(false)
    const [showEmptyState, setShowEmptyState] = useState(false)
    const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM)
    const [keyword, setKeyword] = useState('')
    const [entityData, setEntityData] = useState<EntityItem[]>([])
    const [relationData, setRelationData] = useState<RelationItem[]>([])
    const [hiddenEntityTypes, setHiddenEntityTypes] = useState<Set<string>>(new Set())
    const [selectedNode, setSelectedNode] = useState<any>(null)
    const [selectedEdge, setSelectedEdge] = useState<any>(null)

    // Merge dialog state
    const [mergeDialogVisible, setMergeDialogVisible] = useState(false)
    const [mergeForm, setMergeForm] = useState({
      selectedEntity: 1,
      entity1: '',
      entity2: '',
      mergedEntity: '',
    })

    const currentFile = libraryStore.currentFile()

    // Watch: sync mergedEntity when selectedEntity changes
    useEffect(() => {
      if (mergeForm.selectedEntity === 1) {
        setMergeForm(prev => ({ ...prev, mergedEntity: prev.entity1 || '' }))
      } else {
        setMergeForm(prev => ({ ...prev, mergedEntity: prev.entity2 || '' }))
      }
    }, [mergeForm.selectedEntity])

    // Watch: sync mergedEntity when entity1 changes (if selectedEntity === 1)
    useEffect(() => {
      if (mergeForm.selectedEntity === 1) {
        setMergeForm(prev => ({ ...prev, mergedEntity: prev.entity1 || '' }))
      }
    }, [mergeForm.entity1, mergeForm.selectedEntity])

    // Watch: sync mergedEntity when entity2 changes (if selectedEntity === 2)
    useEffect(() => {
      if (mergeForm.selectedEntity === 2) {
        setMergeForm(prev => ({ ...prev, mergedEntity: prev.entity2 || '' }))
      }
    }, [mergeForm.entity2, mergeForm.selectedEntity])
    currentFileRef.current = currentFile

    // Compute entity types list from actual data
    const entityTypes = useMemo(() => {
      const typeMap = new Map<string, number>()
      entityData.forEach((entity) => {
        const type = entity.type || '未分类'
        typeMap.set(type, (typeMap.get(type) || 0) + 1)
      })
      return Array.from(typeMap.entries()).map(([name, count], index) => ({
        name,
        count,
        color: ENTITY_COLORS[index % ENTITY_COLORS.length],
      }))
    }, [entityData])

    // Transform entity data to node data for G6
    const transformEntityDataToNodeData = useCallback((entities: EntityItem[]) => {
      const entityMap = new Map<string, EntityItem>()
      entities.forEach((entity) => {
        entityMap.set(entity.id, entity)
      })

      const typeColorMap = new Map<string, string>()
      const uniqueTypes = [...new Set(entities.map(e => e.type || '未分类'))]
      uniqueTypes.forEach((type, index) => {
        typeColorMap.set(type, ENTITY_COLORS[index % ENTITY_COLORS.length])
      })

      return Array.from(entityMap.values()).map((entity) => {
        const entityType = entity.type || '未分类'
        const color = typeColorMap.get(entityType) || ENTITY_COLORS[0]
        const fillColor = color + '1A'
        const strokeColor = color + '4D'

        return {
          id: entity.id,
          data: {
            name: entity.entity_name,
            properties: entity.properties,
            chunk_ids: entity.chunk_ids,
            type: entity.type,
          },
          style: {
            size: 80,
            fill: fillColor,
            stroke: strokeColor,
            lineWidth: 1.5,
            labelText: entity.entity_name,
            labelPlacement: 'center' as const,
            labelFontSize: 12,
            labelMaxWidth: 60,
            labelFontWeight: 500,
            labelTextOverflow: 'ellipsis',
            labelWordWrap: true,
            labelFill: color,
          },
          state: {
            active: {
              stroke: color,
              fill: color + '80',
              halo: false,
              lineWidth: 1.5,
            },
            selected: {
              halo: true,
              labelFill: '#FFF',
              fill: color,
              haloLineWidth: 12,
              stroke: color,
              haloStrokeOpacity: 1,
              haloStroke: color + '33',
            },
          },
        }
      })
    }, [])

    // Transform relation data to edge data for G6
    const transformRelationDataToEdgeData = useCallback((relations: RelationItem[]) => {
      return relations.map((relation) => ({
        id: relation.id,
        source: relation.sourceEntity.id,
        target: relation.targetEntity.id,
        data: {
          source: relation.sourceEntity.entity_name,
          target: relation.targetEntity.entity_name,
          chunk_ids: relation.chunk_ids,
          predicate: relation.predicate,
        },
        style: {
          curveOffset: 30,
          stroke: '#C5CBD6',
          lineWidth: 1,
          lineDash: [5, 2],
          labelText: relation.predicate,
          labelMaxWidth: '30%',
          labelPadding: [3, 12, 3, 12],
          labelWordWrap: true,
          labelFontSize: 10,
          labelFontWeight: 400,
          labelFill: '#495366',
          labelTextOverflow: 'ellipsis',
          endArrow: true,
          endArrowType: 'triangle' as const,
          labelBackground: true,
          labelBackgroundLineWidth: 1,
          labelBackgroundRadius: 100,
          labelBackgroundStroke: '#C5CBD6',
          labelBackgroundFill: '#FFF',
          labelBackgroundOpacity: 1,
        },
        state: {
          active: {
            labelFontSize: 10,
            labelFontWeight: 400,
            labelFill: '#000',
            lineWidth: 1,
            halo: false,
            stroke: '#333AFF',
            labelBackgroundStroke: '#333AFF',
          },
          selected: {
            labelFontSize: 10,
            labelFontWeight: 500,
            labelFill: '#000',
            lineWidth: 1,
            halo: false,
            stroke: '#333AFF',
            labelBackgroundStroke: '#333AFF',
          },
        },
      }))
    }, [])

    // Handle node or edge click
    const handleNodeOrEdgeClick = useCallback(async (e: any) => {
      if (!graphInstanceRef.current || !e) return
      const targetType = e.targetType
      const targetId = e.target.id

      if (targetType === 'node') {
        const node = graphInstanceRef.current.getNodeData(targetId)
        if (!node) return

        setSelectedNode(node)
        setSelectedEdge(null)

        // Use ref to always get latest data (avoids stale closure in G6 behavior)
        const latestRelations = relationDataRef.current
        const relatedEdges = latestRelations.filter(
          (relation) => relation.sourceEntity.id === node.id || relation.targetEntity.id === node.id
        )

        nodeDetailDrawerRef.current?.openNode(currentFileRef.current, node, relatedEdges)
      }

      if (targetType === 'edge') {
        const edge = graphInstanceRef.current.getEdgeData(targetId)
        if (!edge) return

        setSelectedEdge(edge)
        setSelectedNode(null)

        nodeDetailDrawerRef.current?.openEdge(currentFileRef.current, edge)
      }
    }, [])

    // Get graph options
    const getGraphOptions = useCallback((entities: EntityItem[], relations: RelationItem[]) => {
      // Compute core nodes with multiple sources (connections > 3)
      const nodeCounts: Record<string, number> = {}
      relations.forEach((relation) => {
        nodeCounts[relation.sourceEntity.id] = (nodeCounts[relation.sourceEntity.id] || 0) + 1
        nodeCounts[relation.targetEntity.id] = (nodeCounts[relation.targetEntity.id] || 0) + 1
      })
      const coreNodes = Object.keys(nodeCounts).filter((nodeId) => nodeCounts[nodeId] > 3)

      return {
        data: {
          nodes: transformEntityDataToNodeData(entities),
          edges: transformRelationDataToEdgeData(relations),
        },
        layout: {
          type: 'd3-force',
          nodeSize: 80,
          link: {
            distance: (e: any) => {
              return coreNodes.includes(e.target.id) &&
                coreNodes.includes(e.source.id)
                ? 600
                : 150
            },
          },
          manyBody: {
            strength: (e: any) => {
              return coreNodes.includes(e.id) ? -100 : -30
            },
          },
          collide: { radius: 70, strength: 0.7 },
          center: { strength: 0.05 },
        },
        node: {
          state: {
            selected: {
              halo: true,
              labelFill: '#FFF',
              fill: '#333AFF',
              haloLineWidth: 12,
              stroke: '#333AFF',
              haloStrokeOpacity: 1,
              haloStroke: '#4F58FF33',
            },
          },
        },
        edge: {
          type: 'quadratic',
          style: {
            curveOffset: (e: any) => {
              return 30 * ((e.data?.directionType) === 'bidirectional' ? 1 : 0)
            },
            stroke: '#C5CBD6',
            lineWidth: 1,
            lineDash: [5, 2],
            labelZIndex: 1,
            labelMaxWidth: '30%',
            labelPadding: [3, 12, 3, 12],
            labelWordWrap: true,
            labelFontSize: 10,
            labelFontWeight: 400,
            labelFill: '#495366',
            labelTextOverflow: 'ellipsis',
            endArrow: true,
            endArrowType: 'triangle' as const,
            labelBackground: true,
            labelBackgroundLineWidth: 1,
            labelBackgroundRadius: 100,
            labelBackgroundStroke: '#C5CBD6',
            labelBackgroundFill: '#FFF',
            labelBackgroundOpacity: 1,
          },
          state: {
            active: {
              labelFontSize: 10,
              labelFontWeight: 400,
              labelFill: '#000',
              lineWidth: 1,
              halo: false,
              stroke: '#333AFF',
              labelBackgroundStroke: '#333AFF',
            },
            selected: {
              labelFontSize: 10,
              labelFontWeight: 500,
              labelFill: '#000',
              lineWidth: 1,
              halo: false,
              stroke: '#333AFF',
              labelBackgroundStroke: '#333AFF',
            },
          },
        },
        plugins: [
          {
            type: 'background',
            backgroundImage: `url(${getPublicPath('/images/library/graph_bg.png')})`
          }
        ],
        behaviors: [
          'drag-canvas',
          'hover-activate',
          {
            type: 'drag-element-force',
            fixed: true,
          },
          {
            type: 'zoom-canvas',
            onFinish: () => {
              if (graphInstanceRef.current) {
                const zoom = graphInstanceRef.current.getZoom()
                if (zoom !== undefined && zoom !== null) {
                  setCurrentZoom(zoom)
                }
              }
            },
          },
          {
            type: 'click-select',
            degree: 1,
            unselectedState: 'inactive',
            onClick: handleNodeOrEdgeClick,
          }
        ],
      }
    }, [transformEntityDataToNodeData, transformRelationDataToEdgeData, handleNodeOrEdgeClick])

    // Load graph data from backend
    const loadGraphData = useCallback(async (options?: { keyword?: string; entity_type?: string; limit?: number }) => {
      const fileId = currentFile?.id
      if (!fileId) return { entities: [] as EntityItem[], relations: [] as RelationItem[] }

      setIsLoading(true)
      try {
        const params: any = { file_id: fileId }

        if (options?.keyword && options.keyword.trim()) {
          params.keyword = options.keyword.trim()
        }
        if (options?.entity_type) {
          params.entity_type = options.entity_type
        }
        if (typeof options?.limit === 'number') {
          params.limit = options.limit
        }

        const res = await filesApi.graph.list(params)
        const graphData: any = res && res.data ? res.data : {}

        const rawEntities: any[] = graphData?.entities || []
        const rawRelations: any[] = graphData?.relations || []

        const processedEntities = rawEntities
          .map((item) => ({
            id: item.id,
            name: item.name,
            entity_name: item.name,
            type: item.type,
            properties: item.properties,
            chunk_ids: item.chunk_ids,
          }))
          .filter((e) => e.id && e.entity_name)

        const processedRelations = rawRelations
          .map((item) => {
            const sourceId = item.source_entity_id
            const targetId = item.target_entity_id
            const sourceName = rawEntities.find((e) => e.id === sourceId)?.name || ''
            const targetName = rawEntities.find((e) => e.id === targetId)?.name || ''
            return {
              id: item.id,
              sourceEntity: { id: sourceId, entity_name: sourceName || sourceId },
              targetEntity: { id: targetId, entity_name: targetName || targetId },
              predicate: item.predicate ?? '',
              chunk_ids: item.chunk_ids,
            }
          })
          .filter((r) => r.sourceEntity.id && r.targetEntity.id)

        setEntityData(processedEntities)
        setRelationData(processedRelations)
        relationDataRef.current = processedRelations

        if (!res.data) {
          setShowEmptyState(true)
        }

        return { entities: processedEntities, relations: processedRelations }
      } catch (error) {
        console.error('加载文件图谱失败', error)
        message.error('加载知识图谱失败')
        return { entities: [] as EntityItem[], relations: [] as RelationItem[] }
      } finally {
        setIsLoading(false)
      }
    }, [currentFile])

    // Initialize graph
    const initGraph = useCallback((entities: EntityItem[], relations: RelationItem[]) => {
      if (!graphContainerRef.current) return

      if (graphInstanceRef.current) {
        graphInstanceRef.current.destroy()
        graphInstanceRef.current = null
      }

      // Check if G6 is loaded
      if (!(window as any).G6) {
        console.warn('G6 library not loaded')
        return
      }

      const options = getGraphOptions(entities, relations)
      const graph = new (window as any).G6.Graph({
        container: graphContainerRef.current,
        width: graphContainerRef.current.clientWidth,
        height: graphContainerRef.current.clientHeight || 600,
        autoFit: 'center',
        autoResize: true,
        zoomRange: [MIN_ZOOM, MAX_ZOOM],
        ...options,
      })

      graph.render()
      graph.fitView()

      graphInstanceRef.current = graph
    }, [getGraphOptions])

    // Clear graph selection
    const clearGraphSelection = useCallback(() => {
      if (selectedNode) {
        setSelectedNode(null)
      }
      if (selectedEdge) {
        setSelectedEdge(null)
      }
      graphInstanceRef.current?.emit('canvas:click')
    }, [selectedNode, selectedEdge])

    // Toggle entity type visibility
    const toggleEntityTypeVisibility = useCallback((typeName: string) => {
      const entities = entityData.filter(e => (e.type || '未分类') === typeName)
      const relations = relationData.filter(r => {
        const sourceType = entityData.find(e => e.id === r.sourceEntity.id)?.type || '未分类'
        const targetType = entityData.find(e => e.id === r.targetEntity.id)?.type || '未分类'
        return sourceType === typeName || targetType === typeName
      })
      const entityIds = entities.map(e => e.id)
      const relationIds = relations.map(r => r.id)

      setHiddenEntityTypes(prev => {
        const newSet = new Set(prev)
        if (newSet.has(typeName)) {
          newSet.delete(typeName)
          graphInstanceRef.current?.showElement([...entityIds, ...relationIds])
        } else {
          newSet.add(typeName)
          graphInstanceRef.current?.hideElement([...entityIds, ...relationIds])
        }
        return newSet
      })
    }, [entityData, relationData])

    // Zoom methods
    const handleZoomOut = useCallback(() => {
      if (currentZoom >= MAX_ZOOM) return
      const newZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM)
      zoomGraph(newZoom)
    }, [currentZoom])

    const handleZoomIn = useCallback(() => {
      if (currentZoom <= MIN_ZOOM) return
      const newZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM)
      zoomGraph(newZoom)
    }, [currentZoom])

    const handleZoomSelect = useCallback((zoom: number) => {
      zoomGraph(zoom)
    }, [])

    const zoomGraph = useCallback((zoom: number) => {
      if (graphInstanceRef.current) {
        graphInstanceRef.current.zoomTo(zoom)
        setCurrentZoom(zoom)
      }
    }, [])

    // Fit view
    const handleFitView = useCallback(() => {
      if (graphInstanceRef.current) {
        graphInstanceRef.current.fitView()
        const zoom = graphInstanceRef.current.getZoom()
        if (zoom !== undefined) {
          setCurrentZoom(zoom)
        }
      }
    }, [])

    // Handle search
    const handleSearch = useCallback(async () => {
      if (!graphInstanceRef.current) return
      const { entities, relations } = await loadGraphData({ keyword })
      initGraph(entities, relations)
    }, [keyword, loadGraphData, initGraph])

    // Resize graph
    const resizeGraph = useCallback(() => {
      if (graphInstanceRef.current && graphContainerRef.current) {
        const newWidth = graphContainerRef.current.clientWidth
        const newHeight = graphContainerRef.current.clientHeight || 600

        graphInstanceRef.current.setOptions({
          width: newWidth,
          height: newHeight,
        })

        graphInstanceRef.current.resize(newWidth, newHeight)
      }
    }, [])

    // Refresh method exposed via ref
    const refresh = useCallback(() => {
      loadGraphData().then(({ entities, relations }) => initGraph(entities, relations))
    }, [loadGraphData, initGraph])

    useImperativeHandle(ref, () => ({
      refresh,
    }))


    // Merge entity methods
    const handleMergeEntity = useCallback(() => {
      if (!selectedNode) {
        message.warning('请先选择一个实体')
        return
      }

      // Set default values for merge form
      setMergeForm({
        selectedEntity: 1,
        entity1: selectedNode.data?.name || '',
        entity2: '',
        mergedEntity: selectedNode.data?.name || '',
      })

      // Close drawer and open merge dialog
      nodeDetailDrawerRef.current?.close()
      setMergeDialogVisible(true)
    }, [selectedNode])

    const handleEditEntity = useCallback(() => {
      message.info('进入编辑模式')
    }, [])

    const handleMergeCancel = useCallback(() => {
      setMergeDialogVisible(false)
      // Reset merge form
      setMergeForm({
        selectedEntity: 1,
        entity1: '',
        entity2: '',
        mergedEntity: '',
      })
    }, [])

    const handleMergeConfirm = useCallback(() => {
      // Form validation
      if (!mergeForm.entity1.trim() || !mergeForm.entity2.trim()) {
        message.warning('请填写两个实体名称')
        return
      }

      if (!mergeForm.mergedEntity.trim()) {
        message.warning('请输入合并后的实体名称')
        return
      }

      // TODO: Implement merge entity logic
      console.log('合并实体:', mergeForm)
      message.success('合并成功')

      // Close dialog and reset form after merge
      handleMergeCancel()
    }, [mergeForm, handleMergeCancel])

    const handleTemplateCommand = useCallback((command: string, templateId: string) => {
      if (command === 'delete') {
        Modal.confirm({
          title: '提示',
          content: '确定删除该图谱模板吗？',
          okText: '确定',
          cancelText: '取消',
          onOk: () => {
            // TODO: Implement delete logic
            message.success('删除成功')
          },
        })
      } else if (command === 'edit') {
        // TODO: Implement rename logic
        message.info('重命名功能开发中')
      }
    }, [])
    // Load G6 library and initialize
    useEffect(() => {
      const loadG6AndInit = async () => {
        await loadLib('g6')
        const { entities, relations } = await loadGraphData()
        initGraph(entities, relations)
      }

      loadG6AndInit()

      const handleResize = () => resizeGraph()
      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        if (graphInstanceRef.current) {
          graphInstanceRef.current.destroy()
        }
      }
    }, [])

    // Zoom dropdown menu items
    const zoomMenuItems = ZOOM_RANGE.map(zoom => ({
      key: zoom.toString(),
      label: `${Math.floor(zoom * 100)}%`,
    }))

    return (
      <div className="flex-1 flex flex-col relative bg-[#f5f5f5] overflow-hidden">
        <div className="flex-1 overflow-hidden relative flex">
          <div className="flex-1 overflow-hidden relative">
            <div ref={graphContainerRef} className="w-full h-full" />

            {/* Entity types panel */}
            {entityTypes.length > 0 && (
              <div className="absolute left-4 top-4 w-[120px] py-4 bg-white shadow rounded">
                <div className="text-sm text-[#4F5052] px-4">实体类型</div>
                <div className="space-y-2 mt-2 px-4 max-h-52 overflow-y-auto">
                  {entityTypes.map((entityType) => (
                    <div
                      key={entityType.name}
                      className={`flex items-center gap-1.5 cursor-pointer ${hiddenEntityTypes.has(entityType.name) ? 'opacity-40' : ''}`}
                      onClick={() => toggleEntityTypeVisibility(entityType.name)}
                    >
                      <div
                        className="flex-none w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: entityType.color }}
                      />
                      <span className="text-xs text-[#999999] truncate">{entityType.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Toolbar */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white shadow">
                {/* Search box */}
                {isSupportSearch && (
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    disabled={isLoading}
                    placeholder="请输入实体名称"
                    allowClear
                    className="search-input"
                    onPressEnter={handleSearch}
                    prefix={<SvgIcon name="search" />}
                  />
                )}

                <div className="w-px h-[14px] bg-[#E6E8EB]" />

                {/* Zoom controls */}
                <div
                  className={`action-btn ${currentZoom <= MIN_ZOOM ? 'action-btn-disabled' : ''}`}
                  onClick={handleZoomIn}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                    <circle cx="7.432" cy="7.432" r="5.682" stroke="currentColor" strokeWidth="1.2" />
                    <path stroke="currentColor" strokeWidth="1.2" d="M4.848 7.432h5.165" />
                    <path stroke="currentColor" strokeWidth="1.2" d="m14.148 14.147-2.535-2.611" />
                  </svg>
                </div>

                <Dropdown menu={{ items: zoomMenuItems, onClick: ({ key }) => handleZoomSelect(parseFloat(key)) }}>
                  <div className="zoom-dropdown">
                    {Math.floor(currentZoom * 100)}%
                  </div>
                </Dropdown>

                <div
                  className={`action-btn ${currentZoom >= MAX_ZOOM ? 'action-btn-disabled' : ''}`}
                  onClick={handleZoomOut}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                    <circle cx="7.432" cy="7.431" r="5.682" stroke="currentColor" strokeWidth="1.2" />
                    <path stroke="currentColor" strokeWidth="1.2" d="M4.852 7.432h5.165M7.432 4.849v5.166" />
                    <path stroke="currentColor" strokeWidth="1.2" d="m14.145 14.147-2.536-2.611" />
                  </svg>
                </div>

                {/* Fit view */}
                <Tooltip title="居中视图">
                  <div className="action-btn" onClick={handleFitView}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                      <path stroke="#000" strokeWidth="1.2" d="M5.333 2H2.667A.667.667 0 0 0 2 2.667v2.666M5.333 14H2.667A.667.667 0 0 1 2 13.333v-2.666M10.668 14h2.667a.667.667 0 0 0 .666-.667v-2.666M10.668 2h2.667c.368 0 .666.298.666.667v2.666" />
                      <path stroke="#000" strokeWidth="1.2" d="M10.668 4.667H5.335a.667.667 0 0 0-.667.666v5.334c0 .368.298.666.667.666h5.333a.667.667 0 0 0 .667-.666V5.333a.667.667 0 0 0-.667-.666Z" />
                    </svg>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Empty state */}
            {showEmptyState && (
              <div className="absolute inset-0 z-10 bg-[#F5F6FA] flex flex-col items-center justify-center">
                <img src={getPublicPath('/images/library/graph_empty.png')} alt="" className="w-[480px]" />
                <p className="text-base text-[#1D1E1F] mt-6 mb-2">暂无知识图谱数据</p>
                <p className="text-sm text-[#9A9A9A]">请先对文档进行知识图谱抽取</p>
              </div>
            )}
          </div>

          {/* Node/Edge detail drawer */}
          <NodeDetailDrawer ref={nodeDetailDrawerRef} onClose={clearGraphSelection} />
        </div>

        {/* Merge entity dialog */}
        <Modal
          title="合并实体"
          open={mergeDialogVisible}
          onCancel={handleMergeCancel}
          width={575}
          footer={[
            <Button key="cancel" onClick={handleMergeCancel}>
              取消
            </Button>,
            <Button key="confirm" type="primary" onClick={handleMergeConfirm}>
              确认
            </Button>,
          ]}
        >
          {/* Entity selection area */}
          <div className="flex gap-4 mb-6">
            {/* First entity option */}
            <div className="flex-1 flex items-center">
              <Radio
                checked={mergeForm.selectedEntity === 1}
                onChange={() => setMergeForm(prev => ({ ...prev, selectedEntity: 1 }))}
              />
              <Input
                className="flex-1 ml-2"
                value={mergeForm.entity1}
                onChange={(e) => setMergeForm(prev => ({ ...prev, entity1: e.target.value }))}
                placeholder="请输入实体名称"
              />
            </div>

            {/* Second entity option */}
            <div className="flex-1 flex items-center">
              <Radio
                checked={mergeForm.selectedEntity === 2}
                onChange={() => setMergeForm(prev => ({ ...prev, selectedEntity: 2 }))}
              />
              <Input
                className="flex-1 ml-2"
                value={mergeForm.entity2}
                onChange={(e) => setMergeForm(prev => ({ ...prev, entity2: e.target.value }))}
                placeholder="请输入实体名称"
              />
            </div>
          </div>

          {/* Merge visualization area */}
          <div className="relative flex flex-col items-center">
            {/* Dashed arrow container */}
            <div className="relative w-full h-10 mb-4 flex items-center justify-center">
              <div className="w-[140px] h-10 rounded-bl-lg border-l border-b border-dashed border-[#999999] relative">
                <SvgIcon name="right-one" size={18} className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 text-[#A3AAB9]" />
              </div>
              <div className="w-[140px] h-10 rounded-br-lg border-r border-b border-dashed border-[#999999] relative">
                <SvgIcon name="right-one" size={18} className="absolute -bottom-[10px] right-1/2 translate-x-1/2 text-[#A3AAB9]" />
              </div>
              <div className="absolute h-4 border-r border-dashed border-[#999999] -bottom-4 right-1/2 -translate-x-1/2" />
            </div>

            {/* Merge label */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2">
              <span className="text-sm text-[#182B5099]">合并为实体</span>
            </div>

            {/* Merged entity name input */}
            <div className="w-60 mx-auto mt-4">
              <Input
                value={mergeForm.mergedEntity}
                onChange={(e) => setMergeForm(prev => ({ ...prev, mergedEntity: e.target.value }))}
                placeholder="请输入合并后的实体名称"
                style={{ textAlign: 'center' }}
                className="w-full"
              />
            </div>
          </div>
        </Modal>
      </div>
    )
  }
)

GraphView.displayName = 'GraphView'

export default GraphView
