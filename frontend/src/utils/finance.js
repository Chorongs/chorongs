import { MONTHS_OPTIONS_DEFAULT, MONTHS_OPTIONS_HOUSING } from '../constants/options'
import { CALC_LIMITS, REPAY_METHODS, calcPayment, isNumber } from './loanMath'
import { formatMoney } from './format'

// 대출 갈아타기, DSR, 내 집 대출한도, 상환능력 기반 대출 계산 (화면 없는 계산, CHORONG-56)
// 갈아타기(CA-08), 내 집 대출한도(CA-11), 상환능력 기반 대출(CA-10), DSR(CA-09) 계산이 계산기마다 한 구역씩 있다.

const isEmptyValue = (value) => value === '' || value === null || value === undefined
const orZero = (value) => (isEmptyValue(value) ? 0 : value)
const isInRange = (value, min, max) => isNumber(value) && value >= min && value <= max

// ---------------------------------------------------------------------------
// 대출 갈아타기 (CA-08)
// ---------------------------------------------------------------------------

// 갈아타기 입력 한도: 기간 1-600개월, 금리 0-20%, 수수료 0-5% (명세서). 금액은 대출 이자 계산기와 같은 1만원-10억원, 원 단위 (위쪽 한도는 명세서에 없어 정한 값)
export const CHANGE_LIMITS = { ...CALC_LIMITS, monthsMin: 1, monthsMax: 600 }

// 바로 열었을 때 처음 값: 숫자 칸은 빈칸, 선택 사항인 수수료율과 기타 비용은 0, 상환 방식은 원리금균등 (2026-11-26 사용자 결정, [계산하기]를 눌러야 결과가 나옴)
export const CHANGE_DEFAULTS = {
  currentMethod: 'EQUAL_PI',
  balance: '',
  currentRate: '',
  currentMonths: '',
  newMethod: 'EQUAL_PI',
  newRate: '',
  newMonths: '',
  feeRate: 0,
  etcCost: 0,
}

const CHANGE_METHOD_CODES = REPAY_METHODS.map((method) => method.code)

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → 갈아타기 입력칸 처음 값 (CA-01)
// state: { currentRepayMethod, currentBalance 원, currentRate, currentMonths, newRepayMethod, newRate, newMonths, feeRate, etcCost 원 }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 그대로)
export function getInitialChange(state) {
  const form = { ...CHANGE_DEFAULTS }
  const { amountMin, amountMax, rateMax, feeMax, monthsMin, monthsMax } = CHANGE_LIMITS

  if (CHANGE_METHOD_CODES.includes(state?.currentRepayMethod)) form.currentMethod = state.currentRepayMethod
  if (CHANGE_METHOD_CODES.includes(state?.newRepayMethod)) form.newMethod = state.newRepayMethod

  if (isInRange(state?.currentBalance, amountMin, amountMax)) form.balance = Math.round(state.currentBalance)
  if (isInRange(state?.etcCost, 0, amountMax)) form.etcCost = Math.round(state.etcCost)

  if (isInRange(state?.currentRate, 0, rateMax)) form.currentRate = state.currentRate
  if (isInRange(state?.newRate, 0, rateMax)) form.newRate = state.newRate
  if (isInRange(state?.feeRate, 0, feeMax)) form.feeRate = state.feeRate

  if (Number.isInteger(state?.currentMonths) && isInRange(state.currentMonths, monthsMin, monthsMax)) {
    form.currentMonths = state.currentMonths
  }
  if (Number.isInteger(state?.newMonths) && isInRange(state.newMonths, monthsMin, monthsMax)) {
    form.newMonths = state.newMonths
  }

  return form
}

// 갈아타기 입력 검사 (E2): 칸 이름별 오류 문구, 오류가 없으면 빈 객체 = 계산할 수 있음
// 수수료율, 기타 비용은 비워 두면 0으로 본다
export function getChangeErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax, feeMax, monthsMin, monthsMax } = CHANGE_LIMITS
  const amountText = `${formatMoney(amountMin, '원')} 이상 ${formatMoney(amountMax, '원')} 이하`

  if (isEmptyValue(form.balance)) errors.balance = '남은 대출금을 입력해 주세요'
  else if (!isInRange(form.balance, amountMin, amountMax)) errors.balance = `남은 대출금은 ${amountText}로 입력해 주세요`

  const rateFields = [
    ['currentRate', '지금 금리'],
    ['newRate', '새 금리'],
  ]
  for (const [name, label] of rateFields) {
    if (isEmptyValue(form[name])) errors[name] = `${label}를 입력해 주세요`
    else if (!isInRange(form[name], 0, rateMax)) errors[name] = `${label}는 0% 이상 ${rateMax}% 이하로 입력해 주세요`
  }

  const monthsFields = [
    ['currentMonths', '남은 기간'],
    ['newMonths', '새 대출 기간'],
  ]
  for (const [name, label] of monthsFields) {
    if (isEmptyValue(form[name])) errors[name] = `${label}을 입력해 주세요`
    else if (!Number.isInteger(form[name]) || !isInRange(form[name], monthsMin, monthsMax)) {
      errors[name] = `${label}은 ${monthsMin}개월 이상 ${monthsMax}개월 이하로 입력해 주세요`
    }
  }

  if (!isEmptyValue(form.feeRate) && !isInRange(form.feeRate, 0, feeMax)) {
    errors.feeRate = `수수료는 0% 이상 ${feeMax}% 이하로 입력해 주세요`
  }
  if (!isEmptyValue(form.etcCost) && !isInRange(form.etcCost, 0, amountMax)) {
    errors.etcCost = `기타 비용은 0원 이상 ${formatMoney(amountMax, '원')} 이하로 입력해 주세요`
  }

  return errors
}

