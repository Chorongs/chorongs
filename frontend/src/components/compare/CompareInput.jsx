import styled from 'styled-components'
import { InlineError } from '../../styles/common'
import ChipGroup from '../ui/ChipGroup'
import NumberField from '../ui/NumberField'

// CP-06 금액, 기간, 상환 방식 입력: 비교 기준 (빌릴 금액 만원 + 상환 기간 칩 + 상환 방식 칩). 모양은 시안과 같게 회색 판 없이 한 줄
// 값은 부모(ComparePage)가 들고 있고, 바꾸면 바로 부모가 다시 계산한다.
// 오류 문구(amountError, monthsError)도 부모가 검사해서 내려준다 (E2): 금액은 0보다 큰 숫자, 기간은 선택지 값만
// maxAmount(만원)를 넘는 금액은 입력 자체가 안 되고, 넘기려 하면 칸 아래에 경고
// 계산 기준 안내와 시작 값 근거는 카드 바로 위(ComparePage)에 있다.
// termOptions: 두 상품이 겹치는 용도 기준 기간 선택지 (개월 배열)
// methodOptions: 두 상품이 모두 가능한 상환 방식 ({ value 코드, label 글 } 배열). 2개 이상일 때만 칩을 보여 주고(1개 이하면 빈 배열이라 칩 숨김), 고른 방식으로 두 상품을 똑같이 계산
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

function CompareInput({
  amount,
  maxAmount,
  months,
  method,
  termOptions,
  methodOptions,
  amountError,
  monthsError,
  onAmountChange,
  onMonthsChange,
  onMethodChange,
}) {
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
          max={maxAmount}
          capMessage="10억원(100,000만원)까지만 입력할 수 있어요"
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
      {methodOptions.length > 0 && (
        <TermField>
          <Label>상환 방식</Label>
          <ChipGroup options={methodOptions} value={method} onChange={onMethodChange} label="상환 방식" />
        </TermField>
      )}
    </Wrap>
  )
}

export default CompareInput
