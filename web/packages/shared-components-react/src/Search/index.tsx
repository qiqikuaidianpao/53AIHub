import React, { useState, useRef, useEffect } from 'react'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { SvgIcon } from '../SvgIcon'

export interface SearchProps {
  value?: string
  placeholder?: string
  text?: string
  size?: 'large' | 'middle' | 'small'
  disabled?: boolean
  className?: string
  onInput?: (value: string) => void
  onChange?: (value: string) => void
}

export const Search: React.FC<SearchProps> = ({
  value,
  placeholder,
  text,
  size = 'middle',
  disabled = false,
  className,
  onInput,
  onChange
}) => {
  const [input, setInput] = useState(value || '')
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<any>(null)

  useEffect(() => {
    if (value !== undefined) {
      setInput(value)
    }
  }, [value])

  useEffect(() => {
    if (searching && inputRef.current) {
      inputRef.current.focus()
    }
  }, [searching])

  const handleFocus = () => {
    if (disabled) return
    setSearching(true)
  }

  const handleBlur = () => {
    if (input) return
    setSearching(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    onInput?.(val)
  }

  const handlePressEnter = () => {
    onChange?.(input)
  }

  if (searching) {
    return (
      <Input
        ref={inputRef}
        value={input}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onPressEnter={handlePressEnter}
        placeholder={placeholder || '搜索'}
        prefix={<SearchOutlined />}
        size={size}
        allowClear
        disabled={disabled}
        className={`input-with-search ${className || ''}`}
        style={{ maxWidth: '230px' }}
      />
    )
  }

  return (
    <div
      className={`h-8 flex items-center gap-1 ${
        disabled ? 'text-[#999] cursor-not-allowed' : 'cursor-pointer text-[#576D9C]'
      } ${className || ''}`}
      onClick={handleFocus}
    >
      <SvgIcon name="search" size={16} />
      <span className="text-sm">{text || '搜索'}</span>
    </div>
  )
}

export default Search
