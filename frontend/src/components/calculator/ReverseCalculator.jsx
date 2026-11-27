import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button, CalcFormStack, CalcLayout, CalcPanel, EmptyBox, FormField, FormLabel, SegmentedFull } from '../../styles/common'
import { formatMoney } from '../../utils/format'
import {
  REVERSE_METHODS,
  getInitialReverse,
  getReverseErrors,
  getReverseResult,
  toLoanCalcState,
  toReverseRecord,
} from '../../utils/finance'
import { CALC_LIMITS } from '../../utils/loanMath'
import requireLogin from '../../utils/requireLogin'
import HBar from '../chart/HBar'
import Disclaimer from '../common/Disclaimer'
import SectionHeader from '../common/SectionHeader'
import SummaryCards from '../common/SummaryCards'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'

// CA-10 상환능력 기반 대출 계산기 (SCR-23, /calc/reverse): 매달 갚을 수 있는 돈으로 최대 대출 금액 역산. 계산은 프론트에서 (utils/finance.js)
// 왼쪽 입력: 상환 방식 2개 (원리금균등, 원금균등. 만기일시는 매달 이자만 내서 빌릴 수 있는 금액이 지나치게 크게 나오므로 뺌) → 매달 갚을 돈, 연 이자율, 대출 기간(칩 없이 1-600개월 직접 입력) → [계산하기] [결과 저장]
// 오른쪽 결과: 요약 3칸 (최대 대출 금액, 총 이자, 총 갚는 돈) → 기간별 빌릴 수 있는 금액 → [대출 이자 계산기로 이동] → 고지 (좁은 화면은 입력 아래)
// 계산 시점은 CA-02와 같다: 입력칸 값(form)과 결과에 쓰는 값(applied)을 나눠 들고, [계산하기]를 눌렀을 때만 form을 applied로 옮긴다.
//   입력을 바꾸고 안 눌렀으면 결과 위에 안내를 띄우고 [결과 저장], [대출 이자 계산기로 이동]은 막음 (화면에 보이는 결과와 저장, 넘기는 값이 다르지 않게)
// 처음 값: MY 계산 기록 [불러오기]가 넘긴 navigate state가 있으면 그 값 (범위 밖 칸은 기본값, CA-01), 없으면 기본값 / 열자마자 처음 값으로 한 번 계산해 보여 줌
// [결과 저장] → 회원: 입력과 결과를 저장 (API-58, 요청 중 버튼 잠금 E5) / 비회원: 로그인 안내 창 (CM-17 '계산 기록 저장은 회원 전용이에요.')
//   201(저장 성공), 409(같은 입력의 기록이 이미 있음) → 버튼을 '저장했어요'로 잠금, 409는 오류 알림 대신 '이미 저장한 계산 기록이에요'
//   잠금은 그 계산 값(applied)에만: 입력을 바꿔 [계산하기]를 다시 누르면 풀림 (대출 이자 계산기 API-24와 같음. 입력이 바뀌면 다른 계산이라 다시 저장할 수 있어야 함)
//   회원이면 결과가 나올 때마다 이미 저장한 계산인지 서버에 물어봄 (API-58 check): true면 처음부터 '저장했어요' (다른 탭, 다른 단말기, 새로고침 전에 저장한 것도)
const Actions = styled.div`
  display: flex;
  gap: 8px;
  & > button {
    flex: 1;
  }
`

const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
  scroll-margin-top: 76px; /* 계산하기 후 스크롤할 때 상단바에 가리지 않게 */
`

// 입력을 바꿨지만 아직 [계산하기]를 안 눌렀을 때 결과 위 안내
const StaleNotice = styled.p.attrs({ role: 'status' })`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: var(--fs-sm);
  font-weight: 600;
`

// 기간별 막대 줄 묶음 (가안 .mcmp)
const Bars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const MoveBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
`

const METHOD_OPTIONS = REVERSE_METHODS.map((method) => ({ value: method.code, label: method.label }))
// 고지 문구에 넣을 상환 방식 이름 (원리금균등, 원금균등)
const METHOD_LABEL = Object.fromEntries(REVERSE_METHODS.map((method) => [method.code, method.label]))
const MAX_MOVE_AMOUNT = CALC_LIMITS.amountMax

const money = (value) => formatMoney(value, '원')

// 요약 첫 칸 아래 글: 상환 방식에 따라 '매달 갚는 돈'의 뜻이 다름
function getMonthlyText(method, monthlyWon) {
  if (method === 'EQUAL_P') return `첫 달 ${money(monthlyWon)}을 갚는 기준 (매달 줄어요)`
  return `매달 ${money(monthlyWon)}씩 갚는 기준`
}