// 갈아타기 계산: 남은 대출금 전체를 새 대출로 갈아탄다고 보고, 두 대출의 총이자를 대출 이자 계산기와 같은 함수(calcPayment)로 계산
// 아끼는 돈 = 지금 대출 총이자 - 새 대출 총이자 - 중도상환수수료 (남은 대출금 x 수수료율) - 기타 비용 (0 이상이면 갈아타는 게 이득)
// 결과 (모두 원 단위): { savingAmount (더 내면 음수), isGain, currentInterest, newInterest, currentFirstPayment, newFirstPayment, prepayFee, etcCost }
// 입력이 이상하거나 계산이 안 되면 null
export function getChangeResult(form) {
  const balance = form.balance
  const current = calcPayment(form.currentMethod, balance, form.currentRate, form.currentMonths)
  const next = calcPayment(form.newMethod, balance, form.newRate, form.newMonths)
  if (!current || !next) return null

  const prepayFee = Math.round((balance * orZero(form.feeRate)) / 100)
  const etcCost = orZero(form.etcCost)
  const savingAmount = current.totalInterest - next.totalInterest - prepayFee - etcCost
  if (![savingAmount, prepayFee, etcCost].every(isNumber)) return null

  return {
    savingAmount,
    isGain: savingAmount >= 0,
    currentInterest: current.totalInterest,
    newInterest: next.totalInterest,
    currentFirstPayment: current.monthly,
    newFirstPayment: next.monthly,
    prepayFee,
    etcCost,
  }
}

// [결과 저장]으로 보낼 값 (API-56): 화면과 서버가 같은 원 단위라 그대로 보냄. 수수료율, 기타 비용의 빈 칸은 0
export function toChangeRecord(form, result) {
  return {
    currentRepayMethod: form.currentMethod,
    currentBalance: form.balance,
    currentRate: form.currentRate,
    currentMonths: form.currentMonths,
    newRepayMethod: form.newMethod,
    newRate: form.newRate,
    newMonths: form.newMonths,
    feeRate: orZero(form.feeRate),
    etcCost: result.etcCost,
    savingAmount: result.savingAmount,
    newFirstPayment: result.newFirstPayment,
    newTotalInterest: result.newInterest,
  }
}

// ---------------------------------------------------------------------------
// 내 집 대출한도 (CA-11)
// ---------------------------------------------------------------------------

// 입력 한도: 금리 0-20%, 기간 1-50년 (명세서). 금액은 원 단위로 1만원 이상, 위쪽은 서버가 받는 한도(9,999,999,999원) 안의 99억 9,999만원
export const HOME_LIMITS = {
  amountMin: 10000,
  amountMax: 9999990000,
  rateMax: 20,
  yearsMin: 1,
  yearsMax: 50,
  otherMonthsMin: 1,
  otherMonthsMax: 600,
}

// 집이 있는 곳 (코드는 API-59 homeRegion), description: 고른 선택지 아래에 보일 설명 (용어를 모르는 사람을 위해)
export const HOME_REGIONS = [
  {
    code: 'REGULATED',
    label: '수도권·규제 지역',
    description: '서울, 경기, 인천 등 수도권이거나 정부가 정한 규제지역이면 이쪽을 골라요. 해당되는지 모르겠으면 은행에 확인해 보세요.',
  },
  { code: 'OTHER', label: '그 외 지역', description: '수도권도 규제지역도 아닌 지방이면 이쪽을 골라요.' },
]

// 지역별 LTV 비율(%): ltv는 일반 무주택, firstLtv는 생애 첫 집 (예시 값, 실제 값은 담당자가 개발 때 정함)
// 2025년 10.15 대책 기준: 규제 지역 40%, 규제 지역 첫 집 70% (40%라는 해설도 있어 확인 필요), 그 외 지역 70%, 첫 집 80% (2026-11-25 사용자 결정)
// 소득 기준은 지역과 관계없이 은행 DSR 기준 (DSR_BASELINES.bank, 2026-11-25 사용자 결정으로 DTI에서 바꿈)
export const HOME_RATIOS = {
  OTHER: { ltv: 70, firstLtv: 80 },
  REGULATED: { ltv: 40, firstLtv: 70 },
}

// 다른 대출의 1년 상환액(DSR에 넣을 값)은 DSR 계산기와 같은 방법(getDsrLoanYearly)으로 계산: 종류, 상환 방식, 잔액을 남은 기간으로 (2026-11-26 사용자 결정)
// 남은 기간을 비우면 5년(60개월)
export const HOME_OTHER_MONTHS = 60

// 다른 대출은 여러 건 넣을 수 있다 (최대 10건, DSR 계산기와 같음). 건마다 { kind 종류, method 상환 방식, balance 원, rate %, months 개월 }, 새 줄의 처음 값
// 숫자 칸은 빈칸 (잔액을 비우면 0, 남은 기간을 비우면 5년으로 봄, 2026-11-26 사용자 결정)
export const HOME_MAX_OTHER_LOANS = 10
export const HOME_OTHER_LOAN_DEFAULT = { kind: 'CREDIT', method: 'EQUAL_PI', balance: '', rate: '', months: '' }

// 건별 값 없이 1년 이자만 있는 옛 기록을 한 건으로 맞출 때 쓰는 금리 (%): 잔액 = 이자 / 이 금리
const HOME_OTHER_FALLBACK_RATE = 5

