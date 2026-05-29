import { useRef, useCallback } from 'react'

/**
 * 防抖搜索 hook
 * @param onSearch 搜索回调函数
 * @param delay 防抖延迟时间，默认 300ms
 */
export function useDebouncedSearch(
  onSearch: (value: string) => void,
  delay = 300,
) {
  const timerRef = useRef<number>(0)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  const onChange = useCallback(
    (value: string) => {
      clearTimeout(timerRef.current)
      if (!value) {
        // 清空时立即触发
        onSearchRef.current(value)
        return
      }
      timerRef.current = window.setTimeout(() => {
        onSearchRef.current(value)
      }, delay)
    },
    [delay],
  )

  const onSearchNow = useCallback(
    (value: string) => {
      clearTimeout(timerRef.current)
      onSearchRef.current(value)
    },
    [],
  )

  return { onChange, onSearchNow }
}

export default useDebouncedSearch