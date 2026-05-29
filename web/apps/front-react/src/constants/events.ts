export const EVENT_NAMES = {
  // 支付相关事件
  LOGIN_SUCCESS: 'login:success',
  UPGRADE_OPEN: 'upgrade:open',
} as const

// 导出事件名称类型
export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES]