// 수도권·규제 지역의 집값 구간별 대출 상한 (원, 예시 값, 실제 값은 담당자가 개발 때 정함): 집값 15억 이하 6억, 25억 이하 4억, 그 위 2억
// maxPrice 이하일 때 그 줄의 maxLoan이 상한 (위에서부터 처음 맞는 줄), 그 외 지역은 상한 없음
export const HOME_PRICE_CAPS = [
  { maxPrice: 1500000000, maxLoan: 600000000 },
  { maxPrice: 2500000000, maxLoan: 400000000 },
  { maxPrice: Infinity, maxLoan: 200000000 },
]

// 금리 유형과 스트레스 금리 (예시 값, 실제 값은 담당자가 개발 때 정함): 소득 기준(DSR) 한도를 계산할 때 입력한 금리에 이 가산금리(%p)를 더함
// description: 고른 유형 아래에 보일 설명 (용어를 모르는 사람을 위해)
// 변동형 1.5%p, 혼합형은 그 70% (1.05%p), 고정형은 가산 없음. 한도에만 쓰고 첫 달 납입액은 입력한 금리로 계산
export const HOME_RATE_TYPES = [
  {
    code: 'VARIABLE',
    label: '변동형',
    stressRate: 1.5,
    description: '금리가 주기적으로 바뀌어요. 금리가 오르면 이자도 늘어서 한도를 가장 작게 봐요.',
  },
  {
    code: 'MIXED',
    label: '혼합형',
    stressRate: 1.05,
    description: '처음 몇 년(보통 5년)은 금리가 같고, 그 뒤에는 바뀌어요. 한도는 변동형보다 조금 크게 봐요.',
  },
  {
    code: 'FIXED',
    label: '고정형',
    stressRate: 0,
    description: '만기까지 금리가 같아요. 스트레스 금리를 더하지 않아서 한도를 가장 크게 봐요.',
  },
]

// 바로 열었을 때 처음 값: 숫자 칸은 빈칸, 고르는 칸(지역, 생애 첫 집, 금리 유형)은 그대로 (2026-11-26 사용자 결정, [계산하기]를 눌러야 결과가 나옴)
export const HOME_DEFAULTS = {
  housePrice: '',
  region: 'OTHER',
  isFirstHome: false,
  annualIncome: '',
  isOtherLoan: false,
  otherLoans: [{ ...HOME_OTHER_LOAN_DEFAULT }],
  rate: '',
  rateType: 'VARIABLE',
  years: '',
}

const HOME_REGION_CODES = HOME_REGIONS.map((region) => region.code)

// 다른 대출 1년 이자 합계 (원): 건마다 잔액 x 금리 / 100을 더해 반올림, '다른 대출이 있어요'를 체크하지 않았으면 0
const getHomeOtherInterest = (form) =>
  form.isOtherLoan
    ? Math.round((form.otherLoans ?? []).reduce((sum, loan) => sum + (orZero(loan.balance) * orZero(loan.rate)) / 100, 0))
    : 0

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → 내 집 계산기 입력칸 처음 값 (CA-01)
// state: { housePrice 원, homeRegion, firstHome (Y, N), annualIncome 원, otherInterest 원, interestRate, loanYears, repayMethod, rateType, otherLoans: [{ loanKind, repayMethod, loanAmount 원, interestRate, loanMonths }] }
// 다른 대출은 서버에 건별로 저장된 otherLoans가 있으면 그대로 채우고(모든 건이 범위 안일 때만), 없는 옛 기록은 아래처럼 1년 이자로 맞춘 한 건
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 그대로)
// 건별 값이 없는 옛 기록은 1년 이자(otherInterest)만 있어서, 이자가 있으면 기본 금리로 잔액을 거꾸로 맞춘 한 건으로 채우고 남은 기간은 기본값(5년)
// 다른 대출 건의 종류, 상환 방식은 칸마다 따로 검사해서 없거나 이상하면 그 칸만 처음 값 (신용대출, 원리금균등)
// 내 집 대출의 상환 방식은 원리금균등 하나라 기록의 repayMethod는 쓰지 않음
function getSavedOtherLoans(loans) {
  if (!Array.isArray(loans) || loans.length < 1 || loans.length > HOME_MAX_OTHER_LOANS) return null
  const { amountMin, amountMax, rateMax, otherMonthsMin, otherMonthsMax } = HOME_LIMITS
  const isValid = loans.every(
    (loan) =>
      isInRange(loan?.loanAmount, amountMin, amountMax) &&
      isInRange(loan?.interestRate, 0, rateMax) &&
      Number.isInteger(loan?.loanMonths) &&
      isInRange(loan.loanMonths, otherMonthsMin, otherMonthsMax),
  )
  if (!isValid) return null
  return loans.map((loan) => ({
    kind: DSR_KIND_CODES.includes(loan.loanKind) ? loan.loanKind : HOME_OTHER_LOAN_DEFAULT.kind,
    method: REPAY_METHODS.some((method) => method.code === loan.repayMethod) ? loan.repayMethod : HOME_OTHER_LOAN_DEFAULT.method,
    balance: Math.round(loan.loanAmount),
    rate: loan.interestRate,
    months: loan.loanMonths,
  }))
}

