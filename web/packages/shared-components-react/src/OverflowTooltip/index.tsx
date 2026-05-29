import { Tooltip } from 'antd'
import { useRef, useState, useEffect, Children, type ReactElement } from 'react'

export interface OverflowTooltipProps {
  /** 需要省略的元素，必须设置 truncate 类 */
  children: ReactElement
  /** Tooltip 位置 */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * 溢出提示组件 - 自动检测子元素是否溢出，只在溢出时显示 Tooltip
 *
 * @example
 * <OverflowTooltip><span className="truncate">{text}</span></OverflowTooltip>
 * <OverflowTooltip><div className="truncate">{text}</div></OverflowTooltip>
 */
export function OverflowTooltip({
  children,
  placement = 'top',
}: OverflowTooltipProps) {
  const ref = useRef<HTMLElement>(null)
  const [isOverflow, setIsOverflow] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    const el = ref.current
    if (el) {
      setIsOverflow(el.scrollWidth > el.clientWidth)
      setText(el.textContent || '')
    }
  })

  const child = Children.only(children)
  const clone = { ...child, ref }

  return isOverflow ? <Tooltip title={text} placement={placement}>{clone}</Tooltip> : clone
}

export default OverflowTooltip
