import styled from 'styled-components'
import { Chip } from '../../styles/common'
import useUiStore from '../../store/useUiStore'

// UI-07 칩 묶음: 칩 여러 개 중 고르기. 값은 부모가 관리 (value, onChange)
// options: [{ value, label }]
// 하나만 고르기: value = 값 하나 / 여러 개 고르기(isMultiple): value = 값 배열, max = 최대 개수
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

function ChipGroup({ options, value, onChange, isMultiple = false, max, size, label }) {
  const showToast = useUiStore((state) => state.showToast)
  const selected = isMultiple ? (value ?? []) : [value]

  const handleSelect = (optionValue) => {
    if (!isMultiple) {
      onChange(optionValue)
      return
    }
    if (selected.includes(optionValue)) {
      onChange(selected.filter((item) => item !== optionValue))
      return
    }
    // 최대 개수를 넘으면 알림만 띄우고 선택은 안 바꿈
    if (max && selected.length >= max) {
      showToast(`최대 ${max}개까지 고를 수 있어요`)
      return
    }
    onChange([...selected, optionValue])
  }

  return (
    <Wrap role="group" aria-label={label}>
      {options.map((option) => (
        <Chip
          key={option.value}
          $size={size}
          aria-pressed={selected.includes(option.value)}
          onClick={() => handleSelect(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </Wrap>
  )
}

export default ChipGroup