export function getInitialHome(state) {
  const form = { ...HOME_DEFAULTS, otherLoans: HOME_DEFAULTS.otherLoans.map((loan) => ({ ...loan })) }
  const { amountMin, amountMax, rateMax, yearsMin, yearsMax } = HOME_LIMITS

  if (HOME_REGION_CODES.includes(state?.homeRegion)) form.region = state.homeRegion
  if (state?.firstHome === 'Y') form.isFirstHome = true
  if (state?.firstHome === 'N') form.isFirstHome = false

  if (isInRange(state?.housePrice, amountMin, amountMax)) form.housePrice = Math.round(state.housePrice)
  if (isInRange(state?.annualIncome, amountMin, amountMax)) form.annualIncome = Math.round(state.annualIncome)
  if (HOME_RATE_TYPES.some((type) => type.code === state?.rateType)) form.rateType = state.rateType

  const savedLoans = getSavedOtherLoans(state?.otherLoans)
  if (savedLoans) {
    form.otherLoans = savedLoans
    form.isOtherLoan = true
  } else if (isInRange(state?.otherInterest, 0, amountMax)) {
    const balance = Math.round((state.otherInterest * 100) / HOME_OTHER_FALLBACK_RATE)
    if (isInRange(balance, 0, amountMax)) {
      form.otherLoans = [{ ...HOME_OTHER_LOAN_DEFAULT, balance, rate: HOME_OTHER_FALLBACK_RATE, months: HOME_OTHER_MONTHS }]
      form.isOtherLoan = balance > 0
    }
  }

  if (isInRange(state?.interestRate, 0, rateMax)) form.rate = state.interestRate
  if (Number.isInteger(state?.loanYears) && isInRange(state.loanYears, yearsMin, yearsMax)) {
    form.years = state.loanYears
  }

  return form
}

// 내 집 계산 입력 검사 (E2): 칸 이름별 오류 문구, 오류가 없으면 빈 객체 = 계산할 수 있음
// 다른 대출 칸은 '다른 대출이 있어요'를 체크했을 때만 검사: 잔액은 비워 두면 0으로 보고, 잔액이 있으면 다른 대출 금리가 필요하다 (남은 기간은 비워 두면 5년)
// 다른 대출 칸의 오류는 errors.otherLoans[줄 번호] = { balance, rate, months } (오류 없는 줄은 {}), 1년 이자 합계가 한도를 넘으면 errors.otherInterestTotal
export function getHomeErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax, yearsMin, yearsMax } = HOME_LIMITS
  const amountText = `${formatMoney(amountMin, '원')} 이상 ${formatMoney(amountMax, '원')} 이하`

  if (isEmptyValue(form.housePrice)) errors.housePrice = '집값을 입력해 주세요'
  else if (!isInRange(form.housePrice, amountMin, amountMax)) errors.housePrice = `집값은 ${amountText}로 입력해 주세요`

  if (isEmptyValue(form.annualIncome)) errors.annualIncome = '연소득을 입력해 주세요'
  else if (!isInRange(form.annualIncome, amountMin, amountMax)) errors.annualIncome = `연소득은 ${amountText}로 입력해 주세요`

  // 다른 대출은 '다른 대출이 있어요'를 체크했을 때만 검사 (체크를 풀면 숨은 칸의 값은 무시)
  if (form.isOtherLoan) {
    const { otherMonthsMin, otherMonthsMax } = HOME_LIMITS
    const loanErrors = (form.otherLoans ?? []).map((loan) => {
      const rowErrors = {}
      if (!isEmptyValue(loan.balance) && !isInRange(loan.balance, 0, amountMax)) {
        rowErrors.balance = `다른 대출 잔액은 0원 이상 ${formatMoney(amountMax, '원')} 이하로 입력해 주세요`
      }
      if (isEmptyValue(loan.rate)) {
        if (orZero(loan.balance) > 0) rowErrors.rate = '다른 대출 금리를 입력해 주세요'
      } else if (!isInRange(loan.rate, 0, rateMax)) {
        rowErrors.rate = `다른 대출 금리는 0% 이상 ${rateMax}% 이하로 입력해 주세요`
      }
      if (!isEmptyValue(loan.months)) {
        if (!Number.isInteger(loan.months) || !isInRange(loan.months, otherMonthsMin, otherMonthsMax)) {
          rowErrors.months = `다른 대출 남은 기간은 ${otherMonthsMin}개월 이상 ${otherMonthsMax}개월 이하로 입력해 주세요`
        }
      }
      return rowErrors
    })
    if (loanErrors.some((rowErrors) => Object.keys(rowErrors).length > 0)) errors.otherLoans = loanErrors
    // 서버가 받는 다른 대출 1년 이자 합계 한도 (건별 검사를 통과했을 때만)
    else if (getHomeOtherInterest(form) > amountMax) {
      errors.otherInterestTotal = '다른 대출의 1년 이자 합계가 너무 커요. 잔액과 금리를 확인해 주세요.'
    }
  }

  if (isEmptyValue(form.rate)) errors.rate = '대출 금리를 입력해 주세요'
  else if (!isInRange(form.rate, 0, rateMax)) errors.rate = `금리는 0% 이상 ${rateMax}% 이하로 입력해 주세요`

  if (isEmptyValue(form.years)) errors.years = '대출 기간을 입력해 주세요'
  else if (!Number.isInteger(form.years) || !isInRange(form.years, yearsMin, yearsMax)) {
    errors.years = `대출 기간은 ${yearsMin}년 이상 ${yearsMax}년 이하로 입력해 주세요`
  }

  return errors
}

// 매달 갚을 돈으로 빌릴 수 있는 최대 대출금 (원): 상환 계산(calcPayment)의 거꾸로. 상환능력 기반 대출(CA-10)도 이 함수를 쓴다
// 원리금균등: 매달 같은 금액 / 원금균등: monthly는 가장 큰 첫 달 상환액 (원금/기간 + 원금 x 월 금리) / 만기일시: monthly는 매달 내는 이자 (기간과 관계없음)
// 매달 갚을 돈이 0 이하이거나 입력이 이상하면 null (만기일시는 금리 0%도 null: 이자가 없어 빌릴 수 있는 돈이 끝없음)
export function calcMaxLoan(method, monthlyWon, annualRate, months) {
  if (!isNumber(monthlyWon) || monthlyWon <= 0) return null
  if (!isNumber(annualRate) || annualRate < 0 || !Number.isInteger(months) || months <= 0) return null

  const monthlyRate = annualRate / 12 / 100
  let principal
  if (method === 'EQUAL_P') principal = monthlyWon / (1 / months + monthlyRate)
  else if (method === 'BULLET') principal = monthlyRate === 0 ? null : monthlyWon / monthlyRate
  else if (monthlyRate === 0) principal = monthlyWon * months
  else principal = (monthlyWon * (1 - Math.pow(1 + monthlyRate, -months))) / monthlyRate

  return isNumber(principal) ? Math.round(principal) : null
}