function ReverseCalculator() {
  const location = useLocation()
  // 저장에 성공하면 CalculatorPage 오른쪽 칸의 계산 기록을 다시 받게 함
  const { onSaved } = useOutletContext()
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  // form: 입력칸 값 / applied: 결과에 쓰는 값 ([계산하기]를 누른 때의 form, 처음엔 처음 값)
  const [form, setForm] = useState(() => getInitialReverse(location.state))
  const [applied, setApplied] = useState(() => getInitialReverse(location.state))
  // [계산하기]를 눌러 결과를 낸 적이 있는지. 처음 값이 계산할 수 있는 값이면(기록 불러오기, 다른 화면이 넘긴 값) 처음부터 결과를 보임,
  // 빈칸으로 열면 [계산하기]를 누를 때까지 결과 자리에 안내만 (예시 값으로 낸 결과를 내 결과로 오해하지 않게)
  const [isCalculated, setIsCalculated] = useState(() => Object.keys(getReverseErrors(form)).length === 0)
  const [hasTried, setHasTried] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // 저장했거나 서버가 '이미 저장한 기록'이라고 알려 준 계산 값 (applied를 JSON으로, 없으면 null)
  const [savedKey, setSavedKey] = useState(null)
  const resultRef = useRef(null)

  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // 입력 검사: [계산하기]를 한 번 눌러 본 뒤부터 칸마다 오류 문구를 보임
  const formErrors = getReverseErrors(form)
  const hasFormError = Object.keys(formErrors).length > 0
  const errors = hasTried ? formErrors : {}

  // 결과는 applied로만 계산 (applied는 검사를 통과한 값만 들어옴)
  const result = getReverseResult(applied)
  // 입력을 바꾼 뒤 아직 계산을 안 눌렀는지
  const saveKey = JSON.stringify(applied)
  const isStale = JSON.stringify(form) !== saveKey
  // 이미 저장한 계산인지 (저장했거나 409를 받은 그 계산 값이 지금 결과와 같고, 입력도 바꾸지 않았을 때)
  const isSaved = isCalculated && savedKey === saveKey && !isStale
  const isMember = useAuthStore((state) => state.status === 'member')
  // 저장 본문 (계산이 안 되면 null)을 글로: 서버에 물어볼 때 씀 (글을 기준으로 해야 그릴 때마다 다시 묻지 않음)
  const recordKey = isCalculated && result ? JSON.stringify(toReverseRecord(applied, result)) : null

  // 회원이면 이 계산을 이미 저장했는지 서버에 한 번 물어봄 (API-58 check, 추천 결과 저장과 같은 방식): 화면이 열릴 때, 로그인했을 때, 새로 계산했을 때
  // true면 '저장했어요'로 잠금. 묻지 못하면 버튼을 그대로 두고 따로 알리지 않음 (누르면 서버가 409로 막음)
  useEffect(() => {
    if (!isMember || recordKey === null || savedKey === saveKey) return undefined
    let isCancelled = false
    myApi
      .checkReverseCalc(JSON.parse(recordKey))
      .then((saved) => {
        if (!isCancelled && saved) setSavedKey(saveKey)
      })
      .catch(() => {})
    return () => {
      isCancelled = true
    }
  }, [isMember, recordKey, saveKey, savedKey])

  // [계산하기]: 검사 → 통과하면 입력칸 값으로 결과를 새로 계산. 결과가 입력 아래로 내려가는 좁은 화면에서는 결과 자리로 내려감
  const handleCalculate = () => {
    setHasTried(true)
    if (hasFormError) {
      showToast('입력한 값을 확인해 주세요')
      return
    }
    setApplied(form)
    setIsCalculated(true)
    // 입력과 결과가 세로 한 줄(CalcLayout 열이 1개)일 때만 결과 자리로 내려감. 배치가 화면 폭이 아니라 계산기 칸 폭으로 바뀌어서 열 수로 봄 (두 열이면 결과가 이미 입력 옆에 보이므로 내려가지 않음)
    const resultEl = resultRef.current
    if (resultEl && getComputedStyle(resultEl.parentElement).gridTemplateColumns.split(' ').length === 1) {
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // [결과 저장] (API-58): 입력과 결과 값을 보냄 (입력 값은 원 단위로 들고 있어 그대로 보냄, 만원은 입력칸에서만 씀)
  const saveResult = async () => {
    if (isSaving || isSaved || !result) return
    setIsSaving(true)
    try {
      await myApi.postReverseCalc(toReverseRecord(applied, result))
      setSavedKey(saveKey)
      showToast('계산 결과를 저장했어요. MY의 계산 기록에서 다시 볼 수 있어요')
      onSaved?.()
    } catch (error) {
      const status = error.response?.status
      // 401(로그인 풀림)은 axiosInstance가 로그인 안내 창을 띄우므로 알림을 겹쳐 띄우지 않음 (E4)
      if (status === 401) return
      // 409: 같은 입력의 기록이 이미 있음. 오류가 아니라 안내하고 버튼을 '저장했어요'로 잠금
      if (status === 409) {
        setSavedKey(saveKey)
        showToast('이미 저장한 계산 기록이에요')
      } else if (status === 400) showToast(error.response?.data?.message ?? '입력한 값을 확인해 주세요')
      else showToast('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  // 결과가 화면에 나와 있고 입력을 바꾸지 않았을 때만 저장, 이동 (바꿨으면 [계산하기] 안내)
  const checkReady = () => {
    if (isStale) {
      showToast('입력을 바꿨어요. [계산하기]를 먼저 눌러 주세요')
      return false
    }
    if (!result) {
      showToast('입력한 값을 확인해 주세요')
      return false
    }
    return true
  }

  const handleSave = () => {
    if (!isCalculated) {
      showToast('값을 넣고 [계산하기]를 먼저 눌러 주세요')
      return
    }
    if (!checkReady()) return
    requireLogin(saveResult, '계산 기록 저장은 회원 전용이에요.')
  }

  // [대출 이자 계산기로 이동]: 최대 대출 금액, 기간, 금리, 상환 방식을 넘김 (로그인 필요 없음)
  const handleMove = () => {
    if (!checkReady()) return
    navigate('/calc', { state: toLoanCalcState(applied, result) })
  }

  let resultView
  if (!isCalculated) {
    resultView = <EmptyBox>값을 넣고 [계산하기]를 누르면 결과가 보여요.</EmptyBox>
  } else if (!result) {
    resultView = <EmptyBox>이 조건으로는 계산할 수 없어요. 이자율과 기간을 확인해 주세요.</EmptyBox>
  } else {
    const summaryItems = [
      {
        label: '최대 대출 금액',
        value: money(result.maxLoan),
        tone: 'hl',
        sub: getMonthlyText(applied.method, applied.monthly),
      },
      { label: '총 이자', value: money(result.totalInterest), sub: `${applied.months}개월 동안 내는 이자` },
      { label: '총 갚는 돈', value: money(result.totalPayment), sub: '원금과 이자를 합한 금액' },
    ]
    const isCapped = result.maxLoan > MAX_MOVE_AMOUNT
    const maxByTerm = Math.max(...result.byTerm.map((term) => term.maxLoan))
    resultView = (
      <>
        <SummaryCards items={summaryItems} />
        <section>
          <SectionHeader title="기간별 빌릴 수 있는 금액" description="같은 상환 방식, 이자율로 기간만 바꿔 봤어요." />
          <Bars>
            {result.byTerm.map((term) => (
              <HBar
                key={term.months}
                label={`${term.months}개월`}
                value={term.maxLoan}
                max={maxByTerm}
                valueText={money(term.maxLoan)}
                isActive={term.months === applied.months}
              />
            ))}
          </Bars>
        </section>
        <MoveBox>
          <Button $variant="outline" onClick={handleMove}>
            <Icon name="calc" size={16} />
            대출 이자 계산기로 이동
          </Button>
          {isCapped && <Hint>대출 이자 계산기는 최대 {money(MAX_MOVE_AMOUNT)}까지라 그 금액으로 넘겨요.</Hint>}
        </MoveBox>
        <Disclaimer>
          매달 갚을 수 있는 돈을 기준으로 {METHOD_LABEL[applied.method]}으로 갚는다고 보고 거꾸로 계산한 대출 원금이에요
          {applied.method === 'EQUAL_P' ? ' (원금균등은 가장 많이 내는 첫 달 납입액 기준)' : ''}. 금융기관이 승인하는 한도가 아니며, 실제
          한도는 소득, 신용, DSR 규제로 더 작을 수 있어요.
        </Disclaimer>
      </>
    )
  }

  return (
    <CalcLayout>
      <CalcPanel>
        <CalcFormStack>
          <FormField>
            <FormLabel>상환 방식</FormLabel>
            <SegmentedFull>
              <Segmented
                options={METHOD_OPTIONS}
                value={form.method}
                onChange={(method) => handleChange({ method })}
                isOnPanel
                label="상환 방식"
              />
            </SegmentedFull>
          </FormField>
          <NumberField
            isLabelInside
            label="매달 갚을 돈"
            unit="만원"
            isManwon
            value={form.monthly}
            onChange={(monthly) => handleChange({ monthly })}
            hasComma
            showReadable
            isRequired
            placeholder="예: 100"
            error={errors.monthly}
          />
          <NumberField
            isLabelInside
            label="연 이자율"
            unit="%"
            decimals={2}
            value={form.rate}
            onChange={(rate) => handleChange({ rate })}
            isRequired
            placeholder="예: 5"
            error={errors.rate}
          />
          <NumberField
            isLabelInside
            label="대출 기간"
            unit="개월"
            value={form.months}
            onChange={(months) => handleChange({ months })}
            isRequired
            placeholder="예: 36"
            error={errors.months}
          />

          <Actions>
            <Button onClick={handleCalculate}>
              <Icon name="calc" size={16} />
              계산하기
            </Button>
            <Button $variant="outline" disabled={isSaving || isSaved} onClick={handleSave}>
              <Icon name={isSaved ? 'check' : 'doc'} size={16} />
              {isSaved ? '저장했어요' : '결과 저장'}
            </Button>
          </Actions>
        </CalcFormStack>
      </CalcPanel>

      <Result ref={resultRef}>
        {isCalculated && isStale && <StaleNotice>입력을 바꿨어요. [계산하기]를 누르면 결과가 새로 계산돼요.</StaleNotice>}
        {resultView}
      </Result>
    </CalcLayout>
  )
}

export default ReverseCalculator
