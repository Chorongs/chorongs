import styled from 'styled-components'
import { Chip } from '../../styles/common'

// SR-05 최근 검색 칩: 최근 상세 검색(FILTER) 조건 4개. 누르면 그 조건을 다시 적용 (적용은 부르는 쪽이 함)
// 회원만 보임: 비회원이거나 기록이 없으면 아무것도 안 그림 (서버는 10개 보관, 화면은 최근 4개)
// 기록 목록은 DetailSearch가 받아서 넘김 (같은 목록으로 '조건도 검색 기록도 없는지'도 판단하기 때문)
// props: items 최근 검색 목록 (API-22 GET items) / onSelect(item)
const MAX_SHOWN = 4

const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
`

const Title = styled.span`
  margin-right: 2px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

function RecentSearchChips({ items = [], onSelect }) {
  const shown = items.filter((item) => item.searchType === 'FILTER').slice(0, MAX_SHOWN)
  if (shown.length === 0) return null

  return (
    <Wrap aria-label="최근 검색">
      <Title>최근 검색</Title>
      {shown.map((item) => (
        <Chip key={item.searchId} $size="sm" onClick={() => onSelect(item)}>
          {item.searchLabel}
        </Chip>
      ))}
    </Wrap>
  )
}

export default RecentSearchChips