// 집 살 때 대출한도 계산 (모두 원 단위): 한도 = 집값 기준(LTV)과 소득 기준(DSR) 중 작은 쪽
// LTV 한도 = 집값 x LTV (생애 첫 집은 지역별 firstLtv), 수도권·규제 지역은 집값 구간별 대출 상한(HOME_PRICE_CAPS)도 넘지 않음 (생애 첫 집만 6억 상한을 두던 규칙은 뺌)
// DSR 한도 = (연소득 x DSR 40% - 다른 대출 1년 상환액)을 12로 나눠 매달 갚을 돈으로 보고, 대출 기간으로 거꾸로 계산 (calcMaxLoan, 원리금균등). 갚을 돈이 없으면 0
//   이때 쓰는 금리 = 입력한 금리 + 금리 유형의 스트레스 금리 (HOME_RATE_TYPES). 다른 대출에는 스트레스 금리를 더하지 않음
//   다른 대출은 '다른 대출이 있어요'(isOtherLoan)를 체크했을 때만 반영
//   다른 대출 1년 상환액 = 건마다 DSR 계산기와 같은 1년 상환액(getDsrLoanYearly: 종류, 상환 방식, 잔액, 금리, 남은 기간(비우면 5년))을 모두 더함 (잔액이 없는 건은 0)
// 결과: { maxLoan, ltvLimit, dsrLimit, ltvRate, dsrRate, priceCap, isPriceCapped, stressRate, limitRate, isLtvLower, firstPayment, ownMoney } / 입력이 이상하거나 계산이 안 되면 null
// priceCap: 집값 구간별 대출 상한 (그 외 지역은 null) / isPriceCapped: 그 상한 때문에 집값 기준 한도가 줄었는지 / limitRate: DSR 한도에 쓴 금리 (소수 둘째 자리까지)
// firstPayment: 최대 대출 한도를 입력한 금리로 빌렸을 때 첫 달 납입액 (대출 이자 계산기와 같은 calcPayment, 한도가 0이면 0) / ownMoney: 집값에서 대출을 뺀 내 돈 (0 이상)
export function getHomeResult(form) {
  const ratios = HOME_RATIOS[form.region]
  const rateType = HOME_RATE_TYPES.find((type) => type.code === form.rateType)
  if (!ratios || !rateType) return null
  // 숫자 칸이 비어 있으면 계산하지 않음 (빈칸 + 스트레스 금리가 글자 이어 붙이기가 되어 멈추던 것 방지, 처음 값이 빈칸이 된 2026-11-26부터)
  if (![form.housePrice, form.annualIncome, form.rate, form.years].every(isNumber)) return null

  const ltvRate = form.isFirstHome ? ratios.firstLtv : ratios.ltv
  const ltvByRatio = Math.round((form.housePrice * ltvRate) / 100)
  const priceCap =
    form.region === 'REGULATED' ? (HOME_PRICE_CAPS.find((cap) => form.housePrice <= cap.maxPrice)?.maxLoan ?? null) : null
  const isPriceCapped = priceCap !== null && ltvByRatio > priceCap
  const ltvLimit = isPriceCapped ? priceCap : ltvByRatio

  const dsrRate = DSR_BASELINES.bank
  let otherYearly = 0
  const otherLoans = form.isOtherLoan ? (form.otherLoans ?? []) : []
  for (const loan of otherLoans) {
    if (orZero(loan.balance) <= 0) continue
    const months = isEmptyValue(loan.months) ? HOME_OTHER_MONTHS : loan.months
    const yearly = getDsrLoanYearly({ kind: loan.kind, method: loan.method, amount: loan.balance, rate: orZero(loan.rate), months })
    if (yearly === null) return null
    otherYearly += yearly
  }
  const limitRate = Number((form.rate + rateType.stressRate).toFixed(2))
  const yearlyRoom = (form.annualIncome * dsrRate) / 100 - otherYearly
  const dsrLimit = yearlyRoom > 0 ? calcMaxLoan('EQUAL_PI', yearlyRoom / 12, limitRate, form.years * 12) : 0

  if (![ltvLimit, dsrLimit].every(isNumber)) return null

  const maxLoan = Math.min(ltvLimit, dsrLimit)
  const plan = maxLoan > 0 ? calcPayment('EQUAL_PI', maxLoan, form.rate, form.years * 12) : null

  return {
    maxLoan,
    ltvLimit,
    dsrLimit,
    ltvRate,
    dsrRate,
    priceCap,
    isPriceCapped,
    stressRate: rateType.stressRate,
    limitRate,
    isLtvLower: ltvLimit <= dsrLimit,
    firstPayment: plan?.monthly ?? 0,
    ownMoney: Math.max(0, form.housePrice - maxLoan),
  }
}

