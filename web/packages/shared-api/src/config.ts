import axios, { type AxiosResponse, type AxiosRequestConfig } from 'axios'
import { generateSignParams, generateIbosSignParams } from './signature.js'
import { RESPONSE_CODE, RESPONSE_STATUS } from './code.js'

// 定义重试配置接口
interface RetryConfig {
  retry: number
  retryDelay: number
  count?: number
}

// 扩展 AxiosRequestConfig 类型
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 重试配置 */
    retryConfig?: RetryConfig
    /** ibos签名 */
    ibos_sign?: boolean
    /** 发送验证码签名 */
    code_sign?: boolean
    /** 需要身份验证 */
    requiresAuth?: boolean
  }
}

/** API 服务创建选项 */
export interface CreateApiServiceOptions {
  /** API 基础路径 */
  baseURL: string
  /** 认证密钥 */
  authKey: string
  /** 默认重试配置 */
  retryConfig?: RetryConfig
  /** 获取全局 AbortSignal 的函数（可选，front 使用） */
  getGlobalAbortSignal?: () => AbortSignal | null
  /** 响应拦截 - 是否检查 FORBIDDEN_ERROR（front 使用） */
  checkForbidden?: boolean
}

/** 默认重试配置 */
const defaultRetryConfig: RetryConfig = {
  count: 1,
  retry: 3,
  retryDelay: 1000,
}

/**
 * 创建 API 服务实例
 * 支持通过选项配置不同应用的差异
 */
export function createApiService(options: CreateApiServiceOptions) {
  const {
    baseURL,
    authKey,
    retryConfig: customRetryConfig,
    getGlobalAbortSignal,
    checkForbidden = false,
  } = options

  const service = axios.create({ baseURL })

  // 请求拦截器
  service.interceptors.request.use(
    (config) => {
      const params = config.params || {}
      const access_token = params.access_token || localStorage.getItem('access_token') || ''
      if (access_token) config.headers.set('Authorization', `Bearer ${access_token}`)

      // 如果需要身份验证，但没有 token
      if (config.requiresAuth && !access_token) {
        const error = new Error('Authentication required')
        ;(error as any).response = {
          status: RESPONSE_STATUS.SUCCESS,
          data: {
            code: RESPONSE_CODE.UNAUTHORIZED_INTERCEPTED,
            message: 'Authentication required',
          },
        }
        return Promise.reject(error)
      }

      if (config.ibos_sign) {
        const { token, platform, createtime } = generateIbosSignParams(authKey)
        config.headers.set('token', token)
        config.headers.set('platform', platform)
        config.headers.set('createtime', createtime)
      }

      // 自动注入全局 AbortSignal
      if (getGlobalAbortSignal) {
        const globalSignal = getGlobalAbortSignal()
        if (globalSignal && !config.signal) {
          config.signal = globalSignal
        }
      }

      return {
        ...config,
        params: config.code_sign ? generateSignParams(params, authKey) : params,
        retryConfig: {
          ...(customRetryConfig || defaultRetryConfig),
          ...(config.retryConfig || {}),
        },
      }
    },
    (error) => {
      return Promise.reject(error.response)
    },
  )

  // 响应拦截器
  service.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => {
      const data = response.data || {}

      // 检查 FORBIDDEN_ERROR（front 需要）
      if (checkForbidden && Number(data.code) === RESPONSE_CODE.FORBIDDEN_ERROR) {
        return Promise.reject(data) as any
      }

      if ([200, 201, 204].includes(response.status)) return response.data
      throw new Error(response.status.toString())
    },
    async (error) => {
      const { config } = error

      if (!config || !config.retryConfig) {
        return Promise.reject(error)
      }

      const shouldRetry = () => {
        if (!error.response) return true
        const { status } = error.response
        if (status >= 500 || status === 408) return true
        return false
      }

      if (!shouldRetry()) {
        return Promise.reject(error)
      }

      const { retry, retryDelay, count = 1 } = config.retryConfig

      if (count >= retry) {
        return Promise.reject(error)
      }

      config.retryConfig.count = count + 1

      await new Promise((resolve) => {
        setTimeout(resolve, retryDelay)
      })

      return service(config)
    },
  )

  // 封装通用请求方法
  function request<T = any>(config: AxiosRequestConfig): Promise<T> {
    return service(config).then((res) => res.data)
  }

  const get = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return request({ ...config, method: 'get', url })
  }

  const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return request({ ...config, method: 'post', url, data })
  }

  const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return request({ ...config, method: 'put', url, data })
  }

  const del = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return request({ ...config, method: 'delete', url })
  }

  const patch = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    return request({ ...config, method: 'patch', url, data })
  }

  return {
    service,
    request,
    get,
    post,
    put,
    del,
    patch,
  }
}
