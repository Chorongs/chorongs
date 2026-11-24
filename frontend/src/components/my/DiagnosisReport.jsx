import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { CREDIT_BAND_LABEL } from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox } from '../../styles/common'
import { formatDate } from '../../utils/format'
import SectionHeader from '../common/SectionHeader'
import Modal from '../ui/Modal'

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

const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  text-align: center;
`

const DialogText = styled.p`
  margin-bottom: 20px;
  font-size: var(--fs-lg);
  font-weight: 700;
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
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
      showToast('내 진단 리포트를 지웠어요')
    } catch (error) {
      if (error.response?.status !== 401) showToast('지우지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  let body
  if (result.status === 'loading') {
    body = <Status role="status">불러오는 중이에요</Status>
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
      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="진단 리포트 삭제" width={380} showClose={false}>
        <DialogText>내 진단 리포트를 지울까요?</DialogText>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(false)}>
            취소
          </Button>
          <Button onClick={handleDelete} disabled={isPending}>
            삭제
          </Button>
        </DialogActions>
      </Modal>
    </section>
  )
}

export default DiagnosisReport