// [결과 저장]으로 보낼 값 (API-59): 화면과 서버가 같은 원 단위라 그대로 보냄
// 다른 대출은 건별 otherLoans (종류, 상환 방식 포함, 잔액이 있는 건만, 입력 순서대로, 남은 기간을 비웠으면 5년)와 모든 건의 1년 이자 합계 otherInterest를 같이 보냄 (체크 안 했으면 [] 와 0)
// 상환 방식은 원리금균등 고정, 금리 유형 rateType 저장, 서버 칸 이름 dtiLimit에는 소득 기준(DSR) 한도를 넣음 / LTV, DSR 비율, 스트레스 금리는 저장하지 않음 (금리 유형으로 다시 정해짐)
export function toHomeRecord(form, result) {
  return {
    housePrice: form.housePrice,
    homeRegion: form.region,
    firstHome: form.isFirstHome ? 'Y' : 'N',
    annualIncome: form.annualIncome,
    otherInterest: getHomeOtherInterest(form),
    interestRate: form.rate,
    loanYears: form.years,
    repayMethod: 'EQUAL_PI',
    rateType: form.rateType,
    otherLoans: form.isOtherLoan
      ? (form.otherLoans ?? [])
          .filter((loan) => orZero(loan.balance) > 0)
          .map((loan) => ({
            loanKind: loan.kind,
            repayMethod: loan.method,
            loanAmount: loan.balance,
            interestRate: orZero(loan.rate),
            loanMonths: isEmptyValue(loan.months) ? HOME_OTHER_MONTHS : loan.months,
          }))
      : [],
    maxLoan: result.maxLoan,
    ltvLimit: result.ltvLimit,
    dtiLimit: result.dsrLimit,
  }
}

// ---------------------------------------------------------------------------
// 상환능력 기반 대출 (CA-10)
// ---------------------------------------------------------------------------

// 입력 한도: 매달 갚을 돈은 원 단위로 1만원 이상 (위쪽은 서버가 받는 한도 9,999,999,999원 안의 99억 9,999만원), 금리 0-20%, 대출 기간 1-600개월 (직접 입력)
export const REVERSE_LIMITS = { amountMin: 10000, amountMax: 9999990000, rateMax: 20, monthsMin: 1, monthsMax: 600 }

// 기간별 표에 보일 기간 (개월): 12, 36, 60, 120, 180 (입력한 기간이 이 안에 없으면 표에 끼워 넣음)
export const REVERSE_TERMS = [...new Set([...MONTHS_OPTIONS_DEFAULT, ...MONTHS_OPTIONS_HOUSING])].sort((a, b) => a - b)

// 바로 열었을 때 처음 값: 숫자 칸은 빈칸, 상환 방식은 원리금균등 (2026-11-26 사용자 결정, [계산하기]를 눌러야 결과가 나옴)
export const REVERSE_DEFAULTS = { method: 'EQUAL_PI', monthly: '', rate: '', months: '' }

const REVERSE_METHOD_CODES = REPAY_METHODS.map((method) => method.code)

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → 상환능력 입력칸 처음 값 (CA-01)
// state: { repayMethod, monthlyPayment 원, interestRate, loanMonths }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 그대로, 기간은 1-600 정수)
export function getInitialReverse(state) {
  const form = { ...REVERSE_DEFAULTS }
  const { amountMin, amountMax, rateMax, monthsMin, monthsMax } = REVERSE_LIMITS

  if (REVERSE_METHOD_CODES.includes(state?.repayMethod)) form.method = state.repayMethod

  if (isInRange(state?.monthlyPayment, amountMin, amountMax)) form.monthly = Math.round(state.monthlyPayment)

  if (isInRange(state?.interestRate, 0, rateMax)) form.rate = state.interestRate
  if (Number.isInteger(state?.loanMonths) && isInRange(state.loanMonths, monthsMin, monthsMax)) form.months = state.loanMonths

  return form
}

// 상환능력 입력 검사 (E2): 칸 이름별 오류 문구, 오류가 없으면 빈 객체 = 계산할 수 있음
// 만기일시는 금리가 0%이면 이자가 없어 빌릴 수 있는 돈을 정할 수 없으므로 0%보다 커야 한다
export function getReverseErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax, monthsMin, monthsMax } = REVERSE_LIMITS

  if (isEmptyValue(form.monthly)) errors.monthly = '매달 갚을 돈을 입력해 주세요'
  else if (!isInRange(form.monthly, amountMin, amountMax)) {
    errors.monthly = `매달 갚을 돈은 ${formatMoney(amountMin, '원')} 이상 ${formatMoney(amountMax, '원')} 이하로 입력해 주세요`
  }

  if (isEmptyValue(form.rate)) errors.rate = '연 이자율을 입력해 주세요'
  else if (!isInRange(form.rate, 0, rateMax)) errors.rate = `연 이자율은 0% 이상 ${rateMax}% 이하로 입력해 주세요`
  else if (form.method === 'BULLET' && form.rate === 0) errors.rate = '만기일시는 연 이자율이 0%보다 커야 계산할 수 있어요'

  if (isEmptyValue(form.months)) errors.months = '대출 기간을 입력해 주세요'
  else if (!Number.isInteger(form.months) || !isInRange(form.months, monthsMin, monthsMax)) {
    errors.months = `대출 기간은 ${monthsMin}개월 이상 ${monthsMax}개월 이하로 입력해 주세요`
  }

  return errors
}

// 상환능력 기반 대출 계산 (모두 원 단위): 매달 갚을 돈으로 빌릴 수 있는 최대 대출 금액을 거꾸로 계산 (calcMaxLoan)
// 그 금액을 빌렸을 때 총이자는 대출 이자 계산기와 같은 함수(calcPayment)로 계산
// 결과: { maxLoan, totalInterest, totalPayment, byTerm: [{ months, maxLoan }] (기간별 빌릴 수 있는 금액, 입력한 기간 포함해 짧은 순) } / 입력이 이상하거나 계산이 안 되면 null
export function getReverseResult(form) {
  const monthlyWon = form.monthly
  const maxLoan = calcMaxLoan(form.method, monthlyWon, form.rate, form.months)
  if (maxLoan === null) return null

  const plan = calcPayment(form.method, maxLoan, form.rate, form.months)
  const terms = [...new Set([...REVERSE_TERMS, form.months])].sort((a, b) => a - b)
  const byTerm = terms.map((months) => ({ months, maxLoan: calcMaxLoan(form.method, monthlyWon, form.rate, months) }))
  if (!plan || byTerm.some((term) => term.maxLoan === null)) return null

  return { maxLoan, totalInterest: plan.totalInterest, totalPayment: maxLoan + plan.totalInterest, byTerm }
}

