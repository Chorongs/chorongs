import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { getCreditReport } from '../../api/myApi'
import {
  CREDIT_BAND_OPTIONS,
  OVERDUE_OPTIONS,
  PRIORITY_MAX,
  PRIORITY_OPTIONS,
} from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import {
  ChipGrid,
  FormField,
  FormLabel,
  FormLabelNote,
  FormStack,
  InlineError,
  SegmentedFull,
} from '../../styles/common'
import ChipGroup from '../ui/ChipGroup'
import Icon from '../ui/Icon'
import Segmented from '../ui/Segmented'

const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
`

const DiagLink = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--brand-text);
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`

// 구간 아래 안내: 진단 구간과 같으면 초록 체크, 다르면 주의 색 + 느낌표 (가안)
const Hint = styled.p`
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin: 8px 0 0;
  color: ${({ $isWarn }) => ($isWarn ? 'var(--warn)' : 'var(--cocoa)')};
  font-size: var(--fs-sm);
  line-height: 1.55;

  & [data-icon] {
    margin-top: 2px;
  }

  & [data-icon='check'] {
    color: var(--good);
  }
`

const DEFAULT_HINT = '금융감독원 공시 구간이에요. 정확한 점수는 받지 않아요.'

// 구간 아래 안내 한 줄: 진단 구간(diagBand)이 없거나 아직 안 골랐으면 기본, 같으면 안내, 다르면 주의 (고르는 건 막지 않음)
const getBandHint = (creditBand, diagBand) => {
  const diagLabel = CREDIT_BAND_OPTIONS.find((option) => option.value === diagBand)?.label
  if (!diagLabel || !creditBand) return { text: DEFAULT_HINT, isWarn: false }
  if (creditBand === diagBand) {
    return {
      text: `셀프 진단 결과(${diagLabel})로 골라 뒀어요. 바꿔도 돼요.`,
      isWarn: false,
      isDiagPicked: true,
    }
  }
  return {
    text: `셀프 진단 결과는 ${diagLabel}예요. 다른 구간으로 추천받으면 실제와 차이가 클 수 있어요.`,
    isWarn: true,
  }
}

/*
    RC-06 3단계 신용, 우선순위
    - props: error ({ field, message } 또는 null, 부른 쪽에서 [추천 받기] 검사에 걸린 칸), onOpenDiag ('모르면 셀프 진단' 누름)
    - 신용 구간은 처음에 비어 있음. 안 골랐을 때만 알려진 진단 구간을 미리 골라 둠 (이미 고른 구간은 덮어쓰지 않음)
      알려진 진단 구간 = 이 탭의 진단 구간(diagBand), 없으면 회원이 저장한 진단 구간(API-25 myApi.getCreditReport)
    - 구간 아래 안내는 알려진 진단 구간과 비교
    - 저장한 진단 구간은 창 열 때 1번, 회원일 때만 부름 (비회원이 부르면 401 안내 창이 뜸). 못 불러오면 기본 안내 그대로 (따로 안내 안 함) (CHORONG-43에서 연결)
    - 가장 중요한 것은 3개까지 (4번째를 고르면 ChipGroup이 알림), 하나도 안 고르면 실행 안 됨 (검사는 RecommendStepper)
    - 정확한 점수는 받지 않음 (구간만), 입력값 console 출력 금지 (E6)
*/
function StepCredit({ error, onOpenDiag }) {
  const input = useRecommendStore((state) => state.input)
  const diagBand = useRecommendStore((state) => state.diagBand)
  const setInput = useRecommendStore((state) => state.setInput)
  const isMember = useAuthStore((state) => state.status === 'member')
  // 저장한 진단 구간 (API-25, 회원만). 없거나 못 불러오면 null
  const [savedBand, setSavedBand] = useState(null)

  useEffect(() => {
    if (diagBand || !isMember) return
    let isCancelled = false
    getCreditReport()
      .then((report) => {
        if (!isCancelled) setSavedBand(report?.creditBand ?? null)
      })
      .catch(() => {})
    return () => {
      isCancelled = true
    }
  }, [diagBand, isMember])

  // 알려진 진단 구간: 신용 구간이 비어 있을 때만 미리 선택
  const knownBand = diagBand ?? savedBand
  useEffect(() => {
    if (!input.creditBand && knownBand) setInput({ creditBand: knownBand })
  }, [input.creditBand, knownBand, setInput])

  const errorOf = (field) => (error?.field === field ? error.message : '')
  const bandHint = getBandHint(input.creditBand, knownBand)

  return (
    <FormStack>
      <FormField data-field="creditBand">
        <LabelRow>
          <FormLabel>신용점수 구간</FormLabel>
          <DiagLink onClick={onOpenDiag}>
            모르면 셀프 진단
            <Icon name="chevron_right" size={16} />
          </DiagLink>
        </LabelRow>
        <ChipGrid $columns={3}>
          <ChipGroup
            label="신용점수 구간"
            options={CREDIT_BAND_OPTIONS}
            value={input.creditBand}
            onChange={(creditBand) => setInput({ creditBand })}
          />
        </ChipGrid>
        <Hint $isWarn={bandHint.isWarn}>
          {bandHint.isWarn && <Icon name="alert" size={16} />}
          {bandHint.isDiagPicked && <Icon name="check" size={16} />}
          {bandHint.text}
        </Hint>
        <InlineError>{errorOf('creditBand')}</InlineError>
      </FormField>

      <FormField data-field="overdue">
        <FormLabel>최근 1년 안에 연체한 적이 있나요</FormLabel>
        <SegmentedFull>
          <Segmented
            label="최근 1년 연체"
            isOnPanel
            options={OVERDUE_OPTIONS}
            value={input.overdue}
            onChange={(overdue) => setInput({ overdue })}
          />
        </SegmentedFull>
        <InlineError>{errorOf('overdue')}</InlineError>
      </FormField>

      <FormField data-field="priorities">
        <FormLabel>
          마지막으로, 가장 중요한 건
          <FormLabelNote>
            최대 {PRIORITY_MAX}개 · {input.priorities.length}/{PRIORITY_MAX}
          </FormLabelNote>
        </FormLabel>
        <ChipGrid $columns={2}>
          <ChipGroup
            label="가장 중요한 것"
            isMultiple
            max={PRIORITY_MAX}
            options={PRIORITY_OPTIONS}
            value={input.priorities}
            onChange={(priorities) => setInput({ priorities })}
          />
        </ChipGrid>
        <InlineError>{errorOf('priorities')}</InlineError>
      </FormField>
    </FormStack>
  )
}

export default StepCredit
