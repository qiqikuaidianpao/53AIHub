/**
 * 企业相关类型定义
 */

export interface EnterpriseBanner {
  url_list: string[]
  interval: string
}

export interface EnterpriseVersion {
  product_id: number
  name: string
  version: number
  features: {
    [key: string]: {
      max: number
      name: string
    }
  }
  disabled_features: string
  created_time: number
  updated_time: number
}

export interface EnterpriseState {
  id: number
  display_name: string
  logo: string
  ico: string
  keywords: string[]
  copyright: string
  type: string
  banner: string
  language: string
  timezone: string
  domain: string
  slogan: string
  status: number
  description: string
  banner_info: EnterpriseBanner
  template_type: string
  layout_type: string
  created_time: number
  updated_time: number
  template_style_info: {
    [key: string]: any
    style_type: 'software' | 'website'
  }
  is_independent: boolean
  is_enterprise: boolean
  is_industry: boolean
  is_install_wecom: boolean
  version: number
  features: {
    [key: string]: any
  }
}
