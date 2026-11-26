import styled from 'styled-components'
import useCompareStore, { getCompareBase, getMethodLabels } from '../../store/useCompareStore'
import { Tag } from '../../styles/common'
import Icon from '../ui/Icon'

// CM-10 같은 용도 필터 띠: 비교할 상품의 용도, 상환 방식 필터 안내 (맞춤 추천, 상품 찾기, 찜한 대출에 표시)
// 남겨 둔 상품은 띠로 알리지 않고 쓰는 화면이 목록 맨 위에 고정해 보여 줌 (상세 검색, 간편 검색)
// '자금 용도와 상환 방식이 겹치는 상품만 보여요' + 기준 상품(비교 화면의 한 칸을 고르러 나온 중 남은 상품)의 용도 + 숨긴 개수. 기준이 없으면 띠도 같이 사라진다.
// 실제 목록 거르기는 쓰는 화면이 한다. (canCompare 또는 getCompareBlock 사용: 용도와 상환 방식을 함께 봄). hiddenCount: 거르면서 숨긴 상품 수
// 거르기 안내 띠: 전구 + 문장 + 자금 용도 칩 + 상환 방식 칩 + 숨긴 개수
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--mist);
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 600;
  & > [data-icon] {
    color: var(--brand-text);
  }
`

// 기준 상품의 자금 용도, 상환 방식: 흰 알약 칩에 회색 글자 (문장과 같은 회색, 띠 바탕(회색)과 구분되게 칩은 흰색으로 둠)
const ConditionChip = styled(Tag)`
  padding: 2px 10px;
  border-radius: var(--r-pill);
  background: var(--paper);
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

// 같은 종류 칩끼리는 가깝게(6px), 자금 용도 묶음과 상환 방식 묶음 사이에는 세로 구분선 ( | ). 선 양쪽 간격은 12px씩
const ChipGroup = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  & + &::before {
    content: '';
    width: 1px;
    height: 16px;
    margin-right: 6px;
    background: var(--muted);
    opacity: 0.6;
  }
`

const Count = styled.span`
  margin-left: auto;
  color: var(--cocoa);
  font-weight: 600;
`

function PurposeFilterBanner({ hiddenCount = 0 }) {
  const first = useCompareStore(getCompareBase)
  const hasFilter = Boolean(first?.purposes)

  if (!hasFilter) return null
  // 상환 방식 칩: 첫 상품이 지원하는 방식 (세 방식 모두인 상품은 거르는 조건이 아니라서 칩 없음)
  const methodLabels = getMethodLabels(first)

  return (
    <Wrap role="status">
      <Icon name="alert" size={16} />
      자금 용도와 상환 방식이 겹치는 상품만 보여요
      <ChipGroup>
        {first.purposes.map((purpose) => (
          <ConditionChip key={purpose}>
            {purpose}
          </ConditionChip>
        ))}
      </ChipGroup>
      {methodLabels.length > 0 && (
        <ChipGroup>
          {methodLabels.map((label) => (
            <ConditionChip key={label}>
              {label}
            </ConditionChip>
          ))}
        </ChipGroup>
      )}
      {hiddenCount > 0 && <Count>숨긴 상품 {hiddenCount}개</Count>}
    </Wrap>
  )
}

export default PurposeFilterBanner
