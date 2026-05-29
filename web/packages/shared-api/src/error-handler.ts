import { ElMessage } from 'element-plus'

import {
  RESPONSE_CODE,
  RESPONSE_STATUS,
  ERROR_MESSAGES,
  RESPONSE_CODE_MESSAGE_MAP,
  RESPONSE_DATA_MESSAGE_MAP,
  RESPONSE_MESSAGE_MAP,
  ResponseMessage,
} from './code.js'
import type { ResponseCode, ResponseStatus } from './code.js'

// 定义错误响应接口
interface ErrorResponse {
  status?: ResponseStatus
  response?: {
    status?: ResponseStatus
    data?: {
      code?: ResponseCode
      message?: string
      data?: any
      [key: string]: unknown
    }
  }
  message?: string
}

interface HandleErrorOptions {
  /** 是否忽略消息显示 */
  ignoreMessage?: boolean
  /** 是否忽略状态码 */
  ignoreStatus?: boolean
  /** 功能名称，在错误消息中显示 */
  functionName?: string
  /** i18n key 前缀（front 用 'common'，console 用 'module'） */
  featureI18nPrefix?: string
  /** 额外的清理 token keys（console 需清理 site_token） */
  additionalTokenKeys?: string[]
}

// 消息缓存，用于防止重复显示
const messageCache = new Map<string, number>()
const messageTimers = new Map<string, ReturnType<typeof setTimeout>>()
const CACHE_DURATION = 3000

// 显示消息（带去重功能）
function showMessage(message: string) {
  const now = Date.now()

  if (messageCache.has(message)) {
    const lastShowTime = messageCache.get(message)!
    if (now - lastShowTime < CACHE_DURATION) {
      return
    }

    const existingTimer = messageTimers.get(message)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
  }

  ElMessage.warning(message)
  messageCache.set(message, now)

  const timer = setTimeout(() => {
    messageCache.delete(message)
    messageTimers.delete(message)
  }, CACHE_DURATION)

  messageTimers.set(message, timer)
}

/**
 * 统一错误处理
 */
export function handleError(error: ErrorResponse, options?: HandleErrorOptions): Promise<never> {
  const status = error.response?.status || 500
  const featurePrefix = options?.featureI18nPrefix || 'common'

  let resData = error.response?.data
  try {
    if (resData && typeof resData === 'string') {
      resData = JSON.parse(resData)
    }
  } catch (_) {
    resData = {}
  }

  const code = resData?.code
  const data = resData?.data
  let message = resData?.message

  if (error.message === ResponseMessage.Canceled) {
    return Promise.reject(error)
  }
  if (code === RESPONSE_CODE.UNAUTHORIZED_INTERCEPTED) {
    return Promise.reject(error)
  }

  // 处理特殊错误
  if (message === 'feature not available: feature over limit') {
    return Promise.reject(
      ElMessage.warning(
        window.$t(`${featurePrefix}.feature_over_limit`, { functionName: options?.functionName || '' }),
      ),
    )
  }
  if (message === 'feature not available: feature not available') {
    return Promise.reject(
      ElMessage.warning(
        window.$t(`${featurePrefix}.feature_not_available`, { functionName: options?.functionName || '' }),
      ),
    )
  }

  const messageMatch = RESPONSE_MESSAGE_MAP.get(message || '')
  if (messageMatch) {
    if (messageMatch === 'not_tip') message = ''
    else message = window.$t(messageMatch)
  } else {
    message =
      (data !== undefined && RESPONSE_DATA_MESSAGE_MAP.get(data)
        ? window.$t(RESPONSE_DATA_MESSAGE_MAP.get(data)!)
        : '') ||
      message ||
      (code !== undefined && RESPONSE_CODE_MESSAGE_MAP.get(code)
        ? window.$t(RESPONSE_CODE_MESSAGE_MAP.get(code)!)
        : '') ||
      (ERROR_MESSAGES.get(status) ? window.$t(ERROR_MESSAGES.get(status)!) : '') ||
      error.message ||
      window.$t('response_message.unknown_error')
  }

  // 使用带去重功能的消息显示
  if (message && !options?.ignoreMessage && code !== RESPONSE_CODE.UNAUTHORIZED_ERROR) {
    showMessage(message)
  }

  if (
    code === RESPONSE_CODE.TOKEN_EXPIRED_ERROR ||
    code === RESPONSE_CODE.UNAUTHORIZED_ERROR ||
    (status === RESPONSE_STATUS.UNAUTHORIZED && localStorage.getItem('access_token'))
  ) {
    localStorage.removeItem('access_token')
    // 清理额外的 token（如 console 的 site_token）
    if (options?.additionalTokenKeys) {
      for (const key of options.additionalTokenKeys) {
        localStorage.removeItem(key)
      }
    }
    window.location.reload()
  }
  return Promise.reject(error)
}

/**
 * 清理所有消息缓存和定时器
 */
export function clearMessageCache(): void {
  for (const timer of messageTimers.values()) {
    clearTimeout(timer)
  }
  messageCache.clear()
  messageTimers.clear()
}

declare global {
  interface Window {
    /** vue-i18n，由应用在运行时挂载 */
    $t: (key: string, params?: Record<string, unknown>) => string
  }
}
