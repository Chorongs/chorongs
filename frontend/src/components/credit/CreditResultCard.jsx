import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { putCreditReport } from '../../api/myApi'
import { CREDIT_BAND_LABEL, CREDIT_QUESTIONS } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, Card, Tag } from '../../styles/common'
import ScoreGauge from '../chart/ScoreGauge'
import TipList from '../common/TipList'
import Accordion from '../ui/Accordion'

// CR-03 신용 진단 결과 카드: 점수 게이지 + 항목별 상태(기본 접힘) + 이렇게 해보세요 + 버튼들
// result: API-09 응답 { score, creditBand, items, lowAccuracy }
// onRetry: [다시 진단하기] / onContinue(creditBand): 있으면 추천 창 안 결과 카드 (RC-13)
// 점수, 답은 저장하지 않는다. 저장은 구간 + 시각만 (API-25)
const REFERENCE_PREFIX = '참고: '

// 서버 상태 글 → 딱지 색, 막대 길이(%) / 그 밖의 글(확인 필요)은 회색, 막대 없음
const STATUS_STYLE = {
  양호: { variant: 'good', percent: 100 },
  보통: { variant: 'warn', percent: 60 },
  주의: { variant: 'bad', percent: 30 },
}

const NEED_TIP_STATUS = ['주의', '보통']

const Wrap = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 28px;
`

const Notice = styled.div`
  display: flex;
  justify-content: center;
`

const SectionTitle = styled.h3`
  margin-bottom: 12px;
  font-size: var(--fs-xl);
  font-weight: 800;
`

const ItemList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const ItemRow = styled.li`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ItemHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--fs-md);
  font-weight: 700;
`

const Track = styled.div`
  height: 8px;
  overflow: hidden;
  border-radius: var(--r-pill);
  background: var(--viz-track);
`

const Fill = styled.span`
  display: block;
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  border-radius: var(--r-pill);
  background: ${({ $variant }) => `var(--${$variant})`};
`

const ItemTip = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.6;
`

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

function splitStatus(status) {
  const isReference = status.startsWith(REFERENCE_PREFIX)
  return { isReference, name: isReference ? status.slice(REFERENCE_PREFIX.length) : status }
}

function getQuestionLabel(questionNo) {
  return CREDIT_QUESTIONS.find((question) => question.no === questionNo)?.label ?? `문항 ${questionNo}`
}

function CreditResultCard({ result, onRetry, onContinue }) {
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  const [isSaving, setIsSaving] = useState(false)
  const { score, creditBand, items = [], lowAccuracy } = result

  // 이렇게 해보세요: 주의 항목 팁 먼저, 그다음 보통 항목 팁
  const tips = NEED_TIP_STATUS.flatMap((needStatus) =>
    items
      .filter((item) => splitStatus(item.status).name === needStatus)
      .map((item) => item.tip),
  )

  // [이 구간으로 상품 찾기] → /search?credit={이 구간 칩 값},신용 무관
  const handleSearch = () => {
    const bandText = encodeURIComponent(CREDIT_BAND_LABEL[creditBand])
    navigate(`/search?credit=${bandText},${encodeURIComponent('신용 무관')}`)
  }

  // [결과 저장]: 구간 + 시각만 보냄 (E5 저장 중 버튼 잠금)
  // TODO(CM-17, CM-22, CHORONG-43): 비회원이면 요청 전에 requireLogin으로 로그인 안내 창을 띄운다.
  const handleSave = async () => {
    setIsSaving(true)
    try {
      await putCreditReport(creditBand)
      showToast('진단 결과를 저장했어요')
    } catch {
      showToast('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Wrap>
      <ScoreGauge score={score} band={creditBand} />
      {lowAccuracy && (
        <Notice>
          <Tag $variant="warn">정확도 낮음</Tag>
        </Notice>
      )}

      <Accordion title="항목별 상태 보기">
        <ItemList>
          {items.map((item) => {
            const { isReference, name } = splitStatus(item.status)
            const style = STATUS_STYLE[name]
            return (
              <ItemRow key={item.questionNo}>
                <ItemHead>
                  <span>{getQuestionLabel(item.questionNo)}</span>
                  <Tag $variant={style?.variant}>{isReference ? item.status : name}</Tag>
                </ItemHead>
                <Track aria-hidden="true">
                  <Fill $percent={style?.percent ?? 0} $variant={style?.variant ?? 'viz-other'} />
                </Track>
                <ItemTip>{item.tip}</ItemTip>
              </ItemRow>
            )
          })}
        </ItemList>
      </Accordion>

      {tips.length > 0 && (
        <section>
          <SectionTitle>이렇게 해보세요</SectionTitle>
          <TipList items={tips} />
        </section>
      )}

      <ButtonGroup>
        <ButtonRow>
          {onContinue ? (
            <Button onClick={() => onContinue(creditBand)}>이어서 추천받기</Button>
          ) : (
            <>
              {/* TODO(ST-03, CHORONG-45): useRecommendStore가 올라오면 연결한다.
                  추천받기 전: setInput({ creditBand }) → openRecommend(true) → '{구간} 구간을 3단계에 골라 뒀어요' 알림
                  추천받은 뒤: setInput({ creditBand }) → run() → /recommend 이동 → '{구간} 구간으로 추천했어요' 알림 */}
              <Button disabled>이 구간으로 추천받기</Button>
              <Button $variant="outline" onClick={handleSearch}>
                이 구간으로 상품 찾기
              </Button>
            </>
          )}
        </ButtonRow>
        <ButtonRow>
          <Button $variant="soft" $size="sm" onClick={handleSave} disabled={isSaving}>
            결과 저장
          </Button>
          {/* TODO(CM-18): 이미지로 저장 버튼(SaveImageButton)은 2차라 아직 그리지 않는다. */}
          <Button $variant="ghost" $size="sm" onClick={onRetry}>
            다시 진단하기
          </Button>
        </ButtonRow>
      </ButtonGroup>
    </Wrap>
  )
}

export default CreditResultCard
