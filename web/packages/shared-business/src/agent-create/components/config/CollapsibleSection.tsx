import { useState, ReactNode } from 'react'
import { SvgIcon } from '@km/shared-components-react'

export interface CollapsibleSectionProps {
  /** 标题 */
  title: string
  /** 右侧操作区 */
  actions?: ReactNode
  /** 默认展开状态 */
  defaultExpanded?: boolean
  /** 子内容 */
  children?: ReactNode
  /** 自定义类名 */
  className?: string
  /** 展开时的回调 */
  onExpand?: (expanded: boolean) => void
}

export function CollapsibleSection({
  title,
  actions,
  defaultExpanded = false,
  children,
  className = '',
  onExpand,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    onExpand?.(newExpanded)
  }

  return (
    <div className={`border-b ${className}`}>
      <div
        className="h-11 flex items-center gap-2 cursor-pointer hover:bg-[#F5F5F7]"
        onClick={handleToggle}
      >
        <SvgIcon name={expanded ? 'down' : 'right'} color="#9CA3AF" />
        <div className="flex-1 text-sm text-[#373A3D] font-semibold">
          {title}
        </div>
        {actions && (
          <div onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {expanded && (
        <div className="pt-1 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default CollapsibleSection
