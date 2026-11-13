import styled from 'styled-components'
import {
  CREDIT_BAND_OPTIONS,
  OVERDUE_OPTIONS,
  PRIORITY_MAX,
  PRIORITY_OPTIONS,
} from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import { InlineError } from '../../styles/common'
import ChipGroup from '../ui/ChipGroup'
import Icon from '../ui/Icon'
import Segmented from '../ui/Segmented'

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Label = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

// 칸 이름 옆 작은 안내 (예: 가장 중요한 건 '최대 3개 · 1/3')
const Small = styled.small`
  margin-left: 4px;
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 500;
`

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

  & [data-icon='check'] {
    margin-top: 2px;
    color: var(--good);
  }
`

// 주의 안내 앞 느낌표 아이콘 (원 안에 느낌표, 공통 아이콘에는 없어서 여기에 직접 그림)
const AlertMark = styled.svg`
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
`

// 칩 격자: 구간은 3칸, 중요한 건은 2칸. 칩 글자는 작게
const ChipGrid = styled.div`
  & > [role='group'] {
    display: grid;
    grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
    gap: 6px;
  }

  & button {
    min-width: 0;
    padding: 0 6px;
    overflow: hidden;
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    text-overflow: ellipsis;
  }

  @media (min-width: 900px) {
    & button {
      padding: 0 13px;
    }
  }
`

// 연체 선택: 가로 가득 반반
const SegFull = styled.div`
  & > [role='group'] {
    display: flex;
    width: 100%;
  }

  & button {
    flex: 1;
    padding: 0 4px;
    font-size: var(--fs-sm);
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
    - 신용 구간은 진단(RC-13)에서 왔으면 store에 이미 들어 있어 미리 선택되어 보임
    - 구간 아래 안내는 이 탭의 진단 구간(diagBand)과 비교
    - TODO(ST-01, CHORONG-43): 진단 구간이 없으면 회원은 저장한 진단 구간(API-25 myApi.getCreditReport, 창 열 때 1번)을 씀.
      useAuthStore가 올라오면 회원일 때만 부르기 (비회원이 부르면 401 안내 창이 뜸)
    - 가장 중요한 것은 3개까지 (4번째를 고르면 ChipGroup이 알림), 하나도 안 고르면 실행 안 됨 (검사는 RecommendStepper)
    - 정확한 점수는 받지 않음 (구간만), 입력값 console 출력 금지 (E6)
*/
function StepCredit({ error, onOpenDiag }) {
  const input = useRecommendStore((state) => state.input)
  const diagBand = useRecommendStore((state) => state.diagBand)
  const setInput = useRecommendStore((state) => state.setInput)

  const errorOf = (field) => (error?.field === field ? error.message : '')
  const bandHint = getBandHint(input.creditBand, diagBand)

  return (
    <Wrap>
      <Field data-field="creditBand">
        <LabelRow>
          <Label>신용점수 구간</Label>
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
          {bandHint.isWarn && (
            <AlertMark viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5M12 16.5h.01" />
            </AlertMark>
          )}
          {bandHint.isDiagPicked && <Icon name="check" size={16} />}
          {bandHint.text}
        </Hint>
        <InlineError>{errorOf('creditBand')}</InlineError>
      </Field>

      <Field data-field="overdue">
        <Label>최근 1년 안에 연체한 적이 있나요</Label>
        <SegFull>
          <Segmented
            label="최근 1년 연체"
            isOnPanel
            options={OVERDUE_OPTIONS}
            value={input.overdue}
            onChange={(overdue) => setInput({ overdue })}
          />
        </SegFull>
        <InlineError>{errorOf('overdue')}</InlineError>
      </Field>

      <Field data-field="priorities">
        <Label>
          마지막으로, 가장 중요한 건
          <Small>
            최대 {PRIORITY_MAX}개 · {input.priorities.length}/{PRIORITY_MAX}
          </Small>
        </Label>
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
      </Field>
    </Wrap>
  )
}

export default StepCredit
