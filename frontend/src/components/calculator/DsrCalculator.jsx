import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useUiStore from '../../store/useUiStore'
import { Button, Card, EmptyBox, FormField, FormLabel, FormStack, Panel, SegmentedFull } from '../../styles/common'
import { formatMoney, formatRate } from '../../utils/format'
import {
  DSR_BASELINES,
  DSR_KINDS,
  DSR_LOAN_DEFAULT,
  DSR_MAX_LOANS,
  getDsrErrors,
  getDsrResult,
  getInitialDsr,
  toDsrRecord,
} from '../../utils/finance'
import { REPAY_METHODS, isNumber } from '../../utils/loanMath'
import requireLogin from '../../utils/requireLogin'
import HBar from '../chart/HBar'
import Disclaimer from '../common/Disclaimer'
import SectionHeader from '../common/SectionHeader'
import SummaryCards from '../common/SummaryCards'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'

// CA-09 DSR 계산기 (SCR-08, /calc/dsr): 내 DSR 계산. 계산은 프론트에서 (utils/finance.js)
// 왼쪽 입력: 연소득 → 대출 목록 (최대 10건: 종류, 상환 방식, 대출금, 금리, 기간, [+ 대출 추가], [삭제]) → [계산하기] [결과 저장]
// 오른쪽 결과: 요약 3칸 (내 DSR, 1년에 갚는 돈, 40%까지 더 갚을 수 있는 돈) → 기준선 막대 (은행 40%, 2금융권 50%) → 대출별 1년 상환액 → 고지 (좁은 화면은 입력 아래)
// 계산 시점은 CA-02와 같다: 입력칸 값(form)과 결과에 쓰는 값(applied)을 나눠 들고, [계산하기]를 눌렀을 때만 form을 applied로 옮긴다.
//   입력을 바꾸고 안 눌렀으면 결과 위에 안내를 띄우고 [결과 저장]은 막음 (화면에 보이는 결과와 저장 값이 다르지 않게)
// 처음 값: MY 계산 기록 [불러오기]가 넘긴 navigate state가 있으면 그 값 (범위 밖 칸은 기본값, CA-01), 없으면 기본값 / 열자마자 처음 값으로 한 번 계산해 보여 줌
// 대출 한 줄마다 id를 붙여 줄을 구별한다 (줄을 빼도 다른 줄의 입력칸이 섞이지 않게). id는 화면용이라 계산과 저장에는 쓰지 않음
// 화면이 길어지지 않게 대출 줄은 접을 수 있다: 줄마다 제목 줄을 누르거나 줄 아래 [완료]를 누르면 접힘 (제목 줄로 접을 때도 [완료]와 같게, 그 줄에 입력 오류가 있으면 접지 않고 오류 문구를 보임. 접힌 줄은 한 줄 요약만, 제목 줄을 누르면 다시 펼침). [+ 대출 추가]는 앞 줄의 상태를 그대로 두고 새 줄을 펼쳐서 추가
//   [계산하기]가 입력 오류로 막히면 오류가 있는 줄은 펼쳐서 오류 문구를 보여 줌
// [결과 저장] → 회원: 입력과 결과를 저장 (API-57, 요청 중 버튼 잠금 E5) / 비회원: 로그인 안내 창 (CM-17 '계산 기록 저장은 회원 전용이에요.')
const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const GroupTitle = styled.h3`
  font-size: var(--fs-xl);
  font-weight: 800;
  &:not(:first-child) {
    padding-top: 20px;
    border-top: 1px solid var(--line-2);
  }
`

// 대출 한 줄 상자
const LoanBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: var(--r-sm);
  background: var(--paper);
`

const LoanHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

// 대출 한 줄 제목 줄: 누르면 그 줄이 펼쳐지고 다시 누르면 접힘. 접혀 있을 때는 한 줄 요약을 보임
const LoanToggle = styled.button.attrs({ type: 'button' })`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--fs-base);
  font-weight: 800;
  text-align: left;
  cursor: pointer;
`

const LoanSummary = styled.span`
  min-width: 0;
  overflow: hidden;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const LoanArrow = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  margin-left: auto;
  color: var(--muted);
  transition: transform var(--t-pop);
  transform: rotate(${({ $isOpen }) => ($isOpen ? '180deg' : '0deg')});
`

// 접어도 입력칸은 그대로 두려고 hidden으로만 숨김 (입력한 값이 사라지지 않게)
const LoanFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  &[hidden] {
    display: none;
  }
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

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

const Bars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Rows = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
`

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--fs-base);
  & > dt {
    color: var(--cocoa);
  }
  & > dd {
    margin: 0;
    font-family: var(--f-num);
    font-weight: 700;
    text-align: right;
  }
