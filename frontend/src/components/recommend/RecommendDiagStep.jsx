import { useState } from 'react'
import styled from 'styled-components'
import { Button } from '../../styles/common'
import Icon from '../ui/Icon'

const VIEW_GATE = '잠깐'
const VIEW_DIAG = '진단'

const Title = styled.h2`
  margin: 0 0 8px;
  color: var(--ink);
  font-family: var(--f-ui);
  font-size: var(--fs-h3);
  font-weight: 800;
`

const Description = styled.p`
  margin: 0 0 20px;
  color: var(--ink-2);
  font-family: var(--f-ui);
  font-size: var(--fs-base);
`

const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`

// '잠깐' 창: 가운데 정렬 (가안). 동그란 아이콘 + 제목 + 안내 + 세로 버튼 두 개 + 작은 안내
const Gate = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  text-align: center;
`

const GateIcon = styled.span`
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-text);
`

const GateTitle = styled.h2`
  margin: 0;
  color: var(--ink);
  font-family: var(--f-ui);
  font-size: var(--fs-h3);
  font-weight: 800;
`

const GateText = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-family: var(--f-ui);
  font-size: var(--fs-lg);

  & b {
    color: var(--ink);
  }
`

const GateButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
`

const GateNote = styled.p`
  margin: 0;
  color: var(--cocoa);
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

/*
    RC-13 신용 구간 확인 ('잠깐' 창, 셀프 진단) — 추천 창(RecommendDialog) 안에 표시됨
    - props: openedFrom ('gate' = '잠깐' 창에서 열림 / 'step3' = 3단계 '모르면 셀프 진단'에서 열림),
      onDone (열었던 곳으로 돌아감: 'gate'면 1단계, 'step3'면 3단계. RecommendStepper가 처리)
    - 보이는 화면(useState): 잠깐 → 진단 (결과 화면은 CreditCheck 연결 때 추가)
    - [알아요] → onDone() / [몰라요 (셀프 진단하기)] → 진단 / 진단의 [이전] → 연 곳 (잠깐 창에서 열었으면 잠깐, 3단계면 3단계)
    - 닫거나 건너뛰면 3단계에서 직접 고름. 점수, 답은 console 출력 금지, 스토어에는 구간만 (E6)
    - TODO(CR-02, CR-03, CHORONG-51): 진단 자리에 <CreditCheck submitLabel="결과 확인" onContinue={handleContinue} /> 연결
      결과 카드(CreditResultCard)는 이 창 안에 표시하고 [이 구간으로 상품 찾기]는 없이 [이어서 추천받기]만 둠
      handleContinue = (creditBand) => {
        setInput({ creditBand }); setDiagBand(creditBand)   // useRecommendStore
        showToast(`${구간 글자} 구간을 3단계에 골라 뒀어요`); onDone()   // useUiStore
      }
*/
function RecommendDiagStep({ openedFrom, onDone }) {
  const [view, setView] = useState(openedFrom === 'gate' ? VIEW_GATE : VIEW_DIAG)

  if (view === VIEW_DIAG) {
    return (
      <>
        <Title>신용 구간 알아보기</Title>
        <Description>문항에 답하면 신용 구간을 알려 드려요. 점수와 답은 저장하지 않아요.</Description>
        {/* TODO(CR-02): 셀프 진단 10문항(CreditCheck) 자리 */}
        <Buttons>
          <Button
            $variant="outline"
            onClick={openedFrom === 'gate' ? () => setView(VIEW_GATE) : onDone}
          >
            이전
          </Button>
        </Buttons>
      </>
    )
  }

  return (
    <Gate>
      <GateIcon>
        <Icon name="gauge" size={30} />
      </GateIcon>
      <GateTitle>잠깐!</GateTitle>
      <GateText>
        추천을 받으려면 대략적인 <b>신용점수 구간</b>을 알아야 해요.
      </GateText>
      <GateButtons>
        <Button onClick={onDone}>알아요</Button>
        <Button $variant="outline" onClick={() => setView(VIEW_DIAG)}>
          몰라요 (셀프 진단하기)
        </Button>
      </GateButtons>
      <GateNote>셀프 진단은 10문항이고 신용점수에 영향이 없어요.</GateNote>
    </Gate>
  )
}

export default RecommendDiagStep
