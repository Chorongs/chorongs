import { MONTHS_OPTIONS_DEFAULT, MONTHS_OPTIONS_HOUSING } from '../constants/options'
import { CALC_LIMITS, REPAY_METHODS, calcPayment, isNumber } from './loanMath'
import { formatNumber } from './format'

// 대출 갈아타기, DSR, 내 집 대출한도, 상환능력 기반 대출 계산 (화면 없는 계산, CHORONG-56)
// 갈아타기(CA-08), 내 집 대출한도(CA-11), 상환능력 기반 대출(CA-10), DSR(CA-09) 계산이 계산기마다 한 구역씩 있다.

const isEmptyValue = (value) => value === '' || value === null || value === undefined
const orZero = (value) => (isEmptyValue(value) ? 0 : value)
const isInRange = (value, min, max) => isNumber(value) && value >= min && value <= max

// ---------------------------------------------------------------------------
// 대출 갈아타기 (CA-08)
// ---------------------------------------------------------------------------

// 갈아타기 입력 한도: 기간 1-600개월, 금리 0-20%, 수수료 0-5% (명세서). 금액은 대출 이자 계산기와 같은 1만-100,000만원 (위쪽 한도는 명세서에 없어 정한 값)
export const CHANGE_LIMITS = { ...CALC_LIMITS, monthsMin: 1, monthsMax: 600 }

// 바로 열었을 때 처음 값 (명세서에 없어 정한 값). 금액은 만원, 기간은 개월, 금리와 수수료는 %
export const CHANGE_DEFAULTS = {
  currentMethod: 'EQUAL_PI',
  balance: 5000,
  currentRate: 5.5,
  currentMonths: 36,
  newMethod: 'EQUAL_PI',
  newRate: 4.5,
  newMonths: 36,
  feeRate: 1,
  etcCost: 0,
}

const CHANGE_METHOD_CODES = REPAY_METHODS.map((method) => method.code)

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → 갈아타기 입력칸 처음 값 (CA-01)
// state: { currentRepayMethod, currentBalance 원, currentRate, currentMonths, newRepayMethod, newRate, newMonths, feeRate, etcCost 원 }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 → 만원)
export function getInitialChange(state) {
  const form = { ...CHANGE_DEFAULTS }
  const { amountMin, amountMax, rateMax, feeMax, monthsMin, monthsMax } = CHANGE_LIMITS

  if (CHANGE_METHOD_CODES.includes(state?.currentRepayMethod)) form.currentMethod = state.currentRepayMethod
  if (CHANGE_METHOD_CODES.includes(state?.newRepayMethod)) form.newMethod = state.newRepayMethod

  const balance = isNumber(state?.currentBalance) ? Math.round(state.currentBalance / 10000) : null
  if (isInRange(balance, amountMin, amountMax)) form.balance = balance

  const etcCost = isNumber(state?.etcCost) ? Math.round(state.etcCost / 10000) : null
  if (isInRange(etcCost, 0, amountMax)) form.etcCost = etcCost

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
  const amountText = `${amountMin}만원 이상 ${formatNumber(amountMax)}만원 이하`

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
    errors.etcCost = `기타 비용은 0만원 이상 ${formatNumber(amountMax)}만원 이하로 입력해 주세요`
  }

  return errors
}

