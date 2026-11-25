import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useUiStore from '../../store/useUiStore'
import {
  Button,
  CalcFormStack,
  CalcKv,
  CalcLayout,
  CalcLinkButton,
  CalcPanel,
  EmptyBox,
  FormField,
  FormLabel,
  InlineError,
  SegmentedFull,
} from '../../styles/common'
import { formatMoney, formatRate } from '../../utils/format'
import {
  HOME_MAX_OTHER_LOANS,
  HOME_OTHER_LOAN_DEFAULT,
  HOME_RATE_TYPES,
  HOME_REGIONS,
  getHomeErrors,
  getHomeResult,
  getInitialHome,
  toHomeRecord,
} from '../../utils/finance'
import requireLogin from '../../utils/requireLogin'
import Checkbox from '../ui/Checkbox'
import Disclaimer from '../common/Disclaimer'
import SummaryCards from '../common/SummaryCards'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'

// CA-11 집 살 때 대출한도 계산기 (SCR-25, /calc/home): 집 살 때 최대 대출 한도. 계산은 프론트에서 (utils/finance.js)
// 이름은 '내 집 대출한도'에서 바꿈 (2026-11-25 사용자 결정): 이미 가진 집을 담보로 빌리는 경우와 헷갈리지 않게.
//   사려는 집을 담보로 받는 주택담보대출을 처음 받는 경우만 기준 (기존 주택담보대출 잔액은 빼지 않음), 이 안내를 입력칸 맨 위에 보임
// 다른 대출은 여러 건을 넣을 수 있고 건마다 1년 상환액을 구해 더함 (2026-11-25 사용자 결정)
// 소득 기준은 DTI가 아니라 은행 DSR 40% (2026-11-25 사용자 결정): 다른 대출은 잔액, 금리로 받아 5년 원리금균등으로 갚는다고 보고 1년 상환액을 뺌. 상환 방식 칸은 없음 (원리금균등 고정)
// 집값 구간별 대출 상한 (수도권·규제 지역만)과 금리 유형별 스트레스 금리 (변동형 +1.5%p, 혼합형 +1.05%p, 고정형 0, 소득 기준 한도 계산에만 더함)도 반영 (2026-11-25 사용자 결정, 값은 예시)
// 왼쪽 입력: 안내 한 줄 → 집값, 집이 있는 곳, 생애 첫 집 구입, 연소득, 대출 금리, 금리 유형, 대출 기간, 다른 대출이 있어요 (체크하면 다른 대출 줄: 잔액, 금리, 남은 기간, [+ 다른 대출 추가] 최대 10건, [삭제]) → [계산하기] [결과 저장]
// 오른쪽 결과: 요약 3칸 (최대 대출 한도, 집값 기준 LTV, 소득 기준 DSR) → 상세 3줄 → 고지 (좁은 화면은 입력 아래)
// 계산 시점은 CA-02와 같다: 입력칸 값(form)과 결과에 쓰는 값(applied)을 나눠 들고, [계산하기]를 눌렀을 때만 form을 applied로 옮긴다.
//   입력을 바꾸고 안 눌렀으면 결과 위에 안내를 띄우고 [결과 저장]은 막음 (화면에 보이는 결과와 저장 값이 다르지 않게)
// 처음 값: MY 계산 기록 [불러오기]가 넘긴 navigate state가 있으면 그 값 (범위 밖 칸은 기본값, CA-01), 없으면 기본값 / 열자마자 처음 값으로 한 번 계산해 보여 줌
// [결과 저장] → 회원: 입력과 결과를 저장 (API-59, 요청 중 버튼 잠금 E5) / 비회원: 로그인 안내 창 (CM-17 '계산 기록 저장은 회원 전용이에요.')
// 입력칸 맨 위 안내: 어떤 대출 기준인지
const Intro = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.6;
`

// '다른 대출이 있어요'를 체크했을 때 펼쳐지는 상자 (대출 이자 계산기 옵션 상자와 같은 모양)
const OtherBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--paper);
`

