import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { postCreditCheck } from '../../api/diagnosisApi'
import { CREDIT_QUESTIONS } from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, InlineError } from '../../styles/common'
import Disclaimer from '../common/Disclaimer'
import ChipGroup from '../ui/ChipGroup'
import ProgressBar from '../ui/ProgressBar'
import CreditResultCard from './CreditResultCard'

// CR-02 신용 셀프 진단: 10문항 답 → 예상 점수대 (API-09)
// submitLabel: 버튼 글 / onContinue(creditBand): 있으면 추천 창용 결과 카드 (RC-13)
// 답은 이 탭에만 임시 저장 (sessionStorage 'creditAnswers'), 점수와 결과는 브라우저에 저장하지 않는다.
// 결과 버튼을 눌러 결과를 본 적이 있는지만 'creditChecked'에 남김 (화면을 다시 열 때 결과를 자동으로 보여 줄지 정함)
// 답, 점수는 console에 출력하지 않는다. (E6)
const STORAGE_KEY = 'creditAnswers'
const CHECKED_KEY = 'creditChecked'
const UNKNOWN_VALUE = 0
const QUESTION_COUNT = CREDIT_QUESTIONS.length
const FINANCE_QUESTION_NO = 5
const LOAN_COUNT_QUESTION_NO = 4
const NO_LOAN_VALUE = 1 // 문항 4 보기 '0건'
const NO_FINANCE_VALUE = 0 // 문항 5 보기 '없음' (화면에서만 쓰고, 서버에는 빈 목록으로 보냄)
const REQUIRED_NOS = CREDIT_QUESTIONS.map((question) => question.no)

// 앞 문항 답과 안 맞아서 뒤 문항에서 뺄 보기 값 (문항 번호 → 앞 답으로 뺄 값 목록). 모순 답은 고를 수 없다.
const HIDDEN_RULES = {
  2: (a) => (a[1] === 1 ? [4] : []), // 1년 내 연체 없음 → 3개월 내 '30일 이상' 뺌
  5: (a) => {
    if (a[LOAN_COUNT_QUESTION_NO] === NO_LOAN_VALUE) return [1, 2, 3, 4] // 대출 0건 → '없음'만
    if (a[LOAN_COUNT_QUESTION_NO] > NO_LOAN_VALUE) return [NO_FINANCE_VALUE] // 대출 1건 이상 → '없음' 뺌
    return []
  },
  6: (a) => {
    if (a[LOAN_COUNT_QUESTION_NO] === NO_LOAN_VALUE) return [UNKNOWN_VALUE, 2, 3, 4, 5, 6] // 대출 0건 → '없음'만
    if (a[LOAN_COUNT_QUESTION_NO] > NO_LOAN_VALUE) return [1] // 대출 1건 이상 → '없음' 뺌
    return []
  },
  8: (a) => (a[7] === 1 ? [UNKNOWN_VALUE, 2, 3] : []), // 카드 없음 → 현금서비스 '없음'만
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Progress = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
`

const QuestionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const QuestionTitle = styled.h3`
  font-size: var(--fs-xl);
  font-weight: 800;
`

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
`

// 문항의 전체 보기 (6번 이후는 끝에 '잘 모르겠어요', 5번은 끝에 '없음'이 붙음)
function getAllChoices(question) {
  const choices = question.options.map((label, index) => ({ value: index + 1, label }))
  if (question.hasUnknown) choices.push({ value: UNKNOWN_VALUE, label: '잘 모르겠어요' })
  if (question.no === FINANCE_QUESTION_NO) choices.push({ value: NO_FINANCE_VALUE, label: '없음' })
  return choices
}

// 앞 문항 답과 안 맞는 보기를 뺀 보기
function getChoices(question, answers) {
  const hiddenValues = HIDDEN_RULES[question.no]?.(answers) ?? []
  return getAllChoices(question).filter((choice) => !hiddenValues.includes(choice.value))
}

// 맞는 보기가 하나만 남으면 그 답 (자동으로 골라짐, 문항 5는 값 목록). 아니면 undefined
function getForcedAnswer(question, answers) {
  if (!HIDDEN_RULES[question.no]) return undefined
  const choices = getChoices(question, answers)
  if (choices.length !== 1) return undefined
  return question.isMultiple ? [choices[0].value] : choices[0].value
}

// 앞 답과 안 맞게 된 뒤 문항 답을 비우고, 보기가 하나만 남은 문항은 그 답으로 채움
// 비운 문항 번호 목록도 같이 돌려줌 (문항 5는 값 목록이라 하나라도 안 맞으면 비움)
// previous: 바뀌기 전 답. 그때 자동으로 골라져 있던 답은 알림 없이 비움
// 빈 목록(문항 5를 다 해제한 경우, 예전 저장 답)은 답 안 한 것으로 보고 알림 없이 지움
function removeConflicts(answers, previous = {}) {
  const next = { ...answers }
  const cleared = []
  Object.entries(next).forEach(([no, value]) => {
    if (Array.isArray(value) && value.length === 0) delete next[no]
  })
  CREDIT_QUESTIONS.filter((question) => HIDDEN_RULES[question.no]).forEach((question) => {
    const hidden = HIDDEN_RULES[question.no](next)
    const value = next[question.no]
    const values = Array.isArray(value) ? value : [value]
    const previousForced = getForcedAnswer(question, previous)
    const wasForced = previousForced !== undefined && JSON.stringify(previousForced) === JSON.stringify(value)
    if (values.some((item) => hidden.includes(item))) {
      delete next[question.no]
      if (!wasForced) cleared.push(question.no)
    }
    const forced = getForcedAnswer(question, next)
    if (forced !== undefined) {
      next[question.no] = forced
    } else if (wasForced) {
      delete next[question.no] // 자동으로 골라졌던 답은 더 이상 자동이 아니면 비워서 직접 고르게 함 (알림 없음)
    }
  })
  return { next, cleared }
}

// 저장된 답을 불러올 때도 같은 정리를 거침
function loadAnswers() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? removeConflicts(parsed).next : {}
  } catch {
    return {}
  }
}

