import { md5 } from '@km/shared-utils'

/**
 * 序列化参数对象为查询字符串
 */
function serialize(params: Record<string, any>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
}

/**
 * 生成签名参数
 * @param params 原始参数
 * @param authKey 认证密钥
 */
export function generateSignParams(params: Record<string, any> = {}, authKey: string) {
  const signParams = { ...params, timestamp: Math.floor(Date.now() / 1000), platform: 'web' }
  const strForSign = serialize(signParams)
  const sign = md5(strForSign + authKey)

  return {
    sign,
    method: 'md5',
    ...signParams,
  }
}

/**
 * 生成 iBos 签名参数
 * @param authKey 认证密钥
 */
export function generateIbosSignParams(authKey: string) {
  const platform = 'web'
  const createtime = Math.floor(Date.now() / 1000)
  const token = md5(authKey + createtime)
  return {
    token,
    platform,
    createtime,
  }
}
