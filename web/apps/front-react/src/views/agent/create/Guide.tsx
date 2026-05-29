import { useState, useMemo } from 'react'
import { Button, Modal, Form, Input, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { UploadImage } from '@/components/Upload/image'
import { t } from '@/locales'
import { generateRandomId } from '@km/shared-utils'
import { generateInputRules } from '@/utils/form-rules'

interface ChannelItem {
  id: string
  type: 'channel'
  image?: string
  name: string
  desc?: string
}

interface CaseItem {
  id: string
  type: 'case'
  input_text: string
  output_text: string
}

interface SceneItem {
  id: string
  type: 'scene'
  image?: string
  scene: string
  desc?: string
}

type UseCaseItem = ChannelItem | CaseItem | SceneItem

interface GuideProps {
  use_cases: UseCaseItem[]
  onChange: (useCases: UseCaseItem[]) => void
}

export function Guide({ use_cases, onChange }: GuideProps) {
  const [channelVisible, setChannelVisible] = useState(false)
  const [caseVisible, setCaseVisible] = useState(false)
  const [sceneVisible, setSceneVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<UseCaseItem | null>(null)
  const [channelForm] = Form.useForm()
  const [caseForm] = Form.useForm()
  const [sceneForm] = Form.useForm()

  // Computed lists
  const channelList = useMemo(() =>
    use_cases.filter((item): item is ChannelItem => item.type === 'channel'),
    [use_cases]
  )

  const useCaseList = useMemo(() =>
    use_cases.filter((item): item is CaseItem => item.type === 'case'),
    [use_cases]
  )

  const useSceneList = useMemo(() =>
    use_cases.filter((item): item is SceneItem => item.type === 'scene'),
    [use_cases]
  )

  // Channel handlers
  const onChannelOpen = (data?: ChannelItem) => {
    if (data) {
      setEditingItem(data)
      channelForm.setFieldsValue(data)
    } else {
      setEditingItem(null)
      channelForm.resetFields()
    }
    setChannelVisible(true)
  }

  const onChannelDelete = (index: number) => {
    const itemToRemove = channelList[index]
    if (itemToRemove) {
      const newList = use_cases.filter(item => item.id !== itemToRemove.id)
      onChange(newList)
    }
  }

  const onChannelConfirm = async () => {
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

      const existingIndex = use_cases.findIndex(item => item.id === id && item.type === 'channel')
      let newList: UseCaseItem[]
      if (existingIndex >= 0) {
        newList = [...use_cases]
        newList[existingIndex] = newItem
      } else {
        newList = [...use_cases, newItem]
      }
      onChange(newList)
      setChannelVisible(false)
    } catch (err) {
      // Validation failed
    }
  }

  // Case handlers
  const onCaseOpen = (data?: CaseItem) => {
    if (data) {
      setEditingItem(data)
      caseForm.setFieldsValue(data)
    } else {
      setEditingItem(null)
      caseForm.resetFields()
    }
    setCaseVisible(true)
  }

  const onCaseDelete = (index: number) => {
    const itemToRemove = useCaseList[index]
    if (itemToRemove) {
      const newList = use_cases.filter(item => item.id !== itemToRemove.id)
      onChange(newList)
    }
  }

  const onCaseConfirm = async () => {
    try {
      const values = await caseForm.validateFields()
      const id = (editingItem as CaseItem)?.id || generateRandomId(8)
      const newItem: CaseItem = {
        type: 'case',
        id,
        input_text: values.input_text || '',
        output_text: values.output_text || '',
      }

      const existingIndex = use_cases.findIndex(item => item.id === id && item.type === 'case')
      let newList: UseCaseItem[]
      if (existingIndex >= 0) {
        newList = [...use_cases]
        newList[existingIndex] = newItem
      } else {
        newList = [...use_cases, newItem]
      }
      onChange(newList)
      setCaseVisible(false)
    } catch (err) {
      // Validation failed
    }
  }

  // Scene handlers
  const onSceneOpen = (data?: SceneItem) => {
    if (data) {
      setEditingItem(data)
      sceneForm.setFieldsValue(data)
    } else {
      setEditingItem(null)
      sceneForm.resetFields()
    }
    setSceneVisible(true)
  }

  const onSceneDelete = (index: number) => {
    const itemToRemove = useSceneList[index]
    if (itemToRemove) {
      const newList = use_cases.filter(item => item.id !== itemToRemove.id)
      onChange(newList)
    }
  }

  const onSceneConfirm = async () => {
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

      const existingIndex = use_cases.findIndex(item => item.id === id && item.type === 'scene')
      let newList: UseCaseItem[]
      if (existingIndex >= 0) {
        newList = [...use_cases]
        newList[existingIndex] = newItem
      } else {
        newList = [...use_cases, newItem]
      }
      onChange(newList)
      setSceneVisible(false)
    } catch (err) {
      // Validation failed
    }
  }

  return (
    <div>
      {/* Usage channel */}
      <div className="flex items-center justify-between py-2 border-[#F0F0F0]">
        <span className="text-sm text-[#333]">{t('agent.usage_channel')}</span>
        <Button type="link" size="small" onClick={() => onChannelOpen()}>
          <PlusOutlined className="mr-1" />
          {t('action.add')}
        </Button>
      </div>
      <div className="flex flex-wrap mt-2">
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

      {/* Usage scene */}
      <div className="flex items-center justify-between py-2 border-[#F0F0F0] mt-3">
        <span className="text-sm text-[#333]">{t('agent.usage_scene')}</span>
        <Button type="link" size="small" onClick={() => onSceneOpen()}>
          <PlusOutlined className="mr-1" />
          {t('action.add')}
        </Button>
      </div>
      <div className="flex flex-wrap mt-2">
        {useSceneList.map((item, index) => (
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

      {/* Usage case */}
      <div className="flex items-center justify-between py-2 border-[#F0F0F0] mt-3">
        <span className="text-sm text-[#333]">{t('agent.usage_case')}</span>
        <Button type="link" size="small" onClick={() => onCaseOpen()}>
          <PlusOutlined className="mr-1" />
          {t('action.add')}
        </Button>
      </div>
      <div className="flex flex-wrap mt-2">
        {useCaseList.map((item, index) => (
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

      {/* Channel dialog */}
      <Modal
        open={channelVisible}
        title={editingItem ? t('agent.edit_channel') : t('agent.add_channel')}
        onCancel={() => setChannelVisible(false)}
        width={600}
        destroyOnHidden
        footer={
          <>
            <Button className="text-[#1D1E1F]" onClick={() => setChannelVisible(false)}>
              {t('action_cancel')}
            </Button>
            <Button type="primary" onClick={onChannelConfirm}>
              {t('action_confirm')}
            </Button>
          </>
        }
      >
        <Form form={channelForm} labelCol={{ flex: '102px' }} labelAlign="left" colon={false}>
          <Form.Item
            name="image"
            label={t('agent.qrcode')}
            rules={generateInputRules({ message: t('form_upload_placeholder') })}
          >
            <UploadImage className="!w-[120px] !h-[112px]" />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('agent.channel_name')}
            rules={[
              ...generateInputRules({ message: t('form_input_placeholder') }),
              { max: 20, message: t('form_input_placeholder_max_length', { max: 20 }) },
            ]}
          >
            <Input maxLength={20} showCount placeholder={t('agent.please_fill_channel_name')} />
          </Form.Item>
          <Form.Item
            name="desc"
            label="描述"
            rules={[
              ...generateInputRules({ message: t('form_input_placeholder') }),
              { max: 100, message: t('form_input_placeholder_max_length', { max: 100 }) },
            ]}
          >
            <Input.TextArea rows={5} maxLength={100} showCount placeholder={t('agent.please_fill_usage_guide')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Case dialog */}
      <Modal
        open={caseVisible}
        title={editingItem ? t('action.edit') : t('action.add')}
        onCancel={() => setCaseVisible(false)}
        width={600}
        destroyOnHidden
        footer={
          <>
            <Button className="text-[#1D1E1F]" onClick={() => setCaseVisible(false)}>
              {t('action_cancel')}
            </Button>
            <Button type="primary" onClick={onCaseConfirm}>
              {t('action_confirm')}
            </Button>
          </>
        }
      >
        <Form form={caseForm} labelCol={{ flex: '64px' }} labelAlign="left" colon={false}>
          <Form.Item
            name="input_text"
            label={t('chat.input')}
            rules={[
              ...generateInputRules({ message: t('form_input_placeholder') }),
              { max: 200, message: t('form_input_placeholder_max_length', { max: 200 }) },
            ]}
          >
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item
            name="output_text"
            label={t('chat.output')}
            rules={[
              ...generateInputRules({ message: t('form_input_placeholder') }),
              { max: 1000, message: t('form_input_placeholder_max_length', { max: 1000 }) },
            ]}
          >
            <Input.TextArea rows={10} maxLength={1000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Scene dialog */}
      <Modal
        open={sceneVisible}
        title={editingItem ? t('action.edit') : t('action.add')}
        onCancel={() => setSceneVisible(false)}
        width={600}
        destroyOnHidden
        footer={
          <>
            <Button className="text-[#1D1E1F]" onClick={() => setSceneVisible(false)}>
              {t('action_cancel')}
            </Button>
            <Button type="primary" onClick={onSceneConfirm}>
              {t('action_confirm')}
            </Button>
          </>
        }
      >
        <Form form={sceneForm} labelCol={{ flex: '102px' }} labelAlign="left" colon={false}>
          <Form.Item
            name="image"
            label={t('pictorial_image')}
            rules={generateInputRules({ message: t('form_upload_placeholder') })}
          >
            <UploadImage className="!w-[120px] !h-[112px]" />
          </Form.Item>
          <Form.Item
            name="scene"
            label={t('scene')}
            rules={[
              ...generateInputRules({ message: t('form_input_placeholder') }),
              { max: 20, message: t('form_input_placeholder_max_length', { max: 20 }) },
            ]}
          >
            <Input maxLength={20} showCount />
          </Form.Item>
          <Form.Item
            name="desc"
            label={t('form.desc')}
            rules={[
              ...generateInputRules({ message: t('form_input_placeholder') }),
              { max: 50, message: t('form_input_placeholder_max_length', { max: 50 }) },
            ]}
          >
            <Input.TextArea rows={5} maxLength={50} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Guide
