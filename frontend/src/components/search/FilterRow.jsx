import styled from 'styled-components'
import { FIN_GROUP_NOTE, SEARCH_FILTER_MAX } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import Icon from '../ui/Icon'

// SR-03 필터 한 줄: 라벨 + 칩 (시안 .frow). 칩 값과 순서, 상품 수는 서버(API-52) 응답 그대로
// 여러 개 고르기, [전체] → 그 필터 해제 / 칩 글자 옆에 상품 수 (전체 게시 상품 기준)
// 금융권(groups가 있을 때): 위 줄은 대분류 칩 (은행권, 비은행권, 정책금융 + 작은 글씨 1금융권, 2금융권),
//   대분류를 고르거나 그 소속 세분류를 고르면 아래에 세분류 줄이 열림.
//   서버에는 대분류가 없으므로 대분류를 고르면 그 소속 세분류 값 전부를 selected에 넣어 보냄 (주소 fin도 같음)
//   소속 세분류가 전부 selected에 있을 때 대분류 칩이 선택된 것으로 그림, 일부만 있으면 글자만 주황 (시안 .part)
// props: label 줄 이름 / chips [{ value, label, count }] / groups [{ value, label, count, members }] / selected 고른 값 목록
//   hint 줄 아래 작은 안내 (신용점수 'NICE 기준') / onChange(다음 값 목록)
const Row = styled.div`
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  & + & {
    border-top: 1px solid var(--line);
  }
  @media (max-width: 899px) {
    grid-template-columns: 84px minmax(0, 1fr);
  }
`

const Label = styled.span`
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: var(--mist-2);
  color: var(--ink);
  font-weight: 800;
  @media (max-width: 899px) {
    padding: 12px;
    font-size: var(--fs-sm);
  }
`

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`

const Options = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 20px;
  padding: 12px 20px;
  @media (max-width: 899px) {
    gap: 4px 16px;
    padding: 8px 12px;
  }
`

const Option = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  margin: 0 -8px;
  padding: 0 8px;
  border-radius: var(--r-xs);
  color: ${({ $isPart }) => ($isPart ? 'var(--brand-text)' : 'var(--ink-2)')};
  font-size: var(--fs-base);
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    background: var(--mist);
    color: var(--ink);
  }
  &[aria-pressed='true'] {
    color: var(--brand-text);
    font-weight: 800;
  }
`

const Count = styled.small`
  color: var(--muted);
  font-family: var(--f-num);
  font-size: var(--fs-xs);
  font-weight: 700;
`

// 금융권 대분류 아래 작은 글씨 (1금융권, 2금융권)
const Note = styled.small`
  padding: 2px 6px;
  border-radius: var(--r-xs);
  background: var(--mist);
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 700;
`

const SubRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 0 20px;
  border-top: 1px dashed var(--line-2);
  background: var(--mist);
  & > ${Options} {
    padding: 12px 0;
  }
  @media (max-width: 899px) {
    flex-direction: column;
    gap: 0;
    padding: 0 12px;
    & > ${Options} {
      padding: 4px 0 8px;
    }
  }
`

const SubTitle = styled.b`
  flex: none;
  padding-top: 18px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  @media (max-width: 899px) {
    padding-top: 12px;
  }
`

const Hint = styled.p`
  margin: -4px 0 0;
  padding: 0 20px 12px;
  color: var(--muted);
  font-size: var(--fs-sm);
  @media (max-width: 899px) {
    padding: 0 12px 8px;
  }
`

function FilterRow({ label, chips = [], groups = [], selected = [], hint = '', onChange }) {
  const showToast = useUiStore((state) => state.showToast)
  const isGrouped = groups.length > 0

  // 칩 하나 켜기, 끄기 (한 필터 최대 20개)
  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
      return
    }
    if (selected.length >= SEARCH_FILTER_MAX) {
      showToast(`최대 ${SEARCH_FILTER_MAX}개까지 고를 수 있어요`)
      return
    }
    onChange([...selected, value])
  }

  // 대분류: 소속 세분류가 전부 켜져 있으면 전부 끄고, 아니면 전부 켬
  const toggleGroup = (group) => {
    const members = group.members ?? []
    const isOn = members.length > 0 && members.every((value) => selected.includes(value))
    if (isOn) {
      onChange(selected.filter((value) => !members.includes(value)))
      return
    }
    onChange([...new Set([...selected, ...members])].slice(0, SEARCH_FILTER_MAX))
  }

  const renderChip = (chip) => (
    <Option key={chip.value} aria-pressed={selected.includes(chip.value)} onClick={() => toggle(chip.value)}>
      {selected.includes(chip.value) && <Icon name="check" size={15} />}
      {chip.label ?? chip.value}
      <Count>{chip.count}</Count>
    </Option>
  )

  return (
    <Row>
      <Label>{label}</Label>
      <Cell>
        <Options role="group" aria-label={label}>
          <Option aria-pressed={selected.length === 0} onClick={() => onChange([])}>
            전체
          </Option>
          {isGrouped
            ? groups.map((group) => {
                const members = group.members ?? []
                const isOn = members.length > 0 && members.every((value) => selected.includes(value))
                const isPart = !isOn && members.some((value) => selected.includes(value))
                return (
                  <Option key={group.value} $isPart={isPart} aria-pressed={isOn} onClick={() => toggleGroup(group)}>
                    {isOn && <Icon name="check" size={15} />}
                    {group.label ?? group.value}
                    {FIN_GROUP_NOTE[group.value] && <Note>{FIN_GROUP_NOTE[group.value]}</Note>}
                    <Count>{group.count}</Count>
                  </Option>
                )
              })
            : chips.map(renderChip)}
        </Options>
        {isGrouped &&
          groups
            .filter((group) => (group.members ?? []).some((value) => selected.includes(value)))
            .map((group) => (
              <SubRow key={group.value}>
                <SubTitle>{group.label ?? group.value} 세분류</SubTitle>
                <Options role="group" aria-label={`${group.label ?? group.value} 세분류`}>
                  {chips.filter((chip) => (group.members ?? []).includes(chip.value)).map(renderChip)}
                </Options>
              </SubRow>
            ))}
        {hint && <Hint>{hint}</Hint>}
      </Cell>
    </Row>
  )
}

export default FilterRow
