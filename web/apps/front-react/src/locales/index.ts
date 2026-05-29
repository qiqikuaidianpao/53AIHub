import { parseCSV, csvToMessages } from '@km/shared-utils'
import { agentCreateMessages } from '@km/shared-business/agent-create'

// 直接复用 console 的 CSV 源，保证 key 与文案完全一致
// eslint-disable-next-line import/no-relative-packages
import csvRaw from './source.csv?raw'

const localeMessages = csvToMessages(parseCSV(csvRaw))

/** 深度合并两个对象，解决嵌套结构覆盖问题 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (key in result && typeof result[key] === 'object' && typeof source[key] === 'object') {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      )
    } else {
      result[key] = source[key]
    }
  }
  return result
}

const messages = {
  'zh-cn': deepMerge(agentCreateMessages['zh-cn'] as Record<string, unknown>, localeMessages['zh-cn'] as Record<string, unknown>),
  'zh-tw': deepMerge(agentCreateMessages['zh-tw'] as Record<string, unknown>, localeMessages['zh-tw'] as Record<string, unknown>),
  en: deepMerge(agentCreateMessages.en as Record<string, unknown>, localeMessages.en as Record<string, unknown>),
  ja: deepMerge(agentCreateMessages.ja as Record<string, unknown>, localeMessages.ja as Record<string, unknown>),
}

function getCurrentLocale(): string {
  if (typeof window === 'undefined') return 'zh-cn'

  const stored = localStorage.getItem('default_lang')
  if (stored) {
    // 兼容 'jp' -> 'ja' 映射
    if (stored === 'jp') return 'ja'
    return stored
  }

  const browserLang = navigator.language.toLowerCase()
  const isEn = /^en\b/.test(browserLang)
  const isJa = /^ja\b/.test(browserLang)
  const isTw = /^tw\b/.test(browserLang)
  return isJa ? 'ja' : isEn ? 'en' : isTw ? 'zh-tw' : 'zh-cn'
}

function getByPath(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return undefined
    }
  }
  return cur
}

function formatWithParams(text: string, params?: Record<string, unknown>): string {
  if (!params) return text
  return Object.keys(params).reduce((acc, key) => {
    const re = new RegExp(`\\{${key}\\}`, 'g')
    return acc.replace(re, String(params[key]))
  }, text)
}

const SHARED_PREFIX = '_shared.'

export function t(key: string, params?: Record<string, unknown>): string {
  const locale = getCurrentLocale()
  const bucket = (messages as any)[locale] as Record<string, unknown> | undefined

  // 先尝试 _shared. 前缀（优先使用分包翻译）
  let rawValue = getByPath(bucket, key)

  // 如果找不到，再尝试直接查找 key
  if (rawValue === undefined) {
    rawValue = getByPath(bucket, SHARED_PREFIX + key)
  }

  const raw = (typeof rawValue === 'string' && rawValue) || key
  return formatWithParams(raw, params)
}

export function setLocale(locale: string, reload = true): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('default_lang', locale)
    if (reload) {
      window.location.reload()
    }
  }
}

// 与 console 保持一致：挂到 window.$t，便于非 React 代码直接使用
declare global {
  interface Window {
    $t: (key: string, params?: Record<string, unknown>) => string
  }
}

if (typeof window !== 'undefined') window.$t = t

export { messages }

export default {
  t,
  messages,
}

