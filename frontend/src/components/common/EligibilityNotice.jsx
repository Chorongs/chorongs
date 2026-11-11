import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { postEligibility } from '../../api/productApi'
import { useRecommendStore } from '../../store/useRecommendStore'

// 판정 코드 → 화면 글자, 색 (판정 이유 문장은 서버가 보낸 그대로 표시)
const RESULT_LABELS = {
  PASS: '충족',
  WARN: '주의',
  FAIL: '미충족',
}

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--mist);
  font-family: var(--f-ui);
  font-size: var(--fs-md);
  color: var(--ink);
`

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const Title = styled.h3`
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 800;
`

const Badge = styled.span`
  padding: 4px 8px;
  border-radius: var(--r-xs);
  font-size: var(--fs-xs);
  font-weight: 700;
  color: ${({ $result }) =>
    $result === 'PASS' ? 'var(--good)' : $result === 'WARN' ? 'var(--warn)' : 'var(--bad)'};
  background: ${({ $result }) =>
    $result === 'PASS'
      ? 'var(--good-soft)'
      : $result === 'WARN'
        ? 'var(--warn-soft)'
        : 'var(--bad-soft)'};
`

const ReasonList = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--ink-2);
`

const Numbers = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 12px;

  dt {
    color: var(--cocoa);
  }

  dd {
    margin: 0;
    font-family: var(--f-num);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`

const Note = styled.p`
  margin: 0;
  font-size: var(--fs-sm);
  color: var(--muted);
`

const Message = styled.p`
  margin: 0;
  color: var(--ink-2);
`

/*
    CM-08 내 조건 안내
    - props: productId, productStatus (ProductSummaryDTO의 값)
    - 최근 추천 입력(lastInput)이 있고 게시(ON) 상품일 때만 표시. 판매 종료, 숨김 상품은 API-44를 안 부름
    - 판정, 이유 문장, 예상 금리, 월 상환은 서버가 보낸 값 그대로 표시
*/
function EligibilityNotice({ productId, productStatus }) {
  const lastInput = useRecommendStore((state) => state.lastInput)
  const [tryCount, setTryCount] = useState(0)
  // 어떤 요청(상품, 입력, 시도 횟수)에 대한 응답인지 함께 담아, 요청이 바뀌면 자동으로 '불러오는 중'이 됨
  const [done, setDone] = useState(null)

  const isActive = productStatus === 'ON' && lastInput !== null
  const isCurrent =
    done !== null &&
    done.productId === productId &&
    done.lastInput === lastInput &&
    done.tryCount === tryCount

  useEffect(() => {
    if (!isActive) return undefined

    let isCancelled = false
    postEligibility(productId, lastInput)
      .then((data) => {
        if (!isCancelled) setDone({ productId, lastInput, tryCount, data, hasFailed: false })
      })
      .catch(() => {
        // 서버 오류 내용은 화면에 그대로 내지 않음 (E3)
        if (!isCancelled) setDone({ productId, lastInput, tryCount, data: null, hasFailed: true })
      })

    return () => {
      isCancelled = true
    }
  }, [isActive, productId, lastInput, tryCount])

  if (!isActive) return null

  const handleRetry = () => setTryCount((count) => count + 1)

  if (!isCurrent) {
    return (
      <Wrap aria-label="내 조건 안내">
        <Message>내 조건을 확인하는 중이에요</Message>
      </Wrap>
    )
  }

  if (done.hasFailed) {
    return (
      <Wrap aria-label="내 조건 안내">
        <Message>내 조건을 확인하지 못했어요</Message>
        {/* TODO(UI-01): 공통 Button(작은 크기)으로 바꾸기 (공통 부품이 올라온 뒤 연결) */}
        <button type="button" onClick={handleRetry}>
          다시 시도
        </button>
      </Wrap>
    )
  }

  const { result, reasons, estRateMin, estRateMax, rateEstimated, monthlyPayment, calcNote } =
    done.data

  return (
    <Wrap aria-label="내 조건 안내">
      <Head>
        <Title>내 조건으로 신청할 수 있을까요?</Title>
        <Badge $result={result}>{RESULT_LABELS[result] ?? result}</Badge>
      </Head>
      {reasons.length > 0 && (
        <ReasonList>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ReasonList>
      )}
      {result === 'PASS' && (
        <>
          <Numbers>
            <dt>예상 금리</dt>
            <dd>
              연 {estRateMin.toFixed(2)}~{estRateMax.toFixed(2)}%{rateEstimated ? ' (추정)' : ''}
            </dd>
            <dt>예상 월 상환</dt>
            <dd>{monthlyPayment.toLocaleString('ko-KR')}원</dd>
          </Numbers>
          {calcNote && <Note>{calcNote}</Note>}
        </>
      )}
    </Wrap>
  )
}

export default EligibilityNotice
