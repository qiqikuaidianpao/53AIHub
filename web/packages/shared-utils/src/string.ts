/**
 * 字符串处理工具
 */

/**
 * 安全解析 JSON，解析失败时返回默认值
 */
export const JSONParse = <T = unknown>(value: string, defaultValue: T): any => {
  try {
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}