`

const KIND_OPTIONS = DSR_KINDS.map((kind) => ({ value: kind.code, label: kind.label }))
const METHOD_OPTIONS = REPAY_METHODS.map((method) => ({ value: method.code, label: method.label }))
const KIND_LABEL = Object.fromEntries(DSR_KINDS.map((kind) => [kind.code, kind.label]))
const METHOD_LABEL = Object.fromEntries(REPAY_METHODS.map((method) => [method.code, method.label]))

// 결과 판정 글과 요약 첫 칸 색 (SummaryCards tone)
const LEVELS = {
  GOOD: { tone: 'good', text: `좋음 (은행 기준 ${DSR_BASELINES.bank}% 이하)` },
  WARN: { tone: 'warn', text: `주의 (2금융권 기준 ${DSR_BASELINES.second}% 이하)` },
  BAD: { tone: 'bad', text: `위험 (${DSR_BASELINES.second}% 초과)` },
}

const money = (value) => formatMoney(value, '원')

// 입력 한 줄마다 id를 붙임 (줄 구별용)
const withIds = (form) => ({ ...form, loans: form.loans.map((loan, index) => ({ ...loan, id: index + 1 })) })

// 접힌 줄에 보일 한 줄 요약: 종류 · 상환 방식 · 대출금 (대출금이 비어 있으면 안내)
const getLoanSummary = (loan) => {
  const amountText = isNumber(loan.amount) ? formatMoney(loan.amount, '만원') : '대출금 입력 전'
  return `${KIND_LABEL[loan.kind]} · ${METHOD_LABEL[loan.method]} · ${amountText}`
}

function DsrCalculator() {
  const location = useLocation()
  const showToast = useUiStore((state) => state.showToast)
  // form: 입력칸 값 / applied: 결과에 쓰는 값 ([계산하기]를 누른 때의 form, 처음엔 처음 값)
  const [form, setForm] = useState(() => withIds(getInitialDsr(location.state)))
  const [applied, setApplied] = useState(() => withIds(getInitialDsr(location.state)))
  const [hasTried, setHasTried] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // 펼쳐 둔 대출 줄의 id 목록: 처음엔 첫 줄만, 줄이 길어지지 않게 나머지는 접어 둠
  const [openIds, setOpenIds] = useState(() => [form.loans[0].id])
  // [완료]를 눌러 본 줄의 id: [계산하기] 전이라도 그 줄은 오류 문구를 보임
  const [checkedIds, setCheckedIds] = useState([])
  const nextLoanId = useRef(form.loans.length + 1)
  const resultRef = useRef(null)

  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleLoanChange = (id, patch) => {
    setForm((prev) => ({ ...prev, loans: prev.loans.map((loan) => (loan.id === id ? { ...loan, ...patch } : loan)) }))
  }

  // [+ 대출 추가]: 최대 10건. 앞 줄의 펼침, 접힘은 그대로 두고 새 줄은 펼쳐서 추가
  const handleAddLoan = () => {
    if (form.loans.length >= DSR_MAX_LOANS) return
    const id = nextLoanId.current
    nextLoanId.current += 1
    setForm((prev) => ({ ...prev, loans: [...prev.loans, { ...DSR_LOAN_DEFAULT, id }] }))
    setOpenIds((prev) => [...prev, id])
  }

  // [삭제]: 누른 줄(id)만 지움. 1건은 남겨 둠
  const handleRemoveLoan = (id) => {
    if (form.loans.length <= 1) return
    setForm((prev) => ({ ...prev, loans: prev.loans.filter((loan) => loan.id !== id) }))
    setOpenIds((prev) => prev.filter((openId) => openId !== id))
  }

  // [완료]: 그 줄의 입력이 맞으면 접음 (입력값은 그대로). 입력 오류가 있으면 접지 않고 그 줄에 오류 문구를 보임
  const handleCloseLoan = (id) => {
    const index = form.loans.findIndex((loan) => loan.id === id)
    if (Object.keys(formErrors.loans?.[index] ?? {}).length > 0) {
      setCheckedIds((prev) => [...new Set([...prev, id])])
      showToast('입력한 값을 확인해 주세요')
      return
    }
    setOpenIds((prev) => prev.filter((openId) => openId !== id))
  }

  // 제목 줄을 누르면 그 줄만 펼치고 접음. 접을 때는 [완료]와 같게 입력 오류가 있으면 접지 않음
  const handleToggleLoan = (id) => {
    if (openIds.includes(id)) {
      handleCloseLoan(id)
      return
    }
    setOpenIds((prev) => [...prev, id])
  }

  // 입력 검사: [계산하기]를 한 번 눌러 본 뒤부터 칸마다 오류 문구를 보임
  const formErrors = getDsrErrors(form)
  const hasFormError = Object.keys(formErrors).length > 0
  const errors = hasTried ? formErrors : {}

  // 결과는 applied로만 계산 (applied는 검사를 통과한 값만 들어옴)
  const result = getDsrResult(applied)
  // 입력을 바꾼 뒤 아직 계산을 안 눌렀는지
  const isStale = JSON.stringify(form) !== JSON.stringify(applied)

  // [계산하기]: 검사 → 통과하면 입력칸 값으로 결과를 새로 계산. 결과가 입력 아래로 내려가는 좁은 화면에서는 결과 자리로 내려감
  const handleCalculate = () => {
    setHasTried(true)
    if (hasFormError) {
      showToast('입력한 값을 확인해 주세요')
      // 접혀 있는 줄에 오류가 있으면 그 줄을 펼쳐 오류 문구가 보이게 함
      const errorIds = form.loans
        .filter((loan, index) => Object.keys(formErrors.loans?.[index] ?? {}).length > 0)
        .map((loan) => loan.id)
      setOpenIds((prev) => [...new Set([...prev, ...errorIds])])
      return
    }
    setApplied(form)
    if (window.matchMedia('(max-width: 899px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // [결과 저장] (API-57): 입력과 결과 값을 보냄 (화면은 만원, 서버는 원)
  const saveResult = async () => {
    if (isSaving || !result) return
    setIsSaving(true)
    try {
      await myApi.postDsrCalc(toDsrRecord(applied, result))
      showToast('계산 결과를 저장했어요. MY의 계산 기록에서 다시 볼 수 있어요')
    } catch (error) {
      const status = error.response?.status
      // 401(로그인 풀림)은 axiosInstance가 로그인 안내 창을 띄우므로 알림을 겹쳐 띄우지 않음 (E4)
      if (status === 401) return
      if (status === 400) showToast(error.response?.data?.message ?? '입력한 값을 확인해 주세요')
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
    if (!result) {
      showToast('입력한 값을 확인해 주세요')
      return
    }
    requireLogin(saveResult, '계산 기록 저장은 회원 전용이에요.')
  }

  let resultView
  if (!result) {
    resultView = <EmptyBox>이 조건으로는 계산할 수 없어요. 대출 입력을 확인해 주세요.</EmptyBox>
  } else {
    const level = LEVELS[result.level]
    const summaryItems = [
      { label: '내 DSR', value: `${formatRate(result.dsrRate)}%`, tone: level.tone, sub: level.text },
      { label: '1년에 갚는 돈', value: money(result.yearlyPayment), sub: `한 달 평균 ${money(Math.round(result.yearlyPayment / 12))}` },
      {
        label: `${DSR_BASELINES.bank}%까지 더 갚을 수 있는 돈`,
        value: money(result.extraRoom),
        sub:
          result.extraRoom === 0
            ? `이미 ${DSR_BASELINES.bank}%를 넘었어요`
            : `1년 기준, 한 달 약 ${money(Math.round(result.extraRoom / 12))}`,
      },
    ]
    const barMax = Math.max(result.dsrRate, DSR_BASELINES.second)
    resultView = (
      <>
        <SummaryCards items={summaryItems} />
        <section>
          <SectionHeader title="기준선과 비교" description="은행은 40%, 2금융권은 50%까지 봐요." />
          <Bars>
            <HBar label="내 DSR" value={result.dsrRate} max={barMax} valueText={`${formatRate(result.dsrRate)}%`} isActive />
            <HBar label="은행" value={DSR_BASELINES.bank} max={barMax} valueText={`${DSR_BASELINES.bank}%`} />
            <HBar label="2금융권" value={DSR_BASELINES.second} max={barMax} valueText={`${DSR_BASELINES.second}%`} />
          </Bars>
        </section>
        <section>
          <SectionHeader title="대출별 1년 상환액" description="앞으로 1년 동안 갚는 원금과 이자예요." />
          <Card>
            <Rows>
              {applied.loans.map((loan, index) => (
                <Row key={loan.id}>
                  <dt>
                    {index + 1}. {KIND_LABEL[loan.kind]} · {METHOD_LABEL[loan.method]}
                  </dt>
                  <dd>{money(result.loanPayments[index])}</dd>
                </Row>
              ))}
            </Rows>
          </Card>
        </section>
        <Disclaimer>
          실제 규제 기준은 금융당국 정책에 따라 달라요. 기준선 비율은 예시 값이에요. 만기일시는 원금을 대출 기간(신용대출은 5년)에 나눠 갚는다고 보고 계산해요.
        </Disclaimer>
      </>
    )
  }

  const isLoanFull = form.loans.length >= DSR_MAX_LOANS

  return (
    <Layout>
      <Panel>
        <FormStack>
          <GroupTitle>소득</GroupTitle>
          <NumberField
            label="연소득"
            unit="만원"
            value={form.annualIncome}
            onChange={(annualIncome) => handleChange({ annualIncome })}
            hasComma
            isRequired
            placeholder="예: 5,000"
            error={errors.annualIncome}
          />

          <GroupTitle>가진 대출과 새로 받을 대출</GroupTitle>
          {form.loans.map((loan, index) => {
            const loanErrors = (hasTried || checkedIds.includes(loan.id) ? formErrors.loans?.[index] : null) ?? {}
            const isOpen = openIds.includes(loan.id)
            const fieldsId = `dsr-loan-${loan.id}`
            return (
              <LoanBox key={loan.id}>
                <LoanHead>
                  <LoanToggle
                    aria-expanded={isOpen}
                    aria-controls={fieldsId}
                    aria-label={`대출 ${index + 1} ${isOpen ? '접기' : '펼치기'}`}
                    onClick={() => handleToggleLoan(loan.id)}
                  >
                    <span>대출 {index + 1}</span>
                    {!isOpen && <LoanSummary>{getLoanSummary(loan)}</LoanSummary>}
                    <LoanArrow $isOpen={isOpen}>
                      <Icon name="chevron_down" />
                    </LoanArrow>
                  </LoanToggle>
                  {form.loans.length > 1 && (
                    <Button $variant="ghost" $size="sm" onClick={() => handleRemoveLoan(loan.id)} aria-label={`대출 ${index + 1} 삭제`}>
                      삭제
                    </Button>
                  )}
                </LoanHead>
                <LoanFields id={fieldsId} hidden={!isOpen}>
                  <FormField>
                    <FormLabel>종류</FormLabel>
                    <SegmentedFull>
                      <Segmented
                        options={KIND_OPTIONS}
                        value={loan.kind}
                        onChange={(kind) => handleLoanChange(loan.id, { kind })}
                        label={`대출 ${index + 1} 종류`}
                      />
                    </SegmentedFull>
                  </FormField>
                  <FormField>
                    <FormLabel>상환 방식</FormLabel>
                    <SegmentedFull>
                      <Segmented
                        options={METHOD_OPTIONS}
                        value={loan.method}
                        onChange={(method) => handleLoanChange(loan.id, { method })}
                        label={`대출 ${index + 1} 상환 방식`}
                      />
                    </SegmentedFull>
                  </FormField>
                  <NumberField
                    label="대출금"
                    unit="만원"
                    value={loan.amount}
                    onChange={(amount) => handleLoanChange(loan.id, { amount })}
                    hasComma
                    isRequired
                    placeholder="예: 20,000"
                    error={loanErrors.amount}
                  />
                  <NumberField
                    label="금리"
                    unit="%"
                    decimals={2}
                    value={loan.rate}
                    onChange={(rate) => handleLoanChange(loan.id, { rate })}
                    isRequired
                    placeholder="예: 4.5"
                    error={loanErrors.rate}
                  />
                  <NumberField
                    label="기간"
                    unit="개월"
                    value={loan.months}
                    onChange={(months) => handleLoanChange(loan.id, { months })}
                    isRequired
                    placeholder="예: 360"
                    error={loanErrors.months}
                  />
                  <Button $variant="soft" onClick={() => handleCloseLoan(loan.id)} aria-label={`대출 ${index + 1} 입력 완료`}>
                    완료
                  </Button>
                </LoanFields>
              </LoanBox>
            )
          })}
          <FormField>
            <Button $variant="soft" disabled={isLoanFull} onClick={handleAddLoan}>
              + 대출 추가
            </Button>
            <Hint>
              {isLoanFull
                ? `대출은 최대 ${DSR_MAX_LOANS}건까지 넣을 수 있어요.`
                : `지금 ${form.loans.length}건 (최대 ${DSR_MAX_LOANS}건)`}
            </Hint>
          </FormField>

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
        </FormStack>
      </Panel>

      <Result ref={resultRef}>
        {isStale && <StaleNotice>입력을 바꿨어요. [계산하기]를 누르면 결과가 새로 계산돼요.</StaleNotice>}
        {resultView}
      </Result>
    </Layout>
  )
}

export default DsrCalculator
