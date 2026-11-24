import styled from 'styled-components'
import { SEARCH_FILTERS } from '../../constants/options'
import { Button, Chip } from '../../styles/common'
import Icon from '../ui/Icon'

// SR-04 적용 조건 칩: 지금 걸린 조건을 칩으로 (검색어 칩 + 조건 칩 X) / [초기화] / 조건이 없으면 안내 글
// X → 그 조건만 해제 (금융권 대분류의 소속 세분류가 전부 걸려 있으면 대분류 칩 하나로 묶어 보여 주고, X로 그 세분류를 모두 뺌)
// props: q 검색어 / selected { 필터 key: 고른 값 목록 } / groups 금융권 대분류 [{ label, members }]
//   onRemove({ key, values }): key 'q'는 검색어 / onReset: [초기화]
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
`

const List = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`

const Hint = styled.span`
  color: var(--muted);
  font-size: var(--fs-sm);
`

// 걸린 조건 → 칩 목록 [{ id, label, key, values }]
function buildChips(q, selected, groups) {
  const chips = []
  if (q) chips.push({ id: 'q', label: `“${q}”`, key: 'q', values: [] })
  SEARCH_FILTERS.forEach(({ key }) => {
    let rest = selected[key] ?? []
    if (key === 'fin') {
      groups.forEach((group) => {
        const members = group.members ?? []
        if (members.length > 0 && members.every((value) => rest.includes(value))) {
          chips.push({ id: `fin:${group.value}`, label: group.label ?? group.value, key, values: members })
          rest = rest.filter((value) => !members.includes(value))
        }
      })
    }
    rest.forEach((value) => chips.push({ id: `${key}:${value}`, label: value, key, values: [value] }))
  })
  return chips
}

function ActiveFilterChips({ q = '', selected = {}, groups = [], onRemove, onReset }) {
  const chips = buildChips(q, selected, groups)

  return (
    <Wrap>
      <List aria-label="적용 조건">
        {chips.length === 0 ? (
          <Hint>조건을 고르면 바로 결과가 바뀌어요</Hint>
        ) : (
          chips.map((chip) => (
            <Chip
              key={chip.id}
              $size="sm"
              aria-pressed="true"
              aria-label={`${chip.label} 조건 빼기`}
              onClick={() => onRemove({ key: chip.key, values: chip.values })}
            >
              {chip.label}
              <Icon name="close" size={13} />
            </Chip>
          ))
        )}
      </List>
      {chips.length > 0 && (
        <Button $variant="outline" $size="sm" onClick={onReset}>
          초기화
        </Button>
      )}
    </Wrap>
  )
}

export default ActiveFilterChips