// [결과 저장]으로 보낼 값 (API-58): 화면과 서버가 같은 원 단위라 그대로 보냄. 기간별 표는 저장하지 않음
export function toReverseRecord(form, result) {
  return {
    repayMethod: form.method,
    monthlyPayment: form.monthly,
    interestRate: form.rate,
    loanMonths: form.months,
    maxLoan: result.maxLoan,
  }
}

// [대출 이자 계산기로 이동]이 넘길 navigate state (CA-01 이름): 최대 대출 금액, 기간, 금리, 상환 방식
// 대출 이자 계산기는 금액 위쪽 한도(10억원)를 넘으면 그 칸을 무시하므로, 넘으면 한도 금액으로 넘긴다
export function toLoanCalcState(form, result) {
  return {
    loanAmount: Math.min(result.maxLoan, CALC_LIMITS.amountMax),
    loanMonths: form.months,
    interestRate: form.rate,
    repayMethod: form.method,
  }
}

// ---------------------------------------------------------------------------
// DSR (CA-09)
// ---------------------------------------------------------------------------

// 입력 한도: 금리 0-20%, 기간 1-600개월 (명세서). 금액은 원 단위로 1만원 이상, 위쪽은 서버가 받는 한도(9,999,999,999원) 안의 99억 9,999만원
export const DSR_LIMITS = { amountMin: 10000, amountMax: 9999990000, rateMax: 20, monthsMin: 1, monthsMax: 600 }

// 대출은 1건부터 최대 10건 (사용자 결정, API-57 loans 1-10건)
export const DSR_MAX_LOANS = 10

// 대출 종류 (코드는 API-57 loanKind)
export const DSR_KINDS = [
  { code: 'CREDIT', label: '신용대출' },
  { code: 'MORTGAGE', label: '주택담보대출' },
  { code: 'OTHER', label: '기타' },
]

// 기준선 비율(%): 은행 40%, 2금융권 50% (명세서 비고의 예시 값, 실제 값은 담당자가 개발 때 정함)
export const DSR_BASELINES = { bank: 40, second: 50 }

// 만기일시 신용대출은 원금을 5년(60개월)에 나눠 갚는다고 봄 (명세서)
const DSR_CREDIT_BULLET_MONTHS = 60

// 대출 한 줄의 처음 값 (처음 한 줄과 [+ 대출 추가]): 종류 신용대출, 원리금균등, 숫자 칸은 빈칸 (2026-11-26 사용자 결정)
export const DSR_LOAN_DEFAULT = { kind: 'CREDIT', method: 'EQUAL_PI', amount: '', rate: '', months: '' }

// 바로 열었을 때 처음 값: 연소득 빈칸, 빈 대출 1건 ([계산하기]를 눌러야 결과가 나옴)
export const DSR_DEFAULTS = {
  annualIncome: '',
  loans: [{ ...DSR_LOAN_DEFAULT }],
}

const DSR_KIND_CODES = DSR_KINDS.map((kind) => kind.code)

// 넘어온 대출 한 줄 → 대출 입력 한 줄. 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 대출 한 줄의 처음 값
function getInitialDsrLoan(item) {
  const loan = { ...DSR_LOAN_DEFAULT }
  const { amountMin, amountMax, rateMax, monthsMin, monthsMax } = DSR_LIMITS

  if (DSR_KIND_CODES.includes(item?.loanKind)) loan.kind = item.loanKind
  if (REPAY_METHODS.some((method) => method.code === item?.repayMethod)) loan.method = item.repayMethod

  if (isInRange(item?.loanAmount, amountMin, amountMax)) loan.amount = Math.round(item.loanAmount)

  if (isInRange(item?.interestRate, 0, rateMax)) loan.rate = item.interestRate
  if (Number.isInteger(item?.loanMonths) && isInRange(item.loanMonths, monthsMin, monthsMax)) {
    loan.months = item.loanMonths
  }

  return loan
}

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → DSR 입력칸 처음 값 (CA-01)
// state: { annualIncome 원, loans: [{ loanKind, repayMethod, loanAmount 원, interestRate, loanMonths }] }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 그대로). 대출 목록이 없거나 비면 기본 대출 1건, 10건을 넘으면 앞의 10건만
export function getInitialDsr(state) {
  const { amountMin, amountMax } = DSR_LIMITS
  const form = { annualIncome: DSR_DEFAULTS.annualIncome, loans: DSR_DEFAULTS.loans.map((loan) => ({ ...loan })) }

  if (isInRange(state?.annualIncome, amountMin, amountMax)) form.annualIncome = Math.round(state.annualIncome)

  if (Array.isArray(state?.loans) && state.loans.length > 0) {
    form.loans = state.loans.slice(0, DSR_MAX_LOANS).map(getInitialDsrLoan)
  }

  return form
}