// 갈아타기 계산: 남은 대출금 전체를 새 대출로 갈아탄다고 보고, 두 대출의 총이자를 대출 이자 계산기와 같은 함수(calcPayment)로 계산
// 아끼는 돈 = 지금 대출 총이자 - 새 대출 총이자 - 중도상환수수료 (남은 대출금 x 수수료율) - 기타 비용 (0 이상이면 갈아타는 게 이득)
// 결과 (모두 원 단위): { savingAmount (더 내면 음수), isGain, currentInterest, newInterest, currentFirstPayment, newFirstPayment, prepayFee, etcCost }
// 입력이 이상하거나 계산이 안 되면 null
export function getChangeResult(form) {
  const balance = form.balance * 10000
  const current = calcPayment(form.currentMethod, balance, form.currentRate, form.currentMonths)
  const next = calcPayment(form.newMethod, balance, form.newRate, form.newMonths)
  if (!current || !next) return null

  const prepayFee = Math.round((balance * orZero(form.feeRate)) / 100)
  const etcCost = orZero(form.etcCost) * 10000
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

// [결과 저장]으로 보낼 값 (API-56): 입력은 원 단위로 바꿔 보냄 (화면은 만원, 서버는 원). 수수료율, 기타 비용의 빈 칸은 0
export function toChangeRecord(form, result) {
  return {
    currentRepayMethod: form.currentMethod,
    currentBalance: form.balance * 10000,
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

// 입력 한도: 금리 0-20%, 기간 1-50년 (명세서). 금액은 1만원 이상, 위쪽은 서버가 받는 한도(9,999,999,999원)에 맞춘 999,999만원
export const HOME_LIMITS = { amountMin: 1, amountMax: 999999, rateMax: 20, yearsMin: 1, yearsMax: 50 }

// 집이 있는 곳 (코드는 API-59 homeRegion)
export const HOME_REGIONS = [
  { code: 'OTHER', label: '그 외 지역' },
  { code: 'REGULATED', label: '규제 지역' },
]

// 상환 방식은 원리금균등, 원금균등만 (만기일시는 주택담보대출 한도 계산에 쓰지 않음)
export const HOME_METHODS = REPAY_METHODS.filter((method) => method.code !== 'BULLET')

// 지역별 LTV, DTI 비율(%)과 생애 첫 집 기준 (명세서 비고의 예시 값, 실제 값은 담당자가 개발 때 정함)
export const HOME_RATIOS = {
  OTHER: { ltv: 70, dti: 60 },
  REGULATED: { ltv: 50, dti: 40 },
}
// 생애 첫 집: LTV 80% (지역과 관계없이), 집값 기준 한도는 최대 6억원 (만원 단위)
export const HOME_FIRST = { ltv: 80, maxLoanMan: 60000 }

// 바로 열었을 때 처음 값 (명세서에 없어 정한 값). 금액은 만원, 기간은 년, 금리는 %
export const HOME_DEFAULTS = {
  housePrice: 50000,
  region: 'OTHER',
  isFirstHome: false,
  annualIncome: 6000,
  otherInterest: 0,
  rate: 4.5,
  years: 30,
  method: 'EQUAL_PI',
}

const HOME_REGION_CODES = HOME_REGIONS.map((region) => region.code)
const HOME_METHOD_CODES = HOME_METHODS.map((method) => method.code)

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → 내 집 계산기 입력칸 처음 값 (CA-01)
// state: { housePrice 원, homeRegion, firstHome (Y, N), annualIncome 원, otherInterest 원, interestRate, loanYears, repayMethod }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 → 만원)
export function getInitialHome(state) {
  const form = { ...HOME_DEFAULTS }
  const { amountMin, amountMax, rateMax, yearsMin, yearsMax } = HOME_LIMITS

  if (HOME_REGION_CODES.includes(state?.homeRegion)) form.region = state.homeRegion
  if (HOME_METHOD_CODES.includes(state?.repayMethod)) form.method = state.repayMethod
  if (state?.firstHome === 'Y') form.isFirstHome = true
  if (state?.firstHome === 'N') form.isFirstHome = false

  const housePrice = isNumber(state?.housePrice) ? Math.round(state.housePrice / 10000) : null
  if (isInRange(housePrice, amountMin, amountMax)) form.housePrice = housePrice

  const annualIncome = isNumber(state?.annualIncome) ? Math.round(state.annualIncome / 10000) : null
  if (isInRange(annualIncome, amountMin, amountMax)) form.annualIncome = annualIncome

  const otherInterest = isNumber(state?.otherInterest) ? Math.round(state.otherInterest / 10000) : null
  if (isInRange(otherInterest, 0, amountMax)) form.otherInterest = otherInterest

  if (isInRange(state?.interestRate, 0, rateMax)) form.rate = state.interestRate
  if (Number.isInteger(state?.loanYears) && isInRange(state.loanYears, yearsMin, yearsMax)) {
    form.years = state.loanYears
  }

  return form
}

// 내 집 계산 입력 검사 (E2): 칸 이름별 오류 문구, 오류가 없으면 빈 객체 = 계산할 수 있음
// 다른 대출 1년 이자는 비워 두면 0으로 본다
export function getHomeErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax, yearsMin, yearsMax } = HOME_LIMITS
  const amountText = `${amountMin}만원 이상 ${formatNumber(amountMax)}만원 이하`

  if (isEmptyValue(form.housePrice)) errors.housePrice = '집값을 입력해 주세요'
  else if (!isInRange(form.housePrice, amountMin, amountMax)) errors.housePrice = `집값은 ${amountText}로 입력해 주세요`

  if (isEmptyValue(form.annualIncome)) errors.annualIncome = '연소득을 입력해 주세요'
  else if (!isInRange(form.annualIncome, amountMin, amountMax)) errors.annualIncome = `연소득은 ${amountText}로 입력해 주세요`

  if (!isEmptyValue(form.otherInterest) && !isInRange(form.otherInterest, 0, amountMax)) {
    errors.otherInterest = `다른 대출 1년 이자는 0만원 이상 ${formatNumber(amountMax)}만원 이하로 입력해 주세요`
  }

  if (isEmptyValue(form.rate)) errors.rate = '주택담보대출 금리를 입력해 주세요'
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

// 내 집 대출한도 계산 (모두 원 단위): 한도 = 집값 기준(LTV)과 소득 기준(DTI) 중 작은 쪽
// LTV 한도 = 집값 x LTV (생애 첫 집은 LTV 80%, 최대 6억원)
// DTI 한도 = (연소득 x DTI - 다른 대출 1년 이자)를 12로 나눠 매달 갚을 돈으로 보고, 대출 기간으로 거꾸로 계산 (calcMaxLoan). 갚을 돈이 없으면 0
// 결과: { maxLoan, ltvLimit, dtiLimit, ltvRate, dtiRate, isLtvLower } / 입력이 이상하거나 계산이 안 되면 null
export function getHomeResult(form) {
  const ratios = HOME_RATIOS[form.region]
  if (!ratios) return null

  const ltvRate = form.isFirstHome ? HOME_FIRST.ltv : ratios.ltv
  const ltvRaw = Math.round((form.housePrice * 10000 * ltvRate) / 100)
  const ltvLimit = form.isFirstHome ? Math.min(ltvRaw, HOME_FIRST.maxLoanMan * 10000) : ltvRaw

  const yearlyRoom = (form.annualIncome * 10000 * ratios.dti) / 100 - orZero(form.otherInterest) * 10000
  const dtiLimit = yearlyRoom > 0 ? calcMaxLoan(form.method, yearlyRoom / 12, form.rate, form.years * 12) : 0

  if (![ltvLimit, dtiLimit].every(isNumber)) return null

  return {
    maxLoan: Math.min(ltvLimit, dtiLimit),
    ltvLimit,
    dtiLimit,
    ltvRate,
    dtiRate: ratios.dti,
    isLtvLower: ltvLimit <= dtiLimit,
  }
}

// [결과 저장]으로 보낼 값 (API-59): 입력은 원 단위로 바꿔 보냄 (화면은 만원, 서버는 원). 다른 대출 1년 이자의 빈 칸은 0
// LTV, DTI 비율은 저장하지 않음
export function toHomeRecord(form, result) {
  return {
    housePrice: form.housePrice * 10000,
    homeRegion: form.region,
    firstHome: form.isFirstHome ? 'Y' : 'N',
    annualIncome: form.annualIncome * 10000,
    otherInterest: orZero(form.otherInterest) * 10000,
    interestRate: form.rate,
    loanYears: form.years,
    repayMethod: form.method,
    maxLoan: result.maxLoan,
    ltvLimit: result.ltvLimit,
    dtiLimit: result.dtiLimit,
  }
}

// ---------------------------------------------------------------------------
// 상환능력 기반 대출 (CA-10)
// ---------------------------------------------------------------------------

// 입력 한도: 매달 갚을 돈 1만원 이상 (위쪽은 서버가 받는 한도 9,999,999,999원에 맞춘 999,999만원), 금리 0-20%
export const REVERSE_LIMITS = { amountMin: 1, amountMax: 999999, rateMax: 20 }

// 대출 기간 선택지 (개월): 대출 이자 계산기 기간 칩과 같은 12, 36, 60, 120, 180 (넘어가는 기간을 그 계산기가 받을 수 있게), 기간별 표도 이 기간들
export const REVERSE_TERMS = [...new Set([...MONTHS_OPTIONS_DEFAULT, ...MONTHS_OPTIONS_HOUSING])].sort((a, b) => a - b)

// 바로 열었을 때 처음 값 (명세서에 없어 정한 값). 금액은 만원, 기간은 개월, 금리는 %
export const REVERSE_DEFAULTS = { method: 'EQUAL_PI', monthly: 100, rate: 5, months: 36 }

const REVERSE_METHOD_CODES = REPAY_METHODS.map((method) => method.code)

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → 상환능력 입력칸 처음 값 (CA-01)
// state: { repayMethod, monthlyPayment 원, interestRate, loanMonths }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 → 만원, 기간은 기간 칩에 있는 값만)
export function getInitialReverse(state) {
  const form = { ...REVERSE_DEFAULTS }
  const { amountMin, amountMax, rateMax } = REVERSE_LIMITS

  if (REVERSE_METHOD_CODES.includes(state?.repayMethod)) form.method = state.repayMethod

  const monthly = isNumber(state?.monthlyPayment) ? Math.round(state.monthlyPayment / 10000) : null
  if (isInRange(monthly, amountMin, amountMax)) form.monthly = monthly

  if (isInRange(state?.interestRate, 0, rateMax)) form.rate = state.interestRate
  if (REVERSE_TERMS.includes(state?.loanMonths)) form.months = state.loanMonths

  return form
}

// 상환능력 입력 검사 (E2): 칸 이름별 오류 문구, 오류가 없으면 빈 객체 = 계산할 수 있음
// 만기일시는 금리가 0%이면 이자가 없어 빌릴 수 있는 돈을 정할 수 없으므로 0%보다 커야 한다
export function getReverseErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax } = REVERSE_LIMITS

  if (isEmptyValue(form.monthly)) errors.monthly = '매달 갚을 돈을 입력해 주세요'
  else if (!isInRange(form.monthly, amountMin, amountMax)) {
    errors.monthly = `매달 갚을 돈은 ${amountMin}만원 이상 ${formatNumber(amountMax)}만원 이하로 입력해 주세요`
  }

  if (isEmptyValue(form.rate)) errors.rate = '연 이자율을 입력해 주세요'
  else if (!isInRange(form.rate, 0, rateMax)) errors.rate = `연 이자율은 0% 이상 ${rateMax}% 이하로 입력해 주세요`
  else if (form.method === 'BULLET' && form.rate === 0) errors.rate = '만기일시는 연 이자율이 0%보다 커야 계산할 수 있어요'

  if (!REVERSE_TERMS.includes(form.months)) errors.months = '대출 기간을 골라 주세요'

  return errors
}

