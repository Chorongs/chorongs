import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { CREDIT_BAND_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, Card, EmptyBox } from '../../styles/common'
import { formatDate } from '../../utils/format'
import Modal from '../ui/Modal'

// MY-09 내 진단 리포트: 저장한 신용 구간 + 진단 시각 / [이 구간으로 추천받기] / [삭제]
// 삭제 → 확인 후 API-25 DELETE / 없으면(204) 빈 상태 + '신용 셀프 진단 하기' (E11)
// TODO(ST-03, CR-03, CHORONG-45 김채희): [이 구간으로 추천받기]는 CR-03과 같음.
//   useRecommendStore가 올라오면 setInput({ creditBand })를 넣고, 추천받기 전이면 추천 창 + '{구간} 구간을 3단계에 골라 뒀어요' 알림,
//   받은 뒤면 run() → /recommend + '{구간} 구간으로 추천했어요' 알림. (지금은 추천 창을 1단계부터 여는 것만)
// TODO(SCR-09, CHORONG-51 김진석): '신용 셀프 진단 하기'가 가는 /diagnosis/credit 화면은 DiagnosisPage가 올라오면 열림
// TODO(API-25, CHORONG-53 BE): 진단 리포트 API가 올라오면 그대로 동작
const Head = styled.h2`
  margin-bottom: 20px;
  font-size: var(--fs-h4);
  font-weight: 800;
`

const Band = styled.p`
  font-family: var(--f-num);
  font-size: var(--fs-h2);
  font-weight: 900;
`

const Meta = styled.p`
  margin-bottom: 16px;
  color: var(--cocoa);
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
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', report: null })
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

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
      <Card>
        <Band>{CREDIT_BAND_LABEL[result.report.creditBand] ?? result.report.creditBand}</Band>
        <Meta>{formatDate(result.report.createdAt)} 진단</Meta>
        <Actions>
          <Button onClick={() => openRecommend(true)}>이 구간으로 추천받기</Button>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(true)}>
            삭제
          </Button>
        </Actions>
      </Card>
    )
  }

  return (
    <section>
      <Head>내 진단 리포트</Head>
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
