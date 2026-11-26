import styled from 'styled-components'
import { SEARCH_FILTERS } from '../../constants/options'
import { Button, Chip } from '../../styles/common'
import Icon from '../ui/Icon'
import { LockMark } from './FilterRow'

// SR-04 적용 조건 칩: 지금 걸린 조건을 칩으로 (검색어 칩 + 조건 칩 X) / [초기화] / 조건이 없으면 안내 글
// X → 그 조건만 해제 (금융권 대분류의 소속 세분류가 전부 걸려 있으면 대분류 칩 하나로 묶어 보여 주고, X로 그 세분류를 모두 뺌)
// 고정된 조건(비교할 상품을 고르는 중의 자금 용도, 상환 방법)은 자물쇠 칩: X 없음, 누를 수 없음 (CHORONG-82)
// props: q 검색어 / selected { 필터 key: 고른 값 목록 } / locked { 필터 key: 고정된 값 목록 } / groups 금융권 대분류 [{ label, members }]
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

// 고정된 조건: 켜진 칩과 같은 모양이지만 버튼이 아니라서 누를 수 없음
const LockedChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--brand);
  border-radius: var(--r-pill);
  background: var(--brand-soft);
  color: var(--brand-text);
  font-size: var(--fs-sm);
  font-weight: 800;
  white-space: nowrap;
`

// 걸린 조건 → 칩 목록 [{ id, label, key, values, isLocked }] (고정된 조건이 맨 앞, 그다음 검색어, 필터 줄 순서)
function buildChips(q, selected, locked, groups) {
  const chips = SEARCH_FILTERS.flatMap(({ key }) =>
    (locked[key] ?? []).map((value) => ({ id: `${key}:${value}`, label: value, isLocked: true })),
  )
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

function ActiveFilterChips({ q = '', selected = {}, locked = {}, groups = [], onRemove, onReset }) {
  const chips = buildChips(q, selected, locked, groups)

  return (
    <Wrap>
      <List aria-label="적용 조건">
        {chips.length === 0 ? (
          <Hint>조건을 고르면 바로 결과가 바뀌어요</Hint>
        ) : (
          chips.map((chip) =>
            chip.isLocked ? (
              <LockedChip key={chip.id} title="비교할 상품 기준으로 고정돼 있어요">
                <LockMark />
                {chip.label}
              </LockedChip>
            ) : (
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
            ),
          )
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
