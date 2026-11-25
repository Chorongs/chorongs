import { useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import styled from 'styled-components'
import { PREPARING_TEXT } from '../../api/axiosInstance'
import * as myApi from '../../api/myApi'
import useUiStore from '../../store/useUiStore'
import { Button, CalcFormStack, CalcLayout, CalcPanel, EmptyBox, FormField, FormLabel, SegmentedFull } from '../../styles/common'
import { formatMoney } from '../../utils/format'
import {
  CALC_METHODS,
  createCalcForm,
  getCalcErrors,
  getInitialCalc,
  getMethodInterests,
  getPrepayModeResults,
  getSchedule,
  toCalcRecord,
  toScheduleParams,
} from '../../utils/loanMath'
import requireLogin from '../../utils/requireLogin'
import Disclaimer from '../common/Disclaimer'
import SummaryCards from '../common/SummaryCards'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'
import CalcHistoryList from './CalcHistoryList'
import LoanOptions from './LoanOptions'
import MethodCompare from './MethodCompare'
import PaymentChart from './PaymentChart'
import PrepayModeCards from './PrepayModeCards'
import ScheduleTable from './ScheduleTable'

// CA-02 대출 이자 계산기 (SCR-06, /calc): 월 상환액, 총이자 계산. 계산은 프론트에서 (utils/loanMath.js), [계산하기]를 누르면 계산 (버튼 이름은 계산기가 여러 개라 '계산하기'로 통일, 2026-11-20 사용자 결정)
// 왼쪽 입력: 상환 방식 4개 → 옵션(거치, 중도상환, 금리 변동, CA-03, 체크했을 때만 입력칸) → 금액, 상환 기간(직접 입력), 연 이자율 (체증식은 연 증가율도) → [계산하기] [결과 저장] → 계산 기록(CA-07)
// 기간은 칩 없이 칸에 1-600개월을 직접 적음, 거치 기간도 체크했을 때만 입력 (2026-11-25 사용자 결정, 명세서 CA-02 '상환 기간 칩', CA-03 '거치기간 항상 보임'과 다름)
// 오른쪽 결과: 요약 3칸 → 중도상환 후 방식 카드(CA-04) → 회차별 표(CA-05) → 그래프, 방식별 총이자(CA-06) (좁은 화면은 입력 아래)
// 처음 값: CalculatorPage가 navigate state에서 골라 Outlet 값(initial)으로 내려줌. 없으면 기본값
// 계산 시점 (2026-11-20 사용자 결정, 명세서 CA-02 '숫자 바꾸면 바로 다시 계산'과 다름): 입력할 때마다 결과가 바뀌면 정신없어서 [계산하기]을 눌렀을 때만 결과를 새로 계산한다.
//   입력칸 값(form)과 결과에 쓰는 값(applied)을 나눠 들고, 버튼을 누르면 form을 applied로 옮김. 열자마자 처음 값으로 한 번 계산해 보여 줌
//   입력을 바꾼 뒤 아직 안 눌렀으면 결과 위에 안내를 띄우고 [결과 저장]은 막음 (화면에 보이는 결과와 저장 값이 다르지 않게)
//   [중도상환 후 방식 카드]는 결과 쪽 선택이라 누르면 바로 다시 계산
// 입력 검사(E2)는 getCalcErrors: [계산하기]을 누르면 검사해서 오류가 있으면 칸마다 문구를 보이고(그 뒤로는 고치는 대로 갱신) 결과는 그대로 둠. 계산이 안 되는 조건(무한대, 음수)이면 결과를 숨기고 문구
// [결과 저장] → 회원: 입력과 결과를 저장 (API-24, 요청 중 버튼 잠금 E5) / 비회원: 로그인 안내 창 (CM-17 '계산 기록 저장은 회원 전용이에요.')
const Actions = styled.div`
  display: flex;
  gap: 8px;
  & > button {
    flex: 1;
  }
`

// 왼쪽 열: 입력 판 + 그 아래 계산 기록 (가안 .stack.g20)
const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
`

const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
  scroll-margin-top: 76px; /* 계산하기 후 스크롤할 때 상단바에 가리지 않게 */
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

// 입력을 바꿨지만 아직 [계산하기]을 안 눌렀을 때 결과 위 안내
const StaleNotice = styled.p.attrs({ role: 'status' })`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const METHOD_OPTIONS = CALC_METHODS.map((method) => ({ value: method.code, label: method.label }))

// 월 상환액 아래 설명: 방식마다 '월 상환액'이 뜻하는 것이 다름 (첫 달 납입액을 보여 줌)
function getMonthlyNote(method, graceMonths) {
  if (method !== 'BULLET' && graceMonths > 0) return `거치 ${graceMonths}개월은 이자만 내요 (첫 달 기준)`
  return {
    EQUAL_PI: '매달 같은 금액',
    EQUAL_P: '첫 달 기준, 매달 줄어들어요',
    BULLET: '매달 이자만, 원금은 마지막에',
    GRADUATED: '첫 달 기준, 해마다 늘어나요',
  }[method]
}

function LoanCalculator() {
  const { initial } = useOutletContext()
  const showToast = useUiStore((state) => state.showToast)
  // form: 입력칸 값 / applied: 결과에 쓰는 값 ([계산하기]을 누른 때의 form, 처음엔 처음 값)
  const [form, setForm] = useState(() => createCalcForm(initial))
  const [applied, setApplied] = useState(() => createCalcForm(initial))
  const [hasTried, setHasTried] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const topRef = useRef(null)
  const resultRef = useRef(null)

  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // 입력 검사: [계산하기]을 한 번 눌러 본 뒤부터 칸마다 오류 문구를 보임
  const formErrors = getCalcErrors(form)
  const hasFormError = Object.keys(formErrors).length > 0
  const errors = hasTried ? formErrors : {}

  // 결과는 applied로만 계산 (applied는 검사를 통과한 값만 들어옴)
  const params = toScheduleParams(applied)
  const schedule = getSchedule(params)
  const methodInterests = schedule ? getMethodInterests(params) : null
  const prepayResults = schedule && applied.method !== 'BULLET' ? getPrepayModeResults(params) : null
  // 입력을 바꾼 뒤 아직 계산을 안 눌렀는지 (계산에 쓰는 값이 달라졌을 때만)
  const isStale = JSON.stringify(toScheduleParams(form)) !== JSON.stringify(params)

  // [계산하기]: 검사 → 통과하면 입력칸 값으로 결과를 새로 계산. 결과가 입력 아래로 내려가는 좁은 화면에서는 결과 자리로 내려감
  const handleCalculate = () => {
    setHasTried(true)
    if (hasFormError) {
      showToast('입력한 값을 확인해 주세요')
      return
    }
    setApplied(form)
    if (window.matchMedia('(max-width: 899px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // 중도상환 후 방식 카드 (CA-04): 결과 쪽 선택이라 입력칸과 결과 둘 다 바꿔 바로 다시 계산
  const handlePrepayModeChange = (prepayMode) => {
    setForm((prev) => ({ ...prev, prepayMode }))
    setApplied((prev) => ({ ...prev, prepayMode }))
  }

  // [결과 저장] (API-24): 입력(옵션 포함)과 결과 값을 보냄. 불러오면 같은 화면이 열리게 옵션도 저장
  const saveResult = async () => {
    if (isSaving || !schedule) return
    setIsSaving(true)
    try {
      await myApi.postCalc(toCalcRecord(params, schedule))
      showToast('계산 결과를 저장했어요. MY의 계산 기록에서 다시 볼 수 있어요')
      setHistoryKey((count) => count + 1)
    } catch (error) {
      const status = error.response?.status
      // 401(로그인 풀림)은 axiosInstance가 로그인 안내 창을 띄우므로 알림을 겹쳐 띄우지 않음 (E4)
      if (status === 401) return
      if (error.isPreparing) showToast(PREPARING_TEXT)
      else if (status === 400) showToast(error.response?.data?.message ?? '입력한 값을 확인해 주세요')
      else showToast('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = () => {
    if (isStale) {
      showToast('입력을 바꿨어요. [계산하기]를 먼저 눌러 주세요')
      return
    }
    if (!schedule) {
      showToast('입력한 값을 확인해 주세요')
      return
    }
    requireLogin(saveResult, '계산 기록 저장은 회원 전용이에요.')
  }

  // 기록 불러오기 (CA-07): 입력칸을 기록 값으로 채우고 (값이 맞으면 결과도 그 값으로 계산) 맨 위로
  const handleLoad = (item) => {
    const loaded = getInitialCalc(item)
    const loadedForm = createCalcForm(loaded)
    setForm(loadedForm)
    setHasTried(false)
    if (Object.keys(getCalcErrors(loadedForm)).length === 0) setApplied(loadedForm)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    showToast('기록을 불러왔어요')
  }

  let result
  if (!schedule) {
    result = <EmptyBox>이 조건으로는 계산할 수 없어요. 금리나 증가율을 낮춰 보세요.</EmptyBox>
  } else {
    const summaryItems = [
      {
        label: '월 상환액',
        value: formatMoney(schedule.firstPayment, '원'),
        // 중도상환이나 금리 변동이 있으면 납입액이 중간에 바뀌므로 '매달 같은 금액' 대신 첫 달 기준임을 알림
        sub: schedule.rows.some((row) => row.prepay > 0) || params.rateChange
          ? '첫 달 기준, 중간에 달라져요'
          : getMonthlyNote(applied.method, params.graceMonths),
      },
      {
        label: '총이자',
        value: formatMoney(schedule.totalInterest, '원'),
        sub: schedule.lastRound < applied.months ? `${schedule.lastRound}회차에 끝나요 (${applied.months - schedule.lastRound}개월 일찍)` : undefined,
      },
      {
        label: '총 상환액',
        value: formatMoney(schedule.totalPayment, '원'),
        sub: schedule.prepayFee > 0 ? `중도상환수수료 ${formatMoney(schedule.prepayFee, '원')} 포함` : '원금 + 이자',
      },
    ]
    result = (
      <>
        <SummaryCards items={summaryItems} />
        {prepayResults && (
          <PrepayModeCards value={applied.prepayMode} results={prepayResults} onChange={handlePrepayModeChange} />
        )}
        <ScheduleTable rows={schedule.rows} />
        <PaymentChart rows={schedule.rows} />
        <MethodCompare interests={methodInterests} currentMethod={applied.method} />
        <Disclaimer>
          실제 상환액은 금융기관의 일수 계산, 반올림 방식에 따라 조금 다를 수 있어요. 금리는 연 이율을 12로 나눈 월 이율로 계산해요.
        </Disclaimer>
      </>
    )
  }

  return (
    <CalcLayout ref={topRef}>
      <Left>
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

            <LoanOptions form={form} errors={errors} onChange={handleChange} />

            <NumberField
              isLabelInside
              label="빌릴 금액"
              unit="원"
              value={form.amount}
              onChange={(amount) => handleChange({ amount })}
              hasComma
              showReadable
              isRequired
              placeholder="예: 10,000,000"
              error={errors.amount}
            />

            <NumberField
              isLabelInside
              label="상환 기간"
              unit="개월"
              value={form.months}
              onChange={(months) => handleChange({ months })}
              isRequired
              placeholder="예: 36"
              error={errors.months}
            />

            <NumberField
              isLabelInside
              label="연 이자율"
              unit="%"
              decimals={2}
              value={form.rate}
              onChange={(rate) => handleChange({ rate })}
              isRequired
              placeholder="예: 5.5"
              error={errors.rate}
            />

            {form.method === 'GRADUATED' && (
              <FormField>
                <NumberField
                  isLabelInside
                  label="연 증가율"
                  unit="%"
                  decimals={2}
                  value={form.growth}
                  onChange={(growth) => handleChange({ growth })}
                  isRequired
                  placeholder="예: 5"
                  error={errors.growth}
                />
                <Hint>체증식은 12개월마다 납입액이 이 비율만큼 늘어나요.</Hint>
              </FormField>
            )}

            <Actions>
              <Button onClick={handleCalculate}>
                <Icon name="calc" size={16} />
                계산하기
              </Button>
              <Button $variant="outline" disabled={isSaving} onClick={handleSave}>
                <Icon name="doc" size={16} />
                결과 저장
              </Button>
            </Actions>
          </CalcFormStack>
        </CalcPanel>
        <CalcHistoryList onLoad={handleLoad} refreshKey={historyKey} />
      </Left>

      <Result ref={resultRef}>
        {isStale && <StaleNotice>입력을 바꿨어요. [계산하기]를 누르면 결과가 새로 계산돼요.</StaleNotice>}
        {result}
      </Result>
    </CalcLayout>
  )
}

export default LoanCalculator