// 다른 대출 한 줄: 제목 줄 (이름과 [삭제]) + 칸 3개, 두 번째 줄부터는 위에 구분선
const OtherLoan = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  & + & {
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
`

const OtherHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--fs-md);
  font-weight: 800;
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

const REGION_OPTIONS = HOME_REGIONS.map((region) => ({ value: region.code, label: region.label }))
const RATE_TYPE_OPTIONS = HOME_RATE_TYPES.map((type) => ({ value: type.code, label: type.label }))

const money = (value) => formatMoney(value, '원')

// 다른 대출 한 줄마다 id를 붙임 (줄을 지워도 다른 줄의 입력칸이 섞이지 않게). id는 화면용이라 계산과 저장에는 쓰지 않음
const withIds = (form) => ({ ...form, otherLoans: form.otherLoans.map((loan, index) => ({ ...loan, id: index + 1 })) })

function HomeLimitCalculator() {
  const location = useLocation()
  const showToast = useUiStore((state) => state.showToast)
  // form: 입력칸 값 / applied: 결과에 쓰는 값 ([계산하기]를 누른 때의 form, 처음엔 처음 값)
  const [form, setForm] = useState(() => withIds(getInitialHome(location.state)))
  const [applied, setApplied] = useState(() => withIds(getInitialHome(location.state)))
  const [hasTried, setHasTried] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const nextLoanId = useRef(form.otherLoans.length + 1)
  const resultRef = useRef(null)

  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const handleOtherLoanChange = (id, patch) => {
    setForm((prev) => ({
      ...prev,
      otherLoans: prev.otherLoans.map((loan) => (loan.id === id ? { ...loan, ...patch } : loan)),
    }))
  }

  // [+ 다른 대출 추가]: 최대 10건
  const handleAddOtherLoan = () => {
    if (form.otherLoans.length >= HOME_MAX_OTHER_LOANS) return
    const id = nextLoanId.current
    nextLoanId.current += 1
    setForm((prev) => ({ ...prev, otherLoans: [...prev.otherLoans, { ...HOME_OTHER_LOAN_DEFAULT, id }] }))
  }

  // [삭제]: 누른 줄(id)만 지움. 1건은 남겨 둠
  const handleRemoveOtherLoan = (id) => {
    if (form.otherLoans.length <= 1) return
    setForm((prev) => ({ ...prev, otherLoans: prev.otherLoans.filter((loan) => loan.id !== id) }))
  }

  // 입력 검사: [계산하기]를 한 번 눌러 본 뒤부터 칸마다 오류 문구를 보임
  const formErrors = getHomeErrors(form)
  const hasFormError = Object.keys(formErrors).length > 0
  const errors = hasTried ? formErrors : {}

  // 결과는 applied로만 계산 (applied는 검사를 통과한 값만 들어옴)
  const result = getHomeResult(applied)
  // 입력을 바꾼 뒤 아직 계산을 안 눌렀는지
  const isStale = JSON.stringify(form) !== JSON.stringify(applied)

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

  // [결과 저장] (API-59): 입력과 결과 값을 보냄 (화면과 서버 모두 원 단위)
  const saveResult = async () => {
    if (isSaving || !result) return
    setIsSaving(true)
    try {
      await myApi.postHomeCalc(toHomeRecord(applied, result))
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
    resultView = <EmptyBox>이 조건으로는 계산할 수 없어요. 금리와 기간을 확인해 주세요.</EmptyBox>
  } else {
    const summaryItems = [
      {
        label: '최대 대출 한도',
        value: money(result.maxLoan),
        tone: 'hl',
        sub: result.isLtvLower ? '집값 기준이 더 작아서 이 금액이에요' : '소득 기준이 더 작아서 이 금액이에요',
      },
      {
        label: '집값 기준 (LTV)',
        value: money(result.ltvLimit),
        sub: [
          `집값의 ${result.ltvRate}%${applied.isFirstHome ? ' (생애 첫 집)' : ''}`,
          result.isPriceCapped ? `집값 구간 상한 ${money(result.priceCap)} 적용` : null,
        ]
          .filter(Boolean)
          .join(', '),
      },
      {
        label: '소득 기준 (DSR)',
        value: money(result.dsrLimit),
        sub:
          result.dsrLimit === 0
            ? '다른 대출 상환액이 커서 더 빌릴 수 없어요'
            : `연소득의 ${result.dsrRate}%에서 다른 대출 상환액을 뺀 돈 기준`,
      },
    ]
    resultView = (
      <>
        <SummaryCards items={summaryItems} />
        <CalcKv>
          <dt>첫 달 납입액</dt>
          <dd>{money(result.firstPayment)}</dd>
          <dt>내 돈으로 낼 금액</dt>
          <dd>{money(result.ownMoney)}</dd>
          <dt>적용 비율</dt>
          <dd>
            LTV {result.ltvRate}% · DSR {result.dsrRate}%
          </dd>
          {result.stressRate > 0 && (
            <>
              <dt>한도에 쓴 금리</dt>
              <dd>
                연 {formatRate(result.limitRate)}% (입력 {formatRate(applied.rate)}% + 스트레스 {formatRate(result.stressRate)}%p)
              </dd>
            </>
          )}
        </CalcKv>
        <Disclaimer>
          실제 한도는 은행 심사와 금융당국 정책에 따라 더 작을 수 있어요. 지역별 LTV 비율, 집값 구간별 대출 상한, 스트레스 금리, DSR 40%는 예시 값이에요.
        </Disclaimer>
      </>
    )
  }

  return (
    <CalcLayout>
      <CalcPanel>
        <CalcFormStack>
          <Intro>
            사려는 집을 담보로 받는 주택담보대출 기준이에요. 이미 받은 주택담보대출이 없는, 처음 받는 경우로 계산해요. 신용대출
            같은 다른 대출이 있으면 아래에서 &apos;다른 대출이 있어요&apos;를 체크하고 잔액과 금리를 넣어 주세요.
          </Intro>
          <NumberField
            isLabelInside
            label="집값"
            unit="원"
            value={form.housePrice}
            onChange={(housePrice) => handleChange({ housePrice })}
            hasComma
            showReadable
            isRequired
            placeholder="예: 500,000,000"
            error={errors.housePrice}
          />
          <FormField>
            <FormLabel>집이 있는 곳</FormLabel>
            <SegmentedFull>
              <Segmented
                options={REGION_OPTIONS}
                value={form.region}
                onChange={(region) => handleChange({ region })}
                isOnPanel
                label="집이 있는 곳"
              />
            </SegmentedFull>
            <Hint>{HOME_REGIONS.find((region) => region.code === form.region)?.description}</Hint>
          </FormField>
          <Checkbox
            checked={form.isFirstHome}
            onChange={(isFirstHome) => handleChange({ isFirstHome })}
            label="생애 첫 집 구입"
            description="처음 집을 사면 집값 기준 한도를 더 넉넉하게 봐요."
          />
          <NumberField
            isLabelInside
            label="연소득"
            unit="원"
            value={form.annualIncome}
            onChange={(annualIncome) => handleChange({ annualIncome })}
            hasComma
            showReadable
            isRequired
            placeholder="예: 60,000,000"
            error={errors.annualIncome}
          />
          <NumberField
            isLabelInside
            label="대출 금리"
            unit="%"
            decimals={2}
            value={form.rate}
            onChange={(rate) => handleChange({ rate })}
            isRequired
            placeholder="예: 4.5"
            error={errors.rate}
          />
          <FormField>
            <FormLabel>금리 유형</FormLabel>
            <SegmentedFull>
              <Segmented
                options={RATE_TYPE_OPTIONS}
                value={form.rateType}
                onChange={(rateType) => handleChange({ rateType })}
                isOnPanel
                label="금리 유형"
              />
            </SegmentedFull>
            <Hint>
              {HOME_RATE_TYPES.find((type) => type.code === form.rateType)?.description} 잘 모르겠다면 변동형을 두세요.
            </Hint>
          </FormField>
          <NumberField
            isLabelInside
            label="대출 기간"
            unit="년"
            value={form.years}
            onChange={(years) => handleChange({ years })}
            isRequired
            placeholder="예: 30"
            error={errors.years}
          />
          <Checkbox
            checked={form.isOtherLoan}
            onChange={(isOtherLoan) => handleChange({ isOtherLoan })}
            label="다른 대출이 있어요"
            description="신용대출 같은 다른 대출이 있으면 그 상환액만큼 한도가 줄어요."
          />
          {form.isOtherLoan && (
            <OtherBox>
              {form.otherLoans.map((loan, index) => {
                const loanErrors = errors.otherLoans?.[index] ?? {}
                return (
                  <OtherLoan key={loan.id}>
                    <OtherHead>
                      <span>다른 대출 {index + 1}</span>
                      {form.otherLoans.length > 1 && (
                        <CalcLinkButton onClick={() => handleRemoveOtherLoan(loan.id)} aria-label={`다른 대출 ${index + 1} 삭제`}>
                          삭제
                        </CalcLinkButton>
                      )}
                    </OtherHead>
                    <NumberField
                      isLabelInside
                      isCompact
                      label="잔액"
                      unit="원"
                      value={loan.balance}
                      onChange={(balance) => handleOtherLoanChange(loan.id, { balance })}
                      hasComma
                      showReadable
                      placeholder="예: 30,000,000"
                      error={loanErrors.balance}
                    />
                    <NumberField
                      isLabelInside
                      isCompact
                      label="금리"
                      unit="%"
                      decimals={2}
                      value={loan.rate}
                      onChange={(rate) => handleOtherLoanChange(loan.id, { rate })}
                      placeholder="예: 5"
                      error={loanErrors.rate}
                    />
                    <NumberField
                      isLabelInside
                      isCompact
                      label="남은 기간"
                      unit="개월"
                      value={loan.months}
                      onChange={(months) => handleOtherLoanChange(loan.id, { months })}
                      placeholder="예: 60"
                      error={loanErrors.months}
                    />
                  </OtherLoan>
                )
              })}
              <Button $variant="outline" $size="sm" disabled={form.otherLoans.length >= HOME_MAX_OTHER_LOANS} onClick={handleAddOtherLoan}>
                + 다른 대출 추가
              </Button>
              <InlineError>{errors.otherInterestTotal}</InlineError>
              <Hint>
                {form.otherLoans.length >= HOME_MAX_OTHER_LOANS
                  ? `다른 대출은 최대 ${HOME_MAX_OTHER_LOANS}건까지 넣을 수 있어요. `
                  : ''}
                다른 대출은 남은 기간 동안 나눠 갚는 것으로 계산해요. 남은 기간을 비우면 5년으로 봐요.
              </Hint>
            </OtherBox>
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

      <Result ref={resultRef}>
        {isStale && <StaleNotice>입력을 바꿨어요. [계산하기]를 누르면 결과가 새로 계산돼요.</StaleNotice>}
        {resultView}
      </Result>
    </CalcLayout>
  )
}

export default HomeLimitCalculator