// 상환능력 기반 대출 계산 (모두 원 단위): 매달 갚을 돈으로 빌릴 수 있는 최대 대출 금액을 거꾸로 계산 (calcMaxLoan)
// 그 금액을 빌렸을 때 총이자는 대출 이자 계산기와 같은 함수(calcPayment)로 계산
// 결과: { maxLoan, totalInterest, totalPayment, byTerm: [{ months, maxLoan }] (기간별 빌릴 수 있는 금액) } / 입력이 이상하거나 계산이 안 되면 null
export function getReverseResult(form) {
  const monthlyWon = form.monthly * 10000
  const maxLoan = calcMaxLoan(form.method, monthlyWon, form.rate, form.months)
  if (maxLoan === null) return null

  const plan = calcPayment(form.method, maxLoan, form.rate, form.months)
  const byTerm = REVERSE_TERMS.map((months) => ({ months, maxLoan: calcMaxLoan(form.method, monthlyWon, form.rate, months) }))
  if (!plan || byTerm.some((term) => term.maxLoan === null)) return null

  return { maxLoan, totalInterest: plan.totalInterest, totalPayment: maxLoan + plan.totalInterest, byTerm }
}

// [결과 저장]으로 보낼 값 (API-58): 입력은 원 단위로 바꿔 보냄 (화면은 만원, 서버는 원). 기간별 표는 저장하지 않음
export function toReverseRecord(form, result) {
  return {
    repayMethod: form.method,
    monthlyPayment: form.monthly * 10000,
    interestRate: form.rate,
    loanMonths: form.months,
    maxLoan: result.maxLoan,
  }
}

