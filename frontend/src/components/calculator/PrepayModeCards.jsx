import styled from 'styled-components'
import { formatMoney } from '../../utils/format'
import SectionHeader from '../common/SectionHeader'

// CA-04 중도상환 후 방식 카드: 월 납입액 줄이기 / 기간 줄이기 두 카드를 나란히 비교, 카드를 누르면 방식을 바꾸고 다시 계산 (선택된 카드는 주황 2px)
// value: 지금 고른 방식 코드 / results: getPrepayModeResults 결과 { REDUCE_PAYMENT, SHORTEN_TERM: { nextPayment, totalInterest, lastRound } } / onChange(방식 코드)
// 상태 값: 부모 값 (LoanCalculator)
const MODES = [
  { code: 'REDUCE_PAYMENT', title: '월 납입액 줄이기', description: '갚는 기간은 그대로, 매달 내는 돈이 줄어요.' },
  { code: 'SHORTEN_TERM', title: '기간 줄이기', description: '매달 내는 돈은 그대로, 대출이 더 일찍 끝나요.' },
]

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const CardButton = styled.button.attrs({ type: 'button' })`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  &:hover {
    border-color: var(--cocoa);
  }
  &[aria-pressed='true'] {
    border-color: var(--brand);
    box-shadow: 0 0 0 1px var(--brand);
  }
`

const Title = styled.b`
  font-size: var(--fs-xl);
  font-weight: 800;
`

const Description = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Facts = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-md);
  div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }
  dt {
    color: var(--cocoa);
  }
  dd {
    margin: 0;
    font-family: var(--f-num);
    font-weight: 700;
  }
`

function PrepayModeCards({ value, results, onChange }) {
  return (
    <section>
      <SectionHeader title="중도상환 후 방식" description="중도상환한 뒤 월 납입액과 기간 중 무엇을 줄일지 골라요." />
      <Grid>
        {MODES.map((mode) => {
          const result = results[mode.code]
          return (
            <CardButton key={mode.code} aria-pressed={value === mode.code} onClick={() => onChange(mode.code)}>
              <Title>{mode.title}</Title>
              <Description>{mode.description}</Description>
              <Facts>
                <div>
                  <dt>다음 달 납입액</dt>
                  <dd>{result?.nextPayment == null ? '-' : formatMoney(result.nextPayment, '원')}</dd>
                </div>
                <div>
                  <dt>총이자</dt>
                  <dd>{result ? formatMoney(result.totalInterest, '원') : '-'}</dd>
                </div>
                <div>
                  <dt>끝나는 회차</dt>
                  <dd>{result ? `${result.lastRound}회차` : '-'}</dd>
                </div>
              </Facts>
            </CardButton>
          )
        })}
      </Grid>
    </section>
  )
}

export default PrepayModeCards