function isAllRequiredAnswered(answers) {
  return REQUIRED_NOS.every((no) => answers[no] !== undefined)
}

// 화면 답 → API-09 보내는 값 (문항 5는 보기 번호 목록, '없음'은 빈 목록 / 나머지는 [보기 번호])
function toRequestAnswers(answers) {
  return CREDIT_QUESTIONS.map(({ no }) => ({
    questionNo: no,
    choices: no === FINANCE_QUESTION_NO ? (answers[no] ?? []).filter((value) => value !== NO_FINANCE_VALUE) : [answers[no]],
  }))
}

function getErrorText(error) {
  const status = error?.response?.status
  if (status === 503) return '잠시 후 다시 시도해 주세요.'
  if (status === 400 && error.response.data?.message) return error.response.data.message
  return '진단 결과를 불러오지 못했어요.'
}

function CreditCheck({ submitLabel = '결과 보기', onContinue }) {
  const showToast = useUiStore((state) => state.showToast)
  const setDiagBand = useRecommendStore((state) => state.setDiagBand)
  const [initialAnswers] = useState(loadAnswers)
  const [hasChecked] = useState(() => sessionStorage.getItem(CHECKED_KEY) === 'true')
  const [answers, setAnswers] = useState(initialAnswers)
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(() => hasChecked && isAllRequiredAnswered(initialAnswers))
  const [errorText, setErrorText] = useState('')
  const [missingNos, setMissingNos] = useState([])
  const questionRefs = useRef({})

  // 답은 이 탭에만 임시 저장
  // 로그아웃, 탈퇴 때는 useAuthStore.logout(), MemberInfo가 이 탭의 sessionStorage를 통째로 비워 함께 지워짐 (ST-01, CHORONG-43)
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  }, [answers])

  // 화면을 다시 열었을 때 결과를 본 적이 있고 필수 문항이 다 답해져 있으면 결과까지 다시 표시
  // 결과를 본 적이 없으면 점수 없이 답이 채워진 문항 화면
  useEffect(() => {
    if (!hasChecked || !isAllRequiredAnswered(initialAnswers)) return undefined
    let isStale = false
    postCreditCheck(toRequestAnswers(initialAnswers))
      .then((data) => {
        if (isStale) return
        setResult(data)
        setDiagBand(data.creditBand)
      })
      .catch((error) => {
        if (!isStale) setErrorText(getErrorText(error))
      })
      .finally(() => {
        if (!isStale) setIsLoading(false)
      })
    return () => {
      isStale = true
    }
  }, [hasChecked, initialAnswers, setDiagBand])

  // 결과가 나오면 진단 구간을 스토어에 담음 (추천 3단계 비교용, 구간만)
  const requestCheck = async () => {
    setIsLoading(true)
    setErrorText('')
    try {
      const data = await postCreditCheck(toRequestAnswers(answers))
      setResult(data)
      setDiagBand(data.creditBand)
      sessionStorage.setItem(CHECKED_KEY, 'true')
    } catch (error) {
      setErrorText(getErrorText(error))
    } finally {
      setIsLoading(false)
    }
  }

  // 고른 답과 안 맞게 된 뒤 문항 답은 비우고 알림
  const handleSelect = (no, value) => {
    // 보기가 하나뿐이라 자동으로 골라진 문항은 눌러도 안 풀림
    const question = CREDIT_QUESTIONS.find((item) => item.no === no)
    if (getForcedAnswer(question, answers) !== undefined) return

    const { next, cleared } = removeConflicts({ ...answers, [no]: value }, answers)
    setAnswers(next)
    sessionStorage.removeItem(CHECKED_KEY) // 답을 바꿨으니 결과 버튼을 다시 눌러야 결과가 나옴
    if (cleared.length > 0) showToast(`앞 답이 바뀌어 ${cleared.join(', ')}번 답을 비웠어요`)
    setMissingNos((prev) => prev.filter((missingNo) => missingNo !== no))
  }

  const handleSubmit = () => {
    // 안 고른 필수 문항이 있으면 알림 + 그 문항으로 이동
    const missing = REQUIRED_NOS.filter((no) => answers[no] === undefined)
    if (missing.length > 0) {
      setMissingNos(missing)
      showToast('답하지 않은 문항이 있어요')
      questionRefs.current[missing[0]]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    requestCheck()
  }

  // [다시 진단하기]: 답 비우고 문항 화면으로
  const handleRetry = () => {
    sessionStorage.removeItem(CHECKED_KEY)
    setAnswers({})
    setResult(null)
    setErrorText('')
    setMissingNos([])
  }

  const answeredCount = REQUIRED_NOS.filter((no) => answers[no] !== undefined).length

  return (
    <Wrap>
      {result ? (
        <CreditResultCard result={result} onRetry={handleRetry} onContinue={onContinue} />
      ) : (
        <>
          <Progress>
            <span>답한 문항</span>
            <ProgressBar value={answeredCount} max={QUESTION_COUNT} text={`${answeredCount}/${QUESTION_COUNT}`} label="답한 문항 수" />
          </Progress>

          {CREDIT_QUESTIONS.map((question) => {
            const choices = getChoices(question, answers)

            return (
              <QuestionCard
                key={question.no}
                ref={(element) => {
                  questionRefs.current[question.no] = element
                }}
              >
                <QuestionTitle>
                  {question.no}. {question.title}
                </QuestionTitle>
                <ChipGroup
                  label={question.title}
                  options={choices}
                  value={answers[question.no]}
                  isMultiple={question.isMultiple}
                  onChange={(value) => handleSelect(question.no, value)}
                />
                {missingNos.includes(question.no) && <InlineError>답을 골라 주세요.</InlineError>}
              </QuestionCard>
            )
          })}

          <Footer>
            {errorText && (
              <>
                <InlineError>{errorText}</InlineError>
                <Button $variant="outline" $size="sm" onClick={requestCheck} disabled={isLoading}>
                  다시 시도
                </Button>
              </>
            )}
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? '계산 중...' : submitLabel}
            </Button>
          </Footer>
        </>
      )}
      <Disclaimer>교육용 합성 데이터와 공개 데이터 기반 보정, 공식 신용점수 아님</Disclaimer>
    </Wrap>
  )
}

export default CreditCheck
