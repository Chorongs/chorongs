import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useAuthStore from '../../store/useAuthStore'
import { Button } from '../../styles/common'
import { formatDate, formatMoney, formatRate } from '../../utils/format'
import { CALC_METHODS } from '../../utils/loanMath'
import MySection from '../my/MySection'

// CA-07 계산 기록 목록: 저장한 기록 줄 / [불러오기] / 줄마다 지우기 / 전체 지우기 (API-24)
// 목록 틀(제목, 지우기 확인 창, 불러오는 중, 실패, 빈 상태)은 MY의 MySection(MY-03)을 다시 씀 (삭제는 확인 창 뒤에, E3, E11)
// - 비회원: API를 부르지 않고 '로그인하면 저장 가능' 문구만 (확인 중에는 아무것도 안 그림)
// - [불러오기]: onLoad(item)이 있으면 그 화면이 입력칸을 채움 (계산기). 없으면 계산기(/calc)로 이동하며 기록 한 줄을 넘김 (MY 계산 기록)
// - refreshKey: 바뀌면 목록을 다시 받음 (계산기에서 [결과 저장] 뒤)
// TODO(API-24, CHORONG-48 BE): 계산 기록 API가 아직 서버에 없어 지금은 '준비 중' 안내 (axiosInstance PREPARING_APIS 목록). 서버가 올라오면 그 목록 줄만 지우면 그대로 동작
const METHOD_LABEL = Object.fromEntries(CALC_METHODS.map((method) => [method.code, method.label]))

const Guest = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const GuestTitle = styled.h2`
  font-size: var(--fs-h4);
  font-weight: 800;
`

const GuestText = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-md);
`

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
`

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Main = styled.b`
  font-size: var(--fs-base);
  font-weight: 700;
`

const Sub = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

function getItemLabel(item) {
  return `${formatMoney(item.loanAmount, '원')}, ${item.loanMonths}개월, ${METHOD_LABEL[item.repayMethod] ?? ''}`
}

function CalcHistoryList({ onLoad, refreshKey = 0 }) {
  const navigate = useNavigate()
  const authStatus = useAuthStore((state) => state.status)
  const isMember = authStatus === 'member'
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    if (!isMember) return undefined
    let isCancelled = false
    myApi
      .getCalcs()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [] })
      })
      .catch((error) => {
        if (!isCancelled) setResult({ status: error.isPreparing ? 'preparing' : 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [isMember, attempt, refreshKey])

  const handleRetry = () => {
    setResult({ status: 'loading', items: [] })
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    await myApi.deleteCalc(item.calcId)
    setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one.calcId !== item.calcId) }))
  }

  const handleClearAll = async () => {
    await myApi.deleteCalcs()
    setResult({ status: 'done', items: [] })
  }

  // 불러오기: 계산기 안이면 입력칸 채우기, MY 안이면 계산기로 기록 한 줄을 그대로 넘겨 이동 (옵션도 함께 복원, 맞지 않는 값은 계산기가 무시)
  const handleLoad = (item) => {
    if (onLoad) {
      onLoad(item)
      return
    }
    navigate('/calc', { state: item })
  }

  if (authStatus === 'checking') return null

  if (!isMember) {
    return (
      <Guest>
        <GuestTitle>계산 기록</GuestTitle>
        <GuestText>로그인하면 저장 가능</GuestText>
      </Guest>
    )
  }

  return (
    <MySection
      title="계산 기록"
      description="[결과 저장]을 누른 기록이에요."
      status={result.status}
      onRetry={handleRetry}
      items={result.items}
      getKey={(item) => item.calcId}
      getItemLabel={getItemLabel}
      renderItem={(item) => (
        <Row>
          <Info>
            <Main>
              {formatMoney(item.loanAmount, '원')} · {item.loanMonths}개월 · 연 {formatRate(item.interestRate)}%
            </Main>
            <Sub>
              {METHOD_LABEL[item.repayMethod]}
              {item.graceMonths > 0 && ` · 거치 ${item.graceMonths}개월`} · 총이자 {formatMoney(item.totalInterest, '원')} ·{' '}
              {formatDate(item.calcAt)}
            </Sub>
          </Info>
          <Button $size="sm" $variant="outline" onClick={() => handleLoad(item)}>
            불러오기
          </Button>
        </Row>
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="저장한 계산 기록이 없어요"
    />
  )
}

export default CalcHistoryList
