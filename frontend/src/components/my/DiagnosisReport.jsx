import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { CREDIT_BAND_LABEL } from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox } from '../../styles/common'
import { formatDate } from '../../utils/format'
import ConfirmDialog from '../common/ConfirmDialog'
import SectionHeader from '../common/SectionHeader'
import { LoadingText } from './MySection'

// MY-09 내 진단 리포트: 저장한 신용 구간 + 진단 시각 / [이 구간으로 추천받기] / [삭제]
// 삭제 → 확인 후 API-25 DELETE / 없으면(204) 빈 상태 + '신용 셀프 진단 하기' (E11)
// [이 구간으로 추천받기]는 CR-03과 같음: 추천 입력의 신용 구간을 이 구간으로 채움 →
//   추천받기 전이면 추천 창을 '잠깐' 창 없이 1단계부터 열고 '{구간} 구간을 3단계에 골라 뒀어요' 알림 (나머지 입력은 이용자가 채움)
//   / 받은 뒤면 그 구간으로 다시 추천 실행 → /recommend + '{구간} 구간으로 추천했어요' 알림. 실행 중 버튼 잠금 (E5), 실패하면 알림 (E3)
// TODO(MY-09, CR-03): 진단 결과 카드(CreditResultCard.jsx)에 같은 동작이 따로 있음.
//   나중에 공통 함수로 묶는다 (명세서 '폴더 구조'에 둘 파일을 먼저 추가한 뒤, 두 화면이 그 함수를 부르게)

// 리포트 판: 회색 바탕 / 작은 이름, 큰 구간, 진단 날짜, 버튼
const ReportBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px;
  border-radius: var(--r-md);
  background: var(--mist);
`

const BoxLabel = styled.small`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Band = styled.b`
  font-family: var(--f-num);
  font-size: var(--fs-h2);
  font-weight: 900;
  line-height: 1.2;
  small {
    margin-left: 4px;
    color: var(--brand-text);
    font-family: var(--f-ui);
    font-size: var(--fs-md);
    font-weight: 800;
  }
`

const Meta = styled.p`
  margin-bottom: 10px;
  color: var(--ink-2);
  font-size: var(--fs-sm);
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

function DiagnosisReport() {
  const navigate = useNavigate()
  const openRecommend = useUiStore((state) => state.openRecommend)
  const showToast = useUiStore((state) => state.showToast)
  const hasRecommendResult = useRecommendStore((state) => state.result !== null)
  const setRecommendInput = useRecommendStore((state) => state.setInput)
  const runRecommend = useRecommendStore((state) => state.run)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', report: null })
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  // [이 구간으로 추천받기] (CR-03과 같음)
  const handleRecommend = async (creditBand) => {
    if (isRunning) return
    const bandLabel = CREDIT_BAND_LABEL[creditBand] ?? creditBand
    setRecommendInput({ creditBand })
    if (!hasRecommendResult) {
      openRecommend(true)
      showToast(`${bandLabel} 구간을 3단계에 골라 뒀어요`)
      return
    }
    setIsRunning(true)
    try {
      await runRecommend()
      navigate('/recommend')
      showToast(`${bandLabel} 구간으로 추천했어요`)
    } catch {
      showToast('추천을 불러오지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    let isCancelled = false
    myApi
      .getCreditReport()
      .then((report) => {
        if (!isCancelled) setResult({ status: 'done', report })
      })
      .catch(() => {
        if (!isCancelled) setResult({ status: 'error', report: null })
      })
    return () => {
      isCancelled = true
    }
  }, [attempt])

  const handleRetry = () => {
    setResult({ status: 'loading', report: null })
    setAttempt((count) => count + 1)
  }

  const handleDelete = async () => {
    setIsPending(true)
    try {
      await myApi.deleteCreditReport()
      setResult({ status: 'done', report: null })
      setIsConfirmOpen(false)
      showToast('내 진단 리포트를 삭제했어요')
    } catch (error) {
      if (error.response?.status !== 401) showToast('삭제하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  let body
  if (result.status === 'loading') {
    body = <LoadingText />
  } else if (result.status === 'error') {
    body = (
      <EmptyBox>
        내 진단 리포트를 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={handleRetry}>
          다시 시도
        </Button>
      </EmptyBox>
    )
  } else if (!result.report) {
    body = (
      <EmptyBox>
        저장한 진단 결과가 없어요
        <Button $size="sm" $variant="outline" onClick={() => navigate('/diagnosis/credit')}>
          신용 셀프 진단 하기
        </Button>
      </EmptyBox>
    )
  } else {
    body = (
      <ReportBox>
        <BoxLabel>신용 셀프 진단</BoxLabel>
        <Band>
          {CREDIT_BAND_LABEL[result.report.creditBand] ?? result.report.creditBand}
          <small>구간</small>
        </Band>
        <Meta>{formatDate(result.report.createdAt)} 진단</Meta>
        <Actions>
          <Button $size="sm" onClick={() => handleRecommend(result.report.creditBand)} disabled={isRunning}>
            이 구간으로 추천받기
          </Button>
        </Actions>
      </ReportBox>
    )
  }

  return (
    <section>
      <SectionHeader title="내 진단 리포트" description="신용 셀프 진단에서 [결과 저장]을 누른 점수 구간과 시각이에요." size="md">
        {result.status === 'done' && result.report && (
          <Button $size="sm" $variant="ghost" onClick={() => setIsConfirmOpen(true)}>
            삭제
          </Button>
        )}
      </SectionHeader>
      {body}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        label="진단 리포트 삭제"
        title="내 진단 리포트를 삭제할까요?"
        confirmLabel="삭제"
        onConfirm={handleDelete}
        isConfirmDisabled={isPending}
      />
    </section>
  )
}

export default DiagnosisReport
