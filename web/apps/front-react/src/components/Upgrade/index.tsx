import { useState, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Modal, Button, Divider, Radio, message } from 'antd'
import {
  CloseOutlined,
  LeftOutlined,
  RightOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons'
import PaymentQrcode, { PaymentQrcodeRef } from './payment-qrcode'
import subscriptionApi from '@/api/modules/subscription'
import { PAYMENT_TYPE, PAYMENT_TYPE_LABEL_MAP, type PaymentType } from '@/constants/payment'
import paymentApi from '@/api/modules/payment'
import { useUserStore } from '@/stores/modules/user'
import { getPublicPath } from '@/utils/config'
import { SubscriptionContext, type SubscriptionOption } from './context'
import './upgrade.css'

// Re-export the hook
export { useSubscriptionContext } from './context'

interface UpgradeRef {
  open: () => Promise<void>
  close: () => void
  validateUpgrade: () => Promise<boolean>
}

interface UpgradeProps {
  onSuccess?: () => void
}

export const Upgrade = forwardRef<UpgradeRef, UpgradeProps>(({ onSuccess }, ref) => {
  const userStore = useUserStore()
  const paymentQrcodeRef = useRef<PaymentQrcodeRef>(null)
  const scrollbarRef = useRef<HTMLDivElement>(null)

  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [subscriptionOptions, setSubscriptionOptions] = useState<SubscriptionOption[]>([])
  const [activeGroupId, setActiveGroupId] = useState('')
  const [activeTimeUnit, setActiveTimeUnit] = useState('month')
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollLeftLimit, setScrollLeftLimit] = useState(0)
  const [scrollLeftDistance, setScrollLeftDistance] = useState(0)
  const [activePayment, setActivePayment] = useState<PaymentType>(PAYMENT_TYPE.WECHAT)
  const [paymentOptions, setPaymentOptions] = useState<{ pay_type: PaymentType; label: string }[]>([])
  const [displayPaymentDetail, setDisplayPaymentDetail] = useState(false)

  const activeSubscriptionInfo = useMemo(
    () => subscriptionOptions.find((item) => item.group_id === activeGroupId) || null,
    [subscriptionOptions, activeGroupId]
  )

  const activeTimeInfo = useMemo(
    () => (activeSubscriptionInfo as any)?.[`${activeTimeUnit}_info`] || null,
    [activeSubscriptionInfo, activeTimeUnit]
  )

  const payDisabled = useMemo(
    () => !Number(activeTimeInfo?.amount || 0),
    [activeTimeInfo]
  )

  const contextValue = useMemo(
    () => ({
      activeSubscriptionInfo,
      activeTimeInfo,
      activePayment,
    }),
    [activeSubscriptionInfo, activeTimeInfo, activePayment]
  )

  const open = async () => {
    setVisible(true)
    loadPaymentSettingData()
    await loadSubscriptionData()
    if (subscriptionOptions[0]) {
      setActiveGroupId(subscriptionOptions[0].group_id)
    }
    calculateScrollLimits()
  }

  const close = () => {
    setVisible(false)
  }

  const loadSubscriptionData = async () => {
    const { access_token } = userStore.info
    if (!access_token) return subscriptionOptions

    if (subscriptionOptions.length) return subscriptionOptions

    setLoading(true)
    try {
      const { list = [] } = await subscriptionApi.list()
      setSubscriptionOptions(list)
      updateUserGroup()
      return list
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentSettingData = async ({ defaultDisabled = false } = {}) => {
    const list = await paymentApi.getAvailableList()
    const options = list
      .filter(
        (item: any) =>
          [PAYMENT_TYPE.WECHAT, PAYMENT_TYPE.ALIPAY, PAYMENT_TYPE.MANUAL].includes(item.pay_type) &&
          item.enabled &&
          item.configured
      )
      .map((item: any) => ({
        ...item,
        label: PAYMENT_TYPE_LABEL_MAP[item.pay_type as PaymentType],
      }))
    setPaymentOptions(options)
    if (!defaultDisabled && options[0]) {
      setActivePayment(options[0].pay_type)
    }
  }

  const validateUpgrade = async () => {
    await loadSubscriptionData()
    return subscriptionOptions.length > 0
  }

  const updateUserGroup = async ({ refresh = false } = {}) => {
    if (refresh) await userStore.getUserInfo()
    const subscriptionData = subscriptionOptions.find(
      (item) => item.group_id === userStore.info.group_id
    )
    if (subscriptionData) {
      userStore.setGroupName(subscriptionData.group_name || userStore.info.group_name)
      // userStore.setGroupIcon(subscriptionData.logo_url || userStore.info.group_icon)
    }
  }

  const calculateScrollLimits = () => {
    setTimeout(() => {
      if (!scrollbarRef.current) return
      const viewEl = scrollbarRef.current.querySelector('.upgrade-scrollbar-view')
      if (!viewEl) return
      const children = viewEl.children
      if (children.length > 3) {
        const childWidth = children[0].getBoundingClientRect().width
        setScrollLeftDistance(childWidth + 16)
        setScrollLeftLimit(childWidth + 16 * (children.length - 3))
      }
    }, 100)
  }

  const handleVersionSelect = (item: SubscriptionOption) => {
    setActiveGroupId(item.group_id || activeGroupId)
    setActiveTimeUnit('month')
    if (
      !Number(item.month_info?.amount) &&
      Number(item.year_info?.amount)
    ) {
      setActiveTimeUnit('year')
    }
  }

  const handleTimeUnitSelect = (unit: string) => {
    setActiveTimeUnit(unit)
  }

  const handleScrollLeft = () => {
    for (let i = 0; i < scrollLeftDistance; i += 6) {
      setTimeout(() => {
        const newScrollLeft = scrollLeft - 6
        setScrollLeft(newScrollLeft)
        if (scrollbarRef.current) {
          scrollbarRef.current.scrollLeft = newScrollLeft
        }
      }, 1)
    }
  }

  const handleScrollRight = () => {
    for (let i = 0; i < scrollLeftDistance; i += 6) {
      setTimeout(() => {
        const newScrollLeft = scrollLeft + 6
        setScrollLeft(newScrollLeft)
        if (scrollbarRef.current) {
          scrollbarRef.current.scrollLeft = newScrollLeft
        }
      }, 1)
    }
  }

  const handleQrcodeOpen = async () => {
    await loadPaymentSettingData({ defaultDisabled: true })
    if (!paymentOptions.length) {
      message.warning('支付功能未配置')
    } else {
      paymentQrcodeRef.current?.open()
    }
  }

  useImperativeHandle(ref, () => ({
    open,
    close,
    validateUpgrade,
  }))

  // Listen for custom event to open modal
  useEffect(() => {
    const handleOpenModal = () => {
      open()
    }
    window.addEventListener('open-upgrade-modal', handleOpenModal)
    return () => window.removeEventListener('open-upgrade-modal', handleOpenModal)
  }, [])

  return (
    <SubscriptionContext.Provider value={contextValue}>
      <Modal
        open={visible}
        onCancel={close}
        footer={null}
        closable={false}
        width="90%"
        style={{ maxWidth: 1200 }}
        className="upgrade-modal"
        destroyOnHidden
      >
        <div className="upgrade-container">
          <div className="upgrade-main">
            <CloseOutlined className="upgrade-close mobile-hide" onClick={close} />
            <CloseOutlined className="upgrade-close mobile-show" onClick={close} />

            <h1 className="upgrade-title">选择版本</h1>

            <div className="upgrade-versions">
              {scrollLeft > 0 && (
                <Button
                  className="upgrade-scroll-btn left"
                  shape="circle"
                  icon={<LeftOutlined />}
                  onClick={handleScrollLeft}
                />
              )}

              <div ref={scrollbarRef} className="upgrade-scrollbar">
                <div className="upgrade-scrollbar-view">
                  {subscriptionOptions.map((item) => (
                    <div
                      key={item.group_id}
                      className={`upgrade-version-card ${
                        item.group_id === activeGroupId ? 'active' : ''
                      }`}
                      onClick={() => handleVersionSelect(item)}
                    >
                      <header className="upgrade-version-header">
                        <img
                          src={
                            !/\.png$/.test(item.logo)
                              ? getPublicPath(`/images/subscription/${item.logo}.png`)
                              : item.logo
                          }
                          alt={item.group_name}
                          className="upgrade-version-logo"
                        />
                        <h2 className="upgrade-version-name">{item.group_name}</h2>
                      </header>
                      <Divider />
                      <div className="upgrade-version-price">
                        <span className="price-symbol">{item.month_info.currency_symbol}</span>
                        <span className="price-amount">{item.month_info.amount}</span>
                        <span className="price-unit">/ 月</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {scrollLeft < scrollLeftLimit && scrollLeftLimit > 0 && (
                <Button
                  className="upgrade-scroll-btn right"
                  shape="circle"
                  icon={<RightOutlined />}
                  onClick={handleScrollRight}
                />
              )}
            </div>

            {activeTimeInfo && Number(activeTimeInfo.amount) > 0 && (
              <>
                <h1 className="upgrade-title">选择购买时长</h1>
                <ul className="upgrade-time-options">
                  {['month', 'year'].map((key) => {
                    const info = (activeSubscriptionInfo as any)?.[`${key}_info`]
                    if (!info || !Number(info.amount)) return null
                    return (
                      <li
                        key={key}
                        className={`upgrade-time-option ${key === activeTimeUnit ? 'active' : ''}`}
                        onClick={() => handleTimeUnitSelect(key)}
                      >
                        <div className="time-label">{key === 'month' ? '1个月' : '1年'}</div>
                        <div className="time-price">
                          <span className="price-symbol">{info.currency_symbol || '¥'}</span>
                          <span className="price-amount">{info.amount}</span>
                          <span className="price-unit">/ {key === 'month' ? '月' : '年'}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>

          <aside className="upgrade-aside">
            <CloseOutlined className="upgrade-close" onClick={close} />
            <h2 className="upgrade-aside-title">订单确认</h2>
            <p className="upgrade-aside-desc">请确认您的订阅信息</p>
            <div className="upgrade-user">
              <img src={userStore.info.avatar} alt="" className="upgrade-user-avatar" />
              <div className="upgrade-user-name">{userStore.info.nickname}</div>
            </div>
            <Divider />
            <div className="upgrade-order-info">
              <span>{activeSubscriptionInfo?.group_name || '- -'}</span>
              <span>
                {activeTimeInfo?.currency_symbol || '¥'}
                {activeTimeInfo?.amount || 0}
              </span>
            </div>
            {Number(activeTimeInfo?.amount) > 0 && (
              <>
                <Divider />
                {paymentOptions.length > 1 && (
                  <div className="upgrade-payment">
                    <h2 className="upgrade-payment-title">支付方式</h2>
                    <Radio.Group
                      value={activePayment}
                      onChange={(e) => setActivePayment(e.target.value)}
                      disabled={payDisabled}
                    >
                      {paymentOptions.map((opt) => (
                        <Radio key={opt.pay_type} value={opt.pay_type}>
                          {opt.label}
                        </Radio>
                      ))}
                    </Radio.Group>
                  </div>
                )}
                <div className="upgrade-total">
                  <span>合计</span>
                  <span>
                    {activeTimeInfo?.currency_symbol || '¥'}
                    {Number(activeTimeInfo?.amount || 0).toFixed(2)}
                  </span>
                </div>
                <Button
                  type="primary"
                  size="large"
                  block
                  disabled={payDisabled}
                  onClick={handleQrcodeOpen}
                >
                  支付
                </Button>
              </>
            )}
          </aside>
        </div>
      </Modal>

      <PaymentQrcode
        ref={paymentQrcodeRef}
        onSuccess={() => updateUserGroup({ refresh: true })}
      />
    </SubscriptionContext.Provider>
  )
})

export default Upgrade