// [대출 이자 계산기로 이동]이 넘길 navigate state (CA-01 이름): 최대 대출 금액, 기간, 금리, 상환 방식
// 대출 이자 계산기는 금액 위쪽 한도(10억원)를 넘으면 그 칸을 무시하므로, 넘으면 한도 금액으로 넘긴다
export function toLoanCalcState(form, result) {
  return {
    loanAmount: Math.min(result.maxLoan, CALC_LIMITS.amountMax * 10000),
    loanMonths: form.months,
    interestRate: form.rate,
    repayMethod: form.method,
  }
}

// ---------------------------------------------------------------------------
// DSR (CA-09)
// ---------------------------------------------------------------------------

// 입력 한도: 금리 0-20%, 기간 1-600개월 (명세서). 금액은 1만원 이상, 위쪽은 서버가 받는 한도(9,999,999,999원)에 맞춘 999,999만원
export const DSR_LIMITS = { amountMin: 1, amountMax: 999999, rateMax: 20, monthsMin: 1, monthsMax: 600 }

// 대출은 1건부터 최대 10건 (사용자 결정, API-57 loans 1-10건)
export const DSR_MAX_LOANS = 10

// 대출 종류 (코드는 API-57 loanKind)
export const DSR_KINDS = [
  { code: 'CREDIT', label: '신용대출' },
  { code: 'MORTGAGE', label: '주택담보대출' },
  { code: 'OTHER', label: '그 밖' },
]

