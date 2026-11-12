import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError } from '../../styles/common'
import { getAboutMeError, getCreditError, getMoneyError, isBlank } from '../../utils/validate'
import StepAboutMe from './StepAboutMe'
import RecommendDiagStep from './RecommendDiagStep'
import StepCredit from './StepCredit'
import StepMoney from './StepMoney'

const LAST_STEP = 3
const DIAG_FROM_GATE = 'gate'
const DIAG_FROM_STEP3 = 'step3'
const STEPS = [
  { no: 1, title: '나에 대해' },
  { no: 2, title: '필요한 돈' },
  { no: 3, title: '신용, 우선순위' },
]

// 1단계는 비워도 다음으로 감: 빈 연소득, 매달 갚는 대출('잘 모르겠어요' 제외)은 0으로 바꾼 뒤 검사
const getAboutMeDefaults = (input) => {
  const defaults = {}
  if (isBlank(input.income)) defaults.income = 0
  if (!input.debtUnknown && isBlank(input.debtMonthly)) defaults.debtMonthly = 0
  return defaults
}

// 단계별 검사 (입력 검사 E2): 걸린 첫 칸 { field, message } 또는 null
const getStepError = (step, input) => {
  if (step === 1) return getAboutMeError({ ...input, ...getAboutMeDefaults(input) })
  if (step === 2) return getMoneyError(input)
  return getCreditError(input)
}

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const StepTitle = styled.h2`
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-h4);
  font-weight: 800;
`

const StepCount = styled.span`
  color: var(--cocoa);
  font-family: var(--f-num);
  font-size: var(--fs-md);
  font-weight: 700;
`

const StepTabs = styled.div`
  display: flex;
  gap: 8px;
`

const StepTab = styled.button.attrs({ type: 'button' })`
  flex: 1;
  height: 36px;
  padding: 0 8px;
  border: 1px solid ${({ $isActive }) => ($isActive ? 'var(--brand)' : 'var(--line-2)')};
  border-radius: var(--r-sm);
  background: ${({ $isActive }) => ($isActive ? 'var(--brand-soft)' : 'var(--paper)')};
  color: ${({ $isActive }) => ($isActive ? 'var(--brand-text)' : 'var(--muted)')};
  font-size: var(--fs-sm);
  font-weight: ${({ $isActive }) => ($isActive ? 700 : 600)};
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
`

const Buttons = styled.div`
  display: flex;
  gap: 12px;

  & > button:last-child {
    flex: 1;
  }
`

