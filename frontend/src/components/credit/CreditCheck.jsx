import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { postCreditCheck } from '../../api/diagnosisApi'
import { CREDIT_QUESTIONS } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, Card, InlineError } from '../../styles/common'
import Disclaimer from '../common/Disclaimer'
import ChipGroup from '../ui/ChipGroup'
import ProgressBar from '../ui/ProgressBar'
import CreditResultCard from './CreditResultCard'

// CR-02 신용 셀프 진단: 10문항 답 → 예상 점수대 (API-09)
// submitLabel: 버튼 글 / onContinue(creditBand): 있으면 추천 창용 결과 카드 (RC-13)
// 답은 이 탭에만 임시 저장 (sessionStorage 'creditAnswers'), 점수와 결과는 브라우저에 저장하지 않는다.
// 답, 점수는 console에 출력하지 않는다. (E6)
const STORAGE_KEY = 'creditAnswers'
const UNKNOWN_VALUE = 0
const QUESTION_COUNT = CREDIT_QUESTIONS.length
const FINANCE_QUESTION_NO = 5
const LOAN_COUNT_QUESTION_NO = 4
const NO_LOAN_VALUE = 1 // 문항 4 보기 '0건'
const REQUIRED_NOS = CREDIT_QUESTIONS.filter((question) => question.no !== FINANCE_QUESTION_NO).map((question) => question.no)

// 답이 서로 안 맞는 경우 (화면에서만 확인, 막지 않고 경고)
const CONFLICT_CHECKS = [
  {
    text: '대출이 0건인데 대출 잔액을 골랐어요',
    isConflict: (a) => a[4] === NO_LOAN_VALUE && a[6] !== undefined && a[6] !== 1 && a[6] !== UNKNOWN_VALUE,
  },
  {
    text: '1년 안에 30일 이상 연체가 없는데 3개월 안에 30일 이상 연체를 골랐어요',
    isConflict: (a) => a[1] === 1 && a[2] === 4,
  },
  {
    text: '카드가 없는데 현금서비스를 썼다고 골랐어요',
    isConflict: (a) => a[7] === 1 && (a[8] === 2 || a[8] === 3),
  },
]

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

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Warning = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: var(--fs-md);
  font-weight: 600;
`

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
`

function loadAnswers() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isAllRequiredAnswered(answers) {
  return REQUIRED_NOS.every((no) => answers[no] !== undefined)
}

// 화면 답 → API-09 보내는 값 (문항 5는 보기 번호 목록, 대출 없으면 빈 목록 / 나머지는 [보기 번호])
function toRequestAnswers(answers) {
  return CREDIT_QUESTIONS.map(({ no }) => ({
    questionNo: no,
    choices: no === FINANCE_QUESTION_NO ? (answers[no] ?? []) : [answers[no]],
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
  const [initialAnswers] = useState(loadAnswers)
  const [answers, setAnswers] = useState(initialAnswers)
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(() => isAllRequiredAnswered(initialAnswers))
  const [errorText, setErrorText] = useState('')
  const [warnings, setWarnings] = useState([])
  const [missingNos, setMissingNos] = useState([])
  const questionRefs = useRef({})

  // 답은 이 탭에만 임시 저장
  // TODO(ST-01, CHORONG-43): 로그아웃, 탈퇴 때 sessionStorage 'creditAnswers'를 지우는 쪽을 연결한다.
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  }, [answers])

  // 화면을 다시 열었을 때 필수 문항이 다 답해져 있으면 결과까지 다시 표시
  useEffect(() => {
    if (!isAllRequiredAnswered(initialAnswers)) return undefined
    let isStale = false
    postCreditCheck(toRequestAnswers(initialAnswers))
      .then((data) => {
        if (!isStale) setResult(data)
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
  }, [initialAnswers])

  // TODO(ST-03, CHORONG-45): 결과가 나오면 useRecommendStore.setDiagBand(creditBand)를 부른다. (추천 3단계 비교용, 구간만)
  const requestCheck = async () => {
    setIsLoading(true)
    setErrorText('')
    try {
      setResult(await postCreditCheck(toRequestAnswers(answers)))
    } catch (error) {
      setErrorText(getErrorText(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelect = (no, value) => {
    setAnswers((prev) => {
      const next = { ...prev, [no]: value }
      // 대출이 0건이면 이용 금융권은 비움
      if (no === LOAN_COUNT_QUESTION_NO && value === NO_LOAN_VALUE) next[FINANCE_QUESTION_NO] = []
      return next
    })
    setWarnings([])
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

    // 답이 서로 안 맞으면 막지 않고 경고 → 한 번 더 누르면 그대로 진행
    const conflicts = CONFLICT_CHECKS.filter((check) => check.isConflict(answers)).map((check) => check.text)
    if (conflicts.length > 0 && warnings.length === 0) {
      setWarnings(conflicts)
      return
    }

    setWarnings([])
    requestCheck()
  }

  // [다시 진단하기]: 답 비우고 문항 화면으로
  const handleRetry = () => {
    setAnswers({})
    setResult(null)
    setErrorText('')
    setWarnings([])
    setMissingNos([])
  }

  const answeredCount = CREDIT_QUESTIONS.filter(({ no }) => {
    if (no === FINANCE_QUESTION_NO) return answers[4] === NO_LOAN_VALUE || answers[no]?.length > 0
    return answers[no] !== undefined
  }).length

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
            const choices = question.options.map((label, index) => ({ value: index + 1, label }))
            if (question.hasUnknown) choices.push({ value: UNKNOWN_VALUE, label: '잘 모르겠어요' })
            const isNoLoan = question.no === FINANCE_QUESTION_NO && answers[LOAN_COUNT_QUESTION_NO] === NO_LOAN_VALUE

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
                {question.hint && <Hint>{question.hint}</Hint>}
                {isNoLoan ? (
                  <Hint>대출이 0건이라 고르지 않아도 돼요.</Hint>
                ) : (
                  <ChipGroup
                    label={question.title}
                    options={choices}
                    value={answers[question.no]}
                    isMultiple={question.isMultiple}
                    onChange={(value) => handleSelect(question.no, value)}
                  />
                )}
                {missingNos.includes(question.no) && <InlineError>답을 골라 주세요.</InlineError>}
              </QuestionCard>
            )
          })}

          <Footer>
            {warnings.length > 0 && (
              <Warning role="status">
                {warnings.map((text) => (
                  <span key={text}>확인해 보세요: {text}.</span>
                ))}
                <span>그대로 진행하려면 [{submitLabel}]을 한 번 더 눌러 주세요.</span>
              </Warning>
            )}
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