// 기준선 비율(%): 은행 40%, 2금융권 50% (명세서 비고의 예시 값, 실제 값은 담당자가 개발 때 정함)
export const DSR_BASELINES = { bank: 40, second: 50 }

// 만기일시 신용대출은 원금을 5년(60개월)에 나눠 갚는다고 봄 (명세서)
const DSR_CREDIT_BULLET_MONTHS = 60

// [+ 대출 추가]로 새로 생기는 대출 한 줄의 처음 값 (명세서에 없어 정한 값). 금액은 만원, 기간은 개월, 금리는 %
export const DSR_LOAN_DEFAULT = { kind: 'CREDIT', method: 'EQUAL_PI', amount: 1000, rate: 6, months: 36 }

// 바로 열었을 때 처음 값 (명세서에 없어 정한 값): 연소득 5,000만원, 대출 1건 (주택담보대출 2억원)
export const DSR_DEFAULTS = {
  annualIncome: 5000,
  loans: [{ kind: 'MORTGAGE', method: 'EQUAL_PI', amount: 20000, rate: 4.5, months: 360 }],
}

const DSR_KIND_CODES = DSR_KINDS.map((kind) => kind.code)

// 넘어온 대출 한 줄 → 대출 입력 한 줄. 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 대출 한 줄의 처음 값
function getInitialDsrLoan(item) {
  const loan = { ...DSR_LOAN_DEFAULT }
  const { amountMin, amountMax, rateMax, monthsMin, monthsMax } = DSR_LIMITS

  if (DSR_KIND_CODES.includes(item?.loanKind)) loan.kind = item.loanKind
  if (REPAY_METHODS.some((method) => method.code === item?.repayMethod)) loan.method = item.repayMethod

  const amount = isNumber(item?.loanAmount) ? Math.round(item.loanAmount / 10000) : null
  if (isInRange(amount, amountMin, amountMax)) loan.amount = amount

  if (isInRange(item?.interestRate, 0, rateMax)) loan.rate = item.interestRate
  if (Number.isInteger(item?.loanMonths) && isInRange(item.loanMonths, monthsMin, monthsMax)) {
    loan.months = item.loanMonths
  }

  return loan
}

// 다른 화면(MY 계산 기록 [불러오기])이 navigate state로 넘긴 값 → DSR 입력칸 처음 값 (CA-01)
// state: { annualIncome 원, loans: [{ loanKind, repayMethod, loanAmount 원, interestRate, loanMonths }] }
// 칸마다 따로 검사해서 범위 밖이거나 이상한 값은 그 칸만 무시하고 기본값 (금액은 원 → 만원). 대출 목록이 없거나 비면 기본 대출 1건, 10건을 넘으면 앞의 10건만
export function getInitialDsr(state) {
  const { amountMin, amountMax } = DSR_LIMITS
  const form = { annualIncome: DSR_DEFAULTS.annualIncome, loans: DSR_DEFAULTS.loans.map((loan) => ({ ...loan })) }

  const annualIncome = isNumber(state?.annualIncome) ? Math.round(state.annualIncome / 10000) : null
  if (isInRange(annualIncome, amountMin, amountMax)) form.annualIncome = annualIncome

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
  const amountText = `${amountMin}만원 이상 ${formatNumber(amountMax)}만원 이하`

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
  const principal = loan.amount * 10000
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
  const income = form.annualIncome * 10000
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

// [결과 저장]으로 보낼 값 (API-57): 입력은 원 단위로 바꿔 보냄 (화면은 만원, 서버는 원). 대출은 입력한 건수만큼 입력 순서대로
// 화면에서 줄을 구별하려고 붙인 id 같은 값은 보내지 않음
export function toDsrRecord(form, result) {
  return {
    annualIncome: form.annualIncome * 10000,
    dsrRate: result.dsrRate,
    yearlyPayment: result.yearlyPayment,
    loans: form.loans.map((loan) => ({
      loanKind: loan.kind,
      repayMethod: loan.method,
      loanAmount: loan.amount * 10000,
      interestRate: loan.rate,
      loanMonths: loan.months,
    })),
  }
}
