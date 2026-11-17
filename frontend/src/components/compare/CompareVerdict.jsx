import styled from 'styled-components'
import { formatMoney } from '../../utils/format'

// CP-02 판정 요약: 어느 쪽이 유리한지 'A 4 : 1 B' + 결론 한 줄 + 총이자 차이 문장 (모양은 시안과 같게)
// winners: 비교표 항목별 유리한 쪽 (utils/loanMath.js getCompareWinners) / resultA, resultB: 월 상환, 총이자 계산 결과 (getLoanResult)
// amountMan, months: 입력한 금액(만원), 기간(개월) / 유리 판정은 두 값이 다 있고 다를 때만 (winners가 이미 그렇게 줌)
// 총이자를 못 구하면 이유 문장 (금리 기관 문의 / 한도, 기간 초과)
const Wrap = styled.section`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px 28px;
  padding: 22px 26px;
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  @media (max-width: 899px) {
    padding: 18px 20px;
  }
`

const Score = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--f-num);
  b {
    font-size: var(--fs-h1);
    font-weight: 900;
    line-height: 1;
    @media (max-width: 899px) {
      font-size: var(--fs-h2);
    }
  }
  span {
    color: var(--muted);
    font-size: var(--fs-h3);
    font-weight: 800;
  }
`

const ScoreA = styled.b`
  color: var(--viz-2);
`

const ScoreB = styled.b`
  color: var(--viz-1);
`

const Text = styled.p`
  flex: 1;
  min-width: 240px;
  color: var(--ink-2);
  font-size: var(--fs-base);
  b {
    color: var(--ink);
  }
`

// 총이자를 못 구하는 이유
const REASON_TEXT = {
  NO_RATE: '금리가 별도 안내라서',
  OVER_LIMIT: '입력한 금액이나 기간이 한도를 넘어서',
  OVER_TERM: '입력한 금액이나 기간이 한도를 넘어서',
  INVALID: '입력값으로는 계산할 수 없어서',
  UNSUPPORTED_METHOD: '고른 상환 방식을 지원하지 않아서',
}

function countWins(winners, slot) {
  return Object.values(winners).filter((winner) => winner === slot).length
}

function CompareVerdict({ winners, resultA, resultB, amountMan, months }) {
  const winsA = countWins(winners, 'A')
  const winsB = countWins(winners, 'B')

  let lead = '두 상품이 비슷해요'
  if (winsA > winsB) lead = 'A가 더 많은 항목에서 유리해요'
  if (winsB > winsA) lead = 'B가 더 많은 항목에서 유리해요'

  const reasons = [
    ['A', resultA],
    ['B', resultB],
  ]
    .filter(([, result]) => result.status !== 'OK')
    .map(([slot, result]) => `${slot}는 ${REASON_TEXT[result.status] ?? '계산할 수 없어서'}`)

  let detail
  if (reasons.length > 0) {
    detail = `${reasons.join(', ')} 총이자를 비교할 수 없어요.`
  } else {
    const diff = Math.abs(resultA.totalInterest - resultB.totalInterest)
    const cheaper = resultA.totalInterest < resultB.totalInterest ? 'A' : 'B'
    detail =
      diff === 0 ? (
        '총이자는 두 상품이 같아요.'
      ) : (
        <>
          {formatMoney(amountMan)}을 {months}개월 동안 빌리면 총이자는{' '}
          <b>
            {cheaper}가 약 {formatMoney(diff, '원')} 적어요.
          </b>
        </>
      )
  }

  return (
    <Wrap aria-label="판정 요약">
      <Score aria-label={`A ${winsA}개, B ${winsB}개 항목 유리`}>
        <ScoreA>A {winsA}</ScoreA>
        <span>:</span>
        <ScoreB>{winsB} B</ScoreB>
      </Score>
      <Text>
        <b>{lead}.</b> {detail}
      </Text>
    </Wrap>
  )
}

export default CompareVerdict
