import styled from 'styled-components'
import { RATE_TAB_OPTIONS, SEARCH_SORT_OPTIONS } from '../../constants/options'
import Segmented from '../ui/Segmented'

// SR-06 결과 바: '검색 결과 N건' + 금리 탭 2개 (금리 표시 상품, 금리 기관 문의 상품 + 개수) + 정렬
// N = 금리 표시 상품 + 금리 기관 문의 상품 / 탭, 정렬을 바꾸면 부르는 쪽이 다시 검색함 (rt, sort)
// 금리 기관 문의 탭에서는 금리 낮은 순을 끔 (정렬 버튼에서 뺌)
// props: numCount 금리 표시 상품 수 / memoCount 금리 기관 문의 상품 수 (받는 중이면 null) / rt 'NUM' 또는 'MEMO' / sort
//   onChangeRt(값) / onChangeSort(값)
const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 28px 0 8px;
`

const Tabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
`

const Total = styled.h2`
  padding-right: 16px;
  border-right: 1px solid var(--line);
  font-size: var(--fs-xl);
  font-weight: 800;
`

const Tab = styled.button.attrs({ type: 'button' })`
  height: 36px;
  color: var(--muted);
  font-size: var(--fs-xl);
  font-weight: 800;
  cursor: pointer;
  & + & {
    padding-left: 16px;
    border-left: 1px solid var(--line);
    border-radius: 0;
  }
  &:hover,
  &[aria-pressed='true'] {
    color: var(--ink);
  }
`

const TabCount = styled.em`
  margin-left: 6px;
  font-family: var(--f-num);
  font-style: normal;
  ${Tab}[aria-pressed='true'] & {
    color: var(--brand-text);
  }
`

function ResultBar({ numCount, memoCount, rt, sort, onChangeRt, onChangeSort }) {
  const isReady = numCount !== null && memoCount !== null
  const sortOptions = SEARCH_SORT_OPTIONS.filter((option) => !(rt === 'MEMO' && option.value === 'rate'))

  return (
    <Bar>
      <Tabs role="group" aria-label="검색 결과 (금리 표시 여부)">
        <Total>검색 결과 {isReady ? `${numCount + memoCount}건` : '확인 중'}</Total>
        {RATE_TAB_OPTIONS.map((option) => (
          <Tab key={option.value} aria-pressed={rt === option.value} onClick={() => onChangeRt(option.value)}>
            {option.label}
            {isReady && <TabCount>{option.value === 'NUM' ? numCount : memoCount}</TabCount>}
          </Tab>
        ))}
      </Tabs>
      <Segmented options={sortOptions} value={sort} onChange={onChangeSort} label="정렬" />
    </Bar>
  )
}

export default ResultBar
