import { useState, useCallback, useMemo, type ComponentType } from 'react'
import { Button, Form, Input, Modal } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { generateRandomId } from '@km/shared-utils'

export interface ChannelItem {
  id: string
  type: 'channel'
  image?: string
  name: string
  desc?: string
}

export interface CaseItem {
  id: string
  type: 'case'
  input_text: string
  output_text: string
}

export interface SceneItem {
  id: string
  type: 'scene'
  image?: string
  scene: string
  desc?: string
}

export type UseCaseItem = ChannelItem | CaseItem | SceneItem

export interface AgentUsageGuideProps {
  /** 使用说明数据 */
  value: UseCaseItem[]
  /** 数据变更回调 */
  onChange: (value: UseCaseItem[]) => void
  /** 图片上传组件 */
  ImageUploadComponent?: ComponentType<{ className?: string; value?: string; onChange?: (url: string) => void }>
  /** 翻译函数 */
  t?: (key: string, params?: Record<string, any>) => string
  /** 自定义类名 */
  className?: string
}

export function AgentUsageGuide({
  value,
  onChange,
  ImageUploadComponent,
  t = (key) => key,
  className,
}: AgentUsageGuideProps) {
  // 弹框状态
  const [channelVisible, setChannelVisible] = useState(false)
  const [caseVisible, setCaseVisible] = useState(false)
  const [sceneVisible, setSceneVisible] = useState(false)
  const [channelForm] = Form.useForm()
  const [caseForm] = Form.useForm()
  const [sceneForm] = Form.useForm()
  const [editingItem, setEditingItem] = useState<UseCaseItem | null>(null)

  // 列表数据
  const channelList = useMemo(() =>
    value.filter((item): item is ChannelItem => item.type === 'channel'),
    [value]
  )

  const caseList = useMemo(() =>
    value.filter((item): item is CaseItem => item.type === 'case'),
    [value]
  )

  const sceneList = useMemo(() =>
    value.filter((item): item is SceneItem => item.type === 'scene'),
    [value]
  )

  // 渠道操作
  const onChannelOpen = useCallback((data?: ChannelItem) => {
    if (data) {
      setEditingItem(data)
      channelForm.setFieldsValue(data)
    } else {
      setEditingItem(null)
      channelForm.resetFields()
    }
    setChannelVisible(true)
  }, [channelForm])

  const onChannelDelete = useCallback((index: number) => {
    const itemToRemove = channelList[index]
    if (itemToRemove) {
      const newList = value.filter(item => item.id !== itemToRemove.id)
      onChange(newList)
    }
  }, [channelList, value, onChange])

  const onChannelConfirm = useCallback(async () => {
    try {
      const values = await channelForm.validateFields()
      const id = (editingItem as ChannelItem)?.id || generateRandomId(8)
      const newItem: ChannelItem = {
        type: 'channel',
        id,
        image: values.image || '',
        name: values.name || '',
        desc: values.desc || '',
      }

      let newList: UseCaseItem[]
      const existingIndex = value.findIndex(item => item.id === id && item.type === 'channel')
      if (existingIndex >= 0) {
        newList = [...value]
        newList[existingIndex] = newItem
      } else {
        newList = [...value, newItem]
      }
      onChange(newList)
      setChannelVisible(false)
    } catch (err) {
      // Validation failed
    }
  }, [editingItem, value, onChange, channelForm])

  // 案例操作
  const onCaseOpen = useCallback((data?: CaseItem) => {
    if (data) {
      setEditingItem(data)
      caseForm.setFieldsValue(data)
    } else {
      setEditingItem(null)
      caseForm.resetFields()
    }
    setCaseVisible(true)
  }, [caseForm])

  const onCaseDelete = useCallback((index: number) => {
    const itemToRemove = caseList[index]
    if (itemToRemove) {
      const newList = value.filter(item => item.id !== itemToRemove.id)
      onChange(newList)
    }
  }, [caseList, value, onChange])

  const onCaseConfirm = useCallback(async () => {
    try {
      const values = await caseForm.validateFields()
      const id = (editingItem as CaseItem)?.id || generateRandomId(8)
      const newItem: CaseItem = {
        type: 'case',
        id,
        input_text: values.input_text || '',
        output_text: values.output_text || '',
      }

      let newList: UseCaseItem[]
      const existingIndex = value.findIndex(item => item.id === id && item.type === 'case')
      if (existingIndex >= 0) {
        newList = [...value]
        newList[existingIndex] = newItem
      } else {
        newList = [...value, newItem]
      }
      onChange(newList)
      setCaseVisible(false)
    } catch (err) {
      // Validation failed
    }
  }, [editingItem, value, onChange, caseForm])

  // 场景操作
  const onSceneOpen = useCallback((data?: SceneItem) => {
    if (data) {
      setEditingItem(data)
      sceneForm.setFieldsValue(data)
    } else {
      setEditingItem(null)
      sceneForm.resetFields()
    }
    setSceneVisible(true)
  }, [sceneForm])

  const onSceneDelete = useCallback((index: number) => {
    const itemToRemove = sceneList[index]
    if (itemToRemove) {
      const newList = value.filter(item => item.id !== itemToRemove.id)
      onChange(newList)
    }
  }, [sceneList, value, onChange])

  const onSceneConfirm = useCallback(async () => {
    try {
      const values = await sceneForm.validateFields()
      const id = (editingItem as SceneItem)?.id || generateRandomId(8)
      const newItem: SceneItem = {
        type: 'scene',
        id,
        image: values.image || '',
        scene: values.scene || '',
        desc: values.desc || '',
      }

      let newList: UseCaseItem[]
      const existingIndex = value.findIndex(item => item.id === id && item.type === 'scene')
      if (existingIndex >= 0) {
        newList = [...value]
        newList[existingIndex] = newItem
      } else {
        newList = [...value, newItem]
      }
      onChange(newList)
      setSceneVisible(false)
    } catch (err) {
      // Validation failed
    }
  }, [editingItem, value, onChange, sceneForm])

  return (
    <div className={className}>
      {/* 渠道 */}
      <div className="flex items-center justify-between py-2 border-b border-[#F0F0F0]">
        <span className="text-sm text-[#333]">{t('agent.usage_channel')}</span>
        <Button type="link" size="small" onClick={() => onChannelOpen()}>
          <PlusOutlined className="mr-1" />
          {t('action.add')}
        </Button>
      </div>
      <div className="flex flex-wrap">
        {channelList.map((item, index) => (
          item.id && (
            <div key={item.id} className="w-full flex justify-between items-center py-[10px] px-3 mt-2 bg-white rounded">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#1D1E1F]">{item.name}</span>
              </div>
              <div className="flex gap-2">
                <Button type="link" icon={<EditOutlined />} onClick={() => onChannelOpen(item)} />
                <Button type="link" icon={<DeleteOutlined />} onClick={() => onChannelDelete(index)} />
              </div>
            </div>
          )
        ))}
      </div>

      {/* 场景 */}
      <div className="flex items-center justify-between py-2 border-b border-[#F0F0F0] mt-3">
        <span className="text-sm text-[#333]">{t('agent.usage_scene')}</span>
        <Button type="link" size="small" onClick={() => onSceneOpen()}>
          <PlusOutlined className="mr-1" />
          {t('action.add')}
        </Button>
      </div>
      <div className="flex flex-wrap">
        {sceneList.map((item, index) => (
          item.id && (
            <div key={item.id} className="w-full flex justify-between items-center py-[10px] px-3 mt-2 bg-white rounded">
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#1D1E1F]">{item.scene}</span>
              </div>
              <div className="flex gap-2">
                <Button type="link" icon={<EditOutlined />} onClick={() => onSceneOpen(item)} />
                <Button type="link" icon={<DeleteOutlined />} onClick={() => onSceneDelete(index)} />
              </div>
            </div>
          )
        ))}
      </div>

      {/* 案例 */}
      <div className="flex items-center justify-between py-2 border-b border-[#F0F0F0] mt-3">
        <span className="text-sm text-[#333]">{t('agent.usage_case')}</span>
        <Button type="link" size="small" onClick={() => onCaseOpen()}>
          <PlusOutlined className="mr-1" />
          {t('action.add')}
        </Button>
      </div>
      <div className="flex flex-wrap">
        {caseList.map((item, index) => (
          <div key={item.id} className="w-full flex justify-between items-center py-[10px] px-3 mt-2 bg-white rounded break-inside-avoid">
            <div className="text-sm text-[#1D1E1F] break-words">
              {item.input_text || '--'}
            </div>
            <div className="flex gap-2">
              <Button type="link" icon={<EditOutlined />} onClick={() => onCaseOpen(item)} />
              <Button type="link" icon={<DeleteOutlined />} onClick={() => onCaseDelete(index)} />
            </div>
          </div>
        ))}
      </div>

      {/* 渠道弹框 */}
      <Modal
        open={channelVisible}
        title={editingItem ? t('agent.edit_channel') : t('agent.add_channel')}
        onCancel={() => setChannelVisible(false)}
        onOk={onChannelConfirm}
        width={600}
        destroyOnHidden
      >
        <Form form={channelForm} labelCol={{ flex: '102px' }} labelAlign="left" colon={false}>
          <Form.Item
            name="image"
            label={t('agent.qrcode')}
            rules={[{ required: true, message: t('form.upload_placeholder') }]}
          >
            {ImageUploadComponent ? (
              <ImageUploadComponent className="!w-[120px] !h-[112px]" />
            ) : (
              <Input />
            )}
          </Form.Item>
          <Form.Item
            name="name"
            label={t('agent.channel_name')}
            rules={[
              { required: true, message: t('form.input_placeholder') },
              { max: 20, message: t('form.input_placeholder_max_length', { max: 20 }) },
            ]}
          >
            <Input maxLength={20} showCount placeholder={t('agent.please_fill_channel_name')} />
          </Form.Item>
          <Form.Item
            name="desc"
            label={t('form.desc')}
            rules={[
              { required: true, message: t('form.input_placeholder') },
              { max: 100, message: t('form.input_placeholder_max_length', { max: 100 }) },
            ]}
          >
            <Input.TextArea rows={5} style={{ resize: 'none' }} maxLength={100} showCount placeholder={t('agent.please_fill_usage_guide')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 案例弹框 */}
      <Modal
        open={caseVisible}
        title={editingItem ? t('action.edit') : t('action.add')}
        onCancel={() => setCaseVisible(false)}
        onOk={onCaseConfirm}
        width={600}
        destroyOnHidden
      >
        <Form form={caseForm} labelCol={{ flex: '64px' }} labelAlign="left" colon={false}>
          <Form.Item
            name="input_text"
            label={t('chat.input')}
            rules={[
              { required: true, message: t('form.input_placeholder') },
              { max: 200, message: t('form.input_placeholder_max_length', { max: 200 }) },
            ]}
          >
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="output_text"
            label={t('chat.output')}
            rules={[
              { required: true, message: t('form.input_placeholder') },
              { max: 1000, message: t('form.input_placeholder_max_length', { max: 1000 }) },
            ]}
          >
            <Input.TextArea rows={10} style={{ resize: 'none' }} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 场景弹框 */}
      <Modal
        open={sceneVisible}
        title={editingItem ? t('action.edit') : t('action.add')}
        onCancel={() => setSceneVisible(false)}
        onOk={onSceneConfirm}
        width={600}
        destroyOnHidden
      >
        <Form form={sceneForm} labelCol={{ flex: '102px' }} labelAlign="left" colon={false}>
          <Form.Item
            name="image"
            label={t('term.pictorial_image')}
            rules={[{ required: true, message: t('form.upload_placeholder') }]}
          >
            {ImageUploadComponent ? (
              <ImageUploadComponent className="!w-[120px] !h-[112px]" />
            ) : (
              <Input />
            )}
          </Form.Item>
          <Form.Item
            name="scene"
            label={t('common.scene')}
            rules={[
              { required: true, message: t('form.input_placeholder') },
              { max: 20, message: t('form.input_placeholder_max_length', { max: 20 }) },
            ]}
          >
            <Input maxLength={20} showCount />
          </Form.Item>
          <Form.Item
            name="desc"
            label={t('form.desc')}
            rules={[
              { required: true, message: t('form.input_placeholder') },
              { max: 50, message: t('form.input_placeholder_max_length', { max: 50 }) },
            ]}
          >
            <Input.TextArea rows={5} style={{ resize: 'none' }} maxLength={50} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AgentUsageGuide
