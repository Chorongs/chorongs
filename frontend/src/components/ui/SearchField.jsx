import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { IconButton } from '../../styles/common'
import Icon from './Icon'

// UI-10 검색 입력칸: 돋보기 / 입력 / 지우기(X)
// 값은 부모가 관리 (value, onChange). 서버 검색일 때는 onSearch를 넘긴다.
// onSearch: 입력 멈춘 뒤 0.3초 후 (E8), Enter 누르면 바로. 앞뒤 공백을 뺀 글자를 받음
const SEARCH_DELAY_MS = 300
const MAX_LENGTH = 50

const Form = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 8px 0 16px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  background: var(--paper);
  color: var(--cocoa);
  &:focus-within {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  @media (max-width: 899px) {
    height: 48px;
  }
`

const Input = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-size: var(--fs-lg);
  text-align: left;
`

// 지우기 칸 자리는 항상 잡아 두어 글자를 쓸 때 칸이 흔들리지 않게 함
const ClearSlot = styled.span`
  display: inline-flex;
  width: 36px;
  height: 36px;
`

function SearchField({ value, onChange, onSearch, placeholder = '검색어를 입력하세요', label = '검색' }) {
  const timerRef = useRef(null)

  // 화면을 떠날 때 기다리던 검색 취소
  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleChange = (event) => {
    // 앞쪽 공백은 받지 않고, 50자까지만
    const next = event.target.value.replace(/^\s+/, '').slice(0, MAX_LENGTH)
    onChange(next)
    if (!onSearch) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSearch(next.trim()), SEARCH_DELAY_MS)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    clearTimeout(timerRef.current)
    if (onSearch) onSearch(value.trim())
  }

  const handleClear = () => {
    clearTimeout(timerRef.current)
    onChange('')
    if (onSearch) onSearch('')
  }

  return (
    <Form role="search" onSubmit={handleSubmit}>
      <Icon name="search" />
      <Input
        type="text"
        value={value}
        maxLength={MAX_LENGTH}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        onChange={handleChange}
      />
      <ClearSlot>
        {value && (
          <IconButton aria-label="검색어 지우기" onClick={handleClear}>
            <Icon name="close" size={16} />
          </IconButton>
        )}
      </ClearSlot>
    </Form>
  )
}

export default SearchField