/*
    RC-03 단계별 추천 입력 (3단계, 추천 창 RecommendDialog 안)
    - props: onRun (추천 실행, 창이 함), isRunning, runError ({ message } 또는 null, 실행 실패)
    - [다음]: 그 단계 입력 검사 → 걸리면 알림 + 그 칸에 커서, 통과하면 다음 단계
      1단계는 비워도 되고, 빈 연소득과 매달 갚는 대출은 0으로 채운 뒤 검사 (validate.js는 그대로)
    - 단계 이름으로 바로 이동: 앞 단계는 검사 없이, 뒤 단계는 지나는 단계마다 [다음]과 같은 검사 (걸리면 거기서 멈춤), Enter = 다음
    - 마지막 단계: 추천 실행(onRun). 실행 중 버튼 잠금 (E5). 실패하면 이 단계 아래에 문구 + [다시 시도] (E3)
    - 입력값은 useRecommendStore(sessionStorage)에만 두고 console 출력 금지 (E6)
    - 시작 때 '잠깐' 창(RC-13): 한 번 추천받은 뒤나 [이 구간으로 추천받기]로 열면(recommendSkipGate) 생략
    - 셀프 진단은 '잠깐' 창과 3단계 '모르면 셀프 진단'에서 열림. 끝나면 열었던 곳으로 돌아옴
      ('잠깐' 창에서 열었으면 1단계, 3단계에서 열었으면 3단계)
*/
function RecommendStepper({ onRun, isRunning, runError = null }) {
  const input = useRecommendStore((state) => state.input)
  const lastInput = useRecommendStore((state) => state.lastInput)
  const setInput = useRecommendStore((state) => state.setInput)
  const recommendSkipGate = useUiStore((state) => state.recommendSkipGate)
  const showToast = useUiStore((state) => state.showToast)

  const formRef = useRef(null)
  const [step, setStep] = useState(1)
  // [다음]을 눌러 검사에 걸린 적이 있는 단계만 오류 문구를 보임 (고치면 바로 사라짐)
  const [isTried, setIsTried] = useState(false)
  const [focusRequest, setFocusRequest] = useState(null)
  // 셀프 진단을 연 곳: null(안 열림) / 'gate'('잠깐' 창) / 'step3'(3단계 '모르면 셀프 진단')
  const [diagFrom, setDiagFrom] = useState(() =>
    lastInput === null && !recommendSkipGate ? DIAG_FROM_GATE : null,
  )

  const error = isTried ? getStepError(step, input) : null

  // 걸린 칸에 커서: 단계가 바뀐 뒤에도 그려진 다음에 옮기려고 요청을 상태로 둠
  useEffect(() => {
    if (!focusRequest) return
    const target = formRef.current?.querySelector(
      `[data-field="${focusRequest.field}"] input, [data-field="${focusRequest.field}"] select, [data-field="${focusRequest.field}"] button`,
    )
    target?.focus()
  }, [focusRequest])

  const showError = (failedStep, failedError) => {
    setStep(failedStep)
    setIsTried(true)
    showToast(failedError.message)
    setFocusRequest({ field: failedError.field })
  }

  // 1단계를 지나갈 때 빈칸이던 연소득, 매달 갚는 대출을 0으로 저장
  const fillAboutMeDefaults = () => {
    const defaults = getAboutMeDefaults(input)
    if (Object.keys(defaults).length > 0) setInput(defaults)
  }

  const goToStep = (target) => {
    // 앞 단계로는 검사 없이, 뒤 단계로는 사이 단계를 차례로 검사
    for (let check = step; check < target; check += 1) {
      const stepError = getStepError(check, input)
      if (stepError) {
        showError(check, stepError)
        return
      }
      if (check === 1) fillAboutMeDefaults()
    }
    setStep(target)
    setIsTried(false)
  }

  // Enter와 [다음] 버튼이 모두 이 함수로 옴
  const handleSubmit = (event) => {
    event.preventDefault()
    if (isRunning) return

    const stepError = getStepError(step, input)
    if (stepError) {
      showError(step, stepError)
      return
    }
    if (step < LAST_STEP) {
      goToStep(step + 1)
      return
    }
    onRun()
  }

  // 진단이 끝나거나 [이전]으로 나오면 열었던 곳으로
  const handleDiagDone = () => {
    setStep(diagFrom === DIAG_FROM_GATE ? 1 : LAST_STEP)
    setDiagFrom(null)
  }

  const currentTitle = STEPS.find((item) => item.no === step).title

  if (diagFrom) {
    return <RecommendDiagStep openedFrom={diagFrom} onDone={handleDiagDone} />
  }

  return (
    <Form ref={formRef} onSubmit={handleSubmit} noValidate aria-label="맞춤 추천 조건 입력">
      <Head>
        <StepTitle>{currentTitle}</StepTitle>
        <StepCount aria-label={`${LAST_STEP}단계 중 ${step}단계`}>
          {step}/{LAST_STEP}
        </StepCount>
      </Head>

      <StepTabs>
        {STEPS.map((item) => (
          <StepTab
            key={item.no}
            $isActive={item.no === step}
            aria-current={item.no === step ? 'step' : undefined}
            onClick={() => goToStep(item.no)}
          >
            {item.no}. {item.title}
          </StepTab>
        ))}
      </StepTabs>

      {step === 1 && <StepAboutMe error={error} />}
      {step === 2 && <StepMoney error={error} />}
      {step === 3 && <StepCredit error={error} onOpenDiag={() => setDiagFrom(DIAG_FROM_STEP3)} />}
      {step === LAST_STEP && runError && <InlineError>{runError.message}</InlineError>}

      <Buttons>
        {step > 1 && (
          <Button $variant="outline" $size="lg" onClick={() => goToStep(step - 1)}>
            이전
          </Button>
        )}
        <Button type="submit" $size="lg" disabled={isRunning}>
          {step < LAST_STEP ? '다음' : isRunning ? '추천 찾는 중…' : runError ? '다시 시도' : '추천 받기'}
        </Button>
      </Buttons>
    </Form>
  )
}

export default RecommendStepper
