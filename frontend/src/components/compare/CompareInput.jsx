import styled from 'styled-components'
import { InlineError } from '../../styles/common'
import ChipGroup from '../ui/ChipGroup'
import NumberField from '../ui/NumberField'

// CP-06 금액, 기간 입력: 비교 기준 (빌릴 금액 만원 + 상환 기간 칩 + 계산 기준 안내). 모양은 시안과 같게 회색 판 없이 한 줄
// 값은 부모(ComparePage)가 들고 있고, 바꾸면 바로 부모가 다시 계산한다.
// 오류 문구(amountError, monthsError)도 부모가 검사해서 내려준다 (E2): 금액은 0보다 큰 숫자, 기간은 선택지 값만
// termOptions: 두 상품이 겹치는 용도 기준 기간 선택지 (개월 배열)
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-end;
  margin-top: 20px;
`

const AmountField = styled.div`
  width: 200px;
  @media (max-width: 899px) {
    width: 100%;
  }
`

const TermField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  @media (max-width: 899px) {
    width: 100%;
  }
`

const Label = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

const Hint = styled.p`
  flex: 1;
  min-width: 220px;
  padding-bottom: 14px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
  @media (max-width: 899px) {
    padding-bottom: 0;
  }
`

function CompareInput({ amount, months, termOptions, amountError, monthsError, onAmountChange, onMonthsChange }) {
  const options = termOptions.map((term) => ({ value: term, label: `${term}개월` }))

  return (
    <Wrap>
      <AmountField>
        <NumberField
          label="빌릴 금액"
          unit="만원"
          value={amount}
          onChange={onAmountChange}
          min={1}
          hasComma
          isRequired
          placeholder="예: 2,000"
          error={amountError}
        />
      </AmountField>
      <TermField>
        <Label>상환 기간</Label>
        <ChipGroup options={options} value={months} onChange={onMonthsChange} label="상환 기간" />
        <InlineError>{monthsError}</InlineError>
      </TermField>
      <Hint>월 상환액과 총이자는 두 상품 모두 금리 범위의 중간값, 원리금균등상환으로 계산해요.</Hint>
    </Wrap>
  )
}

export default CompareInput