// DSR 입력 검사 (E2): 칸 이름별 오류 문구, 오류가 없으면 빈 객체 = 계산할 수 있음
// 대출 칸의 오류는 errors.loans[줄 번호] = { amount, rate, months } (오류 없는 줄은 {}), 대출 건수 오류는 errors.loanCount
export function getDsrErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax, monthsMin, monthsMax } = DSR_LIMITS
  const amountText = `${formatMoney(amountMin, '원')} 이상 ${formatMoney(amountMax, '원')} 이하`

  if (isEmptyValue(form.annualIncome)) errors.annualIncome = '연소득을 입력해 주세요'
  else if (!isInRange(form.annualIncome, amountMin, amountMax)) errors.annualIncome = `연소득은 ${amountText}로 입력해 주세요`

  if (form.loans.length < 1) errors.loanCount = '대출을 1건 이상 입력해 주세요'
  else if (form.loans.length > DSR_MAX_LOANS) errors.loanCount = `대출은 최대 ${DSR_MAX_LOANS}건까지 입력할 수 있어요`

  const loanErrors = form.loans.map((loan) => {
    const rowErrors = {}
    if (isEmptyValue(loan.amount)) rowErrors.amount = '대출금을 입력해 주세요'
    else if (!isInRange(loan.amount, amountMin, amountMax)) rowErrors.amount = `대출금은 ${amountText}로 입력해 주세요`

    if (isEmptyValue(loan.rate)) rowErrors.rate = '금리를 입력해 주세요'
    else if (!isInRange(loan.rate, 0, rateMax)) rowErrors.rate = `금리는 0% 이상 ${rateMax}% 이하로 입력해 주세요`

    if (isEmptyValue(loan.months)) rowErrors.months = '기간을 입력해 주세요'
    else if (!Number.isInteger(loan.months) || !isInRange(loan.months, monthsMin, monthsMax)) {
      rowErrors.months = `기간은 ${monthsMin}개월 이상 ${monthsMax}개월 이하로 입력해 주세요`
    }
    return rowErrors
  })
  if (loanErrors.some((rowErrors) => Object.keys(rowErrors).length > 0)) errors.loans = loanErrors

  return errors
}

// 앞으로 1년 동안 갚는 원금 + 이자 (원금균등 방식): 원금을 기간으로 나눠 갚고, 이자는 남은 원금에 붙음. 기간이 1년보다 짧으면 그 기간만
function getYearlyEqualPrincipal(principal, annualRate, months) {
  const count = Math.min(12, months)
  const monthlyRate = annualRate / 12 / 100
  return (principal * count) / months + principal * monthlyRate * (count - (count * (count - 1)) / 2 / months)
}

// 대출 한 건의 1년 상환액 (원). 계산이 안 되는 입력이면 null
// 원리금균등: 월 상환액 x 12 (기간이 짧으면 그 개월 수) / 원금균등: 첫 1년의 원금 + 이자 합
// 만기일시: 원금을 대출 기간(신용대출은 5년)에 나눠 갚는다고 보고 원금균등과 같게 계산 (명세서)
function getDsrLoanYearly(loan) {
  const principal = loan.amount
  if (!isNumber(principal) || principal <= 0 || !isNumber(loan.rate) || loan.rate < 0) return null
  if (!Number.isInteger(loan.months) || loan.months <= 0) return null

  let yearly
  if (loan.method === 'BULLET') {
    const months = loan.kind === 'CREDIT' ? DSR_CREDIT_BULLET_MONTHS : loan.months
    yearly = getYearlyEqualPrincipal(principal, loan.rate, months)
  } else if (loan.method === 'EQUAL_P') {
    yearly = getYearlyEqualPrincipal(principal, loan.rate, loan.months)
  } else {
    const plan = calcPayment('EQUAL_PI', principal, loan.rate, loan.months)
    yearly = plan ? plan.monthly * Math.min(12, loan.months) : null
  }
  return isNumber(yearly) ? Math.round(yearly) : null
}

// DSR 계산 (금액은 원): DSR = 대출별 1년 원금 + 이자 합 / 연소득 (소수 둘째 자리 %)
// 40% 이하 GOOD (좋음), 50% 이하 WARN (주의), 넘으면 BAD (위험) / extraRoom = 40%까지 더 갚을 수 있는 1년 상환액 (이미 넘었으면 0)
// 결과: { dsrRate, yearlyPayment, level, extraRoom, loanPayments (대출별 1년 상환액, 입력 순서대로) } / 입력이 이상하거나 계산이 안 되면 null
export function getDsrResult(form) {
  const income = form.annualIncome
  if (!isNumber(income) || income <= 0 || !Array.isArray(form.loans) || form.loans.length === 0) return null

  const loanPayments = form.loans.map(getDsrLoanYearly)
  if (loanPayments.some((payment) => payment === null)) return null

  const yearlyPayment = loanPayments.reduce((sum, payment) => sum + payment, 0)
  const dsrRate = Math.round((yearlyPayment * 10000) / income) / 100
  let level = 'BAD'
  if (dsrRate <= DSR_BASELINES.bank) level = 'GOOD'
  else if (dsrRate <= DSR_BASELINES.second) level = 'WARN'
  const extraRoom = Math.max(0, Math.round((income * DSR_BASELINES.bank) / 100) - yearlyPayment)

  return { dsrRate, yearlyPayment, level, extraRoom, loanPayments }
}

// [결과 저장]으로 보낼 값 (API-57): 화면과 서버가 같은 원 단위라 그대로 보냄. 대출은 입력한 건수만큼 입력 순서대로
// 화면에서 줄을 구별하려고 붙인 id 같은 값은 보내지 않음
export function toDsrRecord(form, result) {
  return {
    annualIncome: form.annualIncome,
    dsrRate: result.dsrRate,
    yearlyPayment: result.yearlyPayment,
    loans: form.loans.map((loan) => ({
      loanKind: loan.kind,
      repayMethod: loan.method,
      loanAmount: loan.amount,
      interestRate: loan.rate,
      loanMonths: loan.months,
    })),
  }
}
