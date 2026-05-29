import { createContext, useContext } from 'react'
import { PAYMENT_TYPE, type PaymentType } from '@/constants/payment'

export interface SubscriptionOption {
  group_id: string
  group_name: string
  logo: string
  month_info: {
    currency_symbol: string
    amount: number
    time_unit: string
    currency: string
  }
  year_info: {
    currency_symbol: string
    amount: number
    time_unit: string
    currency: string
  }
  credit_month_info: {
    amount: number
  }
  ai_enabled?: boolean
  agents?: { name: string; logo: string }[]
}

interface SubscriptionContextValue {
  activeSubscriptionInfo: SubscriptionOption | null
  activeTimeInfo: { currency_symbol?: string; amount?: number; currency?: string; time_unit?: string } | null
  activePayment: PaymentType
}

export const SubscriptionContext = createContext<SubscriptionContextValue>({
  activeSubscriptionInfo: null,
  activeTimeInfo: null,
  activePayment: PAYMENT_TYPE.WECHAT,
})

export const useSubscriptionContext = () => useContext(SubscriptionContext)
