import { MONTHS_OPTIONS_DEFAULT, MONTHS_OPTIONS_HOUSING, REPAY_METHOD_CODE } from '../constants/options'
import { formatMoney } from './format'

// 대출 계산 함수 (화면 없는 계산)
// 위쪽은 비교 화면(CP-02, 03, 05)이 쓰는 상환 방식별(원리금균등, 원금균등, 만기일시) 계산과 유리 판정,
// 맨 아래는 계산기(CA-02~06, CHORONG-49)가 쓰는 상환 스케줄(4개 방식, 거치, 중도상환, 금리 변동)과 입력 검사.

export const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

// 금리 중간값: 최저, 최고가 둘 다 있으면 평균(소수 둘째 자리), 하나만 있으면 그 값, 없으면 null
export function getMidRate(min, max) {
  const rates = [min, max].filter(isNumber)
  if (rates.length === 0) return null
  const mid = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  return Number(mid.toFixed(2))
}

// 상품의 상환 방식 코드: 상환 방식 태그의 첫 값 (원리금균등 EQUAL_PI, 원금균등 EQUAL_P, 만기일시 BULLET), 없거나 그 밖이면 EQUAL_PI
// 상세 창 [이자 계산]이 계산기로 넘기는 코드와 같은 규칙 (CM-07)
export function getRepayCode(product) {
  const first = (product?.tags ?? []).find((tag) => tag.tagType === 'REPAY')?.tagValue
  return REPAY_METHOD_CODE[first] ?? 'EQUAL_PI'
}

// 상환 방식 코드와 화면 글 (칩 순서: 원리금균등 → 원금균등 → 만기일시)
export const REPAY_METHODS = [
  { code: 'EQUAL_PI', label: '원리금균등' },
  { code: 'EQUAL_P', label: '원금균등' },
  { code: 'BULLET', label: '만기일시' },
]
const METHOD_ORDER = REPAY_METHODS.map((method) => method.code)

// 상품이 지원하는 상환 방식 코드 목록 (칩 순서). 상환 방식 태그에서 원리금균등, 원금균등, 만기일시를 모음
// 이 셋이 하나도 안 적혀 있으면(태그 없음, 방식 미표기, 기타만) 방식 정보가 없는 상품이라 어느 방식이든 가능하다고 보고 셋 모두를 돌려줌
export function getSupportedMethods(product) {
  const values = (product?.tags ?? []).filter((tag) => tag.tagType === 'REPAY').map((tag) => tag.tagValue)
  const codes = new Set(values.map((value) => REPAY_METHOD_CODE[value]).filter(Boolean))
  if (codes.size === 0) return [...METHOD_ORDER]
  return METHOD_ORDER.filter((code) => codes.has(code))
}

// 비교할 상환 방식 정하기: 두 상품이 모두 지원하는 방식(겹치는 방식)으로 본다
// - 겹치는 방식이 2개 이상: mode 'choose', options에 겹치는 방식 (사용자가 칩으로 고름)
// - 겹치는 방식이 1개: mode 'fixed', method에 그 방식, limitedBy는 누가 그 방식으로 막았는지
//     'A' / 'B' = 그 상품만 그 방식 하나뿐, 'both' = 두 상품 모두 그 방식 하나뿐, 'common' = 둘 다 여러 방식인데 겹치는 게 하나뿐
// - 겹치는 방식이 없음: mode 'separate', 상품마다 자기 첫 방식(칩 순서)으로 따로 계산 (월 상환의 뜻이 달라 월 상환은 유리 판정에서 뺌)
export function getMethodPlan(productA, productB) {
  const supportedA = getSupportedMethods(productA)
  const supportedB = getSupportedMethods(productB)
  const common = supportedA.filter((code) => supportedB.includes(code))

  if (common.length >= 2) return { mode: 'choose', options: common }
  if (common.length === 1) {
    const isOnlyA = supportedA.length === 1
    const isOnlyB = supportedB.length === 1
    let limitedBy = 'common'
    if (isOnlyA && isOnlyB) limitedBy = 'both'
    else if (isOnlyA) limitedBy = 'A'
    else if (isOnlyB) limitedBy = 'B'
    return { mode: 'fixed', options: common, method: common[0], limitedBy }
  }
  return { mode: 'separate', options: [], methodA: supportedA[0], methodB: supportedB[0] }
}

// 계산할 수 있는 입력인지 (0 이하 금액, 음수 금리, 소수 개월은 계산하지 않음)
const isValidLoan = (principalWon, annualRate, months) =>
  isNumber(principalWon) && principalWon > 0 && isNumber(annualRate) && annualRate >= 0 && Number.isInteger(months) && months > 0

// 원리금균등 월 상환액, 총이자 (금액은 원, 금리는 연 %, 기간은 개월)
// 입력이 이상하면(0 이하 금액, 소수 개월, 음수 금리 등) 계산하지 않고 null
export function calcEqualPayment(principalWon, annualRate, months) {
  if (!isValidLoan(principalWon, annualRate, months)) return null

  const monthlyRate = annualRate / 12 / 100
  const rawMonthly =
    monthlyRate === 0
      ? principalWon / months
      : (principalWon * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
  const totalInterest = Math.round(rawMonthly * months - principalWon)

  if (!isNumber(rawMonthly) || !isNumber(totalInterest) || totalInterest < 0) return null
  return { monthly: Math.round(rawMonthly), totalInterest }
}

// 원금균등: 원금을 같게 나눠 갚고 이자는 남은 원금에 붙음. monthly는 가장 큰 '첫 달' 상환액, 총이자는 달마다 줄어드는 이자의 합
export function calcEqualPrincipal(principalWon, annualRate, months) {
  if (!isValidLoan(principalWon, annualRate, months)) return null

  const monthlyRate = annualRate / 12 / 100
  const firstMonthly = principalWon / months + principalWon * monthlyRate
  const totalInterest = Math.round((principalWon * monthlyRate * (months + 1)) / 2)

  if (!isNumber(firstMonthly) || !isNumber(totalInterest)) return null
  return { monthly: Math.round(firstMonthly), totalInterest }
}

// 만기일시: 매달 이자만 내고 원금은 끝에 한 번에 갚음. monthly는 '매달 내는 이자', 총이자는 그 합
export function calcBullet(principalWon, annualRate, months) {
  if (!isValidLoan(principalWon, annualRate, months)) return null

  const monthlyInterest = (principalWon * annualRate) / 12 / 100
  const totalInterest = Math.round(monthlyInterest * months)

  if (!isNumber(monthlyInterest) || !isNumber(totalInterest)) return null
  return { monthly: Math.round(monthlyInterest), totalInterest }
}

// 상환 방식 코드에 맞는 계산 (모르는 코드는 원리금균등)
export function calcPayment(method, principalWon, annualRate, months) {
  if (method === 'EQUAL_P') return calcEqualPrincipal(principalWon, annualRate, months)
  if (method === 'BULLET') return calcBullet(principalWon, annualRate, months)
  return calcEqualPayment(principalWon, annualRate, months)
}

// 상품 하나의 월 상환, 총이자 (금액은 만원, 금리는 중간값)
// method: 계산할 상환 방식 코드 (비교 화면에서 고른 방식). 안 주면 그 상품의 첫 상환 방식(getRepayCode)
// 결과의 method: 계산에 쓴 코드. 월 상환은 원리금균등 매달 / 원금균등 첫 달 / 만기일시 매달 이자
// status: OK / UNAVAILABLE (없거나 숨김 상품) / UNSUPPORTED_METHOD (고른 상환 방식을 이 상품이 지원 안 함) / NO_RATE (금리 기관 문의)
//   / OVER_LIMIT (한도 초과) / OVER_TERM (기간 초과) / INVALID (계산 불가)
export function getLoanResult(product, amountMan, months, method) {
  if (!product || product.productStatus === 'HIDDEN') return { status: 'UNAVAILABLE' }
  if (method && !getSupportedMethods(product).includes(method)) return { status: 'UNSUPPORTED_METHOD', method }

  const rate = getMidRate(product.rateMin, product.rateMax)
  if (rate === null) return { status: 'NO_RATE' }
  if (isNumber(product.limitAmount) && amountMan > product.limitAmount) return { status: 'OVER_LIMIT', rate }
  if (isNumber(product.termMax) && product.termMax > 0 && months > product.termMax) {
    return { status: 'OVER_TERM', rate }
  }

  const usedMethod = method ?? getRepayCode(product)
  const payment = calcPayment(usedMethod, amountMan * 10000, rate, months)
  if (!payment) return { status: 'INVALID', rate, method: usedMethod }
  return { status: 'OK', rate, method: usedMethod, ...payment }
}

// 비교 화면을 처음 열 때 넣어 둘 금액(만원), 기간(개월)과 그 근거
// 금액: ① 맞춤 추천에서 입력한 필요 금액 → ② 없으면 1,000만원 (상세 창 [이자 계산]의 기본 금액과 같은 값)
//   ①, ②가 두 상품이 모두 빌려 주는 최대 한도(한도 중 작은 값)보다 크면 그 한도로 줄이고 근거는 '한도'
//   (한도를 처음 금액으로 쓰지 않음: 한도가 아주 큰 상품은 120억원처럼 입력 범위를 넘는 값이 들어가서)
// 기간: ① 맞춤 추천에서 입력한 기간(0은 '잘 모르겠어요'라 제외, 선택지 안이고 두 상품 최대 기간 이내일 때) → ② 두 상품 최대 기간 안에서 가장 긴 선택지 → ③ 맞는 선택지가 없으면 첫 선택지
// recommend: { need 만원, months 개월 } 또는 없음 / 근거: 'recommend' 맞춤 추천 입력, 'limit' 최대 한도, 'term' 최대 기간, 'fallback' 기본값
export const FALLBACK_AMOUNT_MAN = 1000

export function getCompareDefaults(productA, productB, termOptions, recommend) {
  const limits = [productA, productB].map((product) => product.limitAmount).filter((limit) => isNumber(limit) && limit > 0)
  const minLimit = limits.length > 0 ? Math.min(...limits) : null
  const terms = [productA, productB].map((product) => product.termMax).filter((term) => isNumber(term) && term > 0)
  const maxTerm = terms.length > 0 ? Math.min(...terms) : Infinity

  let amount = FALLBACK_AMOUNT_MAN
  let amountSource = 'fallback'
  if (isNumber(recommend?.need) && recommend.need > 0) {
    amount = recommend.need
    amountSource = 'recommend'
  }
  if (minLimit !== null && amount > minLimit) {
    amount = minLimit
    amountSource = 'limit'
  }

  const fit = termOptions.filter((term) => term <= maxTerm)
  let months = termOptions[0]
  let monthsSource = 'fallback'
  if (isNumber(recommend?.months) && fit.includes(recommend.months)) {
    months = recommend.months
    monthsSource = 'recommend'
  } else if (fit.length > 0) {
    months = Math.max(...fit)
    monthsSource = 'term'
  }

  return { amount, months, amountSource, monthsSource }
}

// 두 상품이 들어왔을 때 금액은 두 상품 한도 이하로, 기간은 두 상품 최대 기간 안의 가장 긴 선택지로 (넘거나 선택지에 없을 때만)
// input: { amount 만원, months 개월 } / termOptions: 두 상품이 겹치는 용도 기준 기간 선택지 (개월 배열)
export function adjustCompareInput(input, productA, productB, termOptions) {
  let { amount, months } = input

  const limits = [productA, productB].map((product) => product.limitAmount).filter((limit) => isNumber(limit) && limit > 0)
  if (limits.length > 0 && isNumber(amount) && amount > Math.min(...limits)) amount = Math.min(...limits)

  const terms = [productA, productB].map((product) => product.termMax).filter((term) => isNumber(term) && term > 0)
  const maxTerm = terms.length > 0 ? Math.min(...terms) : Infinity
  if (!termOptions.includes(months) || months > maxTerm) {
    const fit = termOptions.filter((term) => term <= maxTerm)
    months = fit.length > 0 ? Math.max(...fit) : termOptions[0]
  }

  return { amount, months }
}

// 두 값 중 유리한 쪽: 두 값이 다 숫자이고 다를 때만 'A' 또는 'B', 아니면 null
// isHigherBetter가 true면 큰 쪽, false면 작은 쪽이 유리
function pickWinner(valueA, valueB, isHigherBetter) {
  if (!isNumber(valueA) || !isNumber(valueB) || valueA === valueB) return null
  const isAWinner = isHigherBetter ? valueA > valueB : valueA < valueB
  return isAWinner ? 'A' : 'B'
}

// 비교표 항목별 유리한 쪽
// rateMin 최저 금리, rateMax 최고 금리, limit 한도, term 기간, prepay 중도상환수수료, credit 신용점수 기준(낮을수록 쉬움), monthly 월 상환, totalInterest 총이자
// isSameMethod가 false(두 상품을 서로 다른 상환 방식으로 계산)이면 월 상환은 뜻이 달라 유리 판정에서 뺌. 총이자는 방식과 상관없이 비교
export function getCompareWinners(productA, productB, resultA, resultB, isSameMethod = true) {
  const isReady = (product) => Boolean(product) && product.productStatus !== 'HIDDEN'
  if (!isReady(productA) || !isReady(productB)) {
    return { rateMin: null, rateMax: null, limit: null, term: null, prepay: null, credit: null, monthly: null, totalInterest: null }
  }

  const isBothOk = resultA.status === 'OK' && resultB.status === 'OK'
  return {
    rateMin: pickWinner(productA.rateMin, productB.rateMin, false),
    rateMax: pickWinner(productA.rateMax, productB.rateMax, false),
    limit: pickWinner(productA.limitAmount, productB.limitAmount, true),
    term: pickWinner(productA.termMax, productB.termMax, true),
    prepay: pickWinner(productA.prepayFeeMax, productB.prepayFeeMax, false),
    credit: pickWinner(productA.creditMin, productB.creditMin, false),
    monthly: isBothOk && isSameMethod ? pickWinner(resultA.monthly, resultB.monthly, false) : null,
    totalInterest: isBothOk ? pickWinner(resultA.totalInterest, resultB.totalInterest, false) : null,
  }
}

// ---------------------------------------------------------------------------
// 대출 이자 계산기 (CA-01~07, CHORONG-49)
// ---------------------------------------------------------------------------

// 계산기 입력 한도 (금액은 원 단위, 기간은 개월, 나머지는 %). 금액 위, 수수료율, 증가율 한도는 명세서에 없어 정한 값
// 금액 칸은 만원 단위로 입력받고 값은 원 단위로 들고 있음 (명세서 '화면은 만원으로 입력받고 보낼 때 원으로 바꿈', 추천, 대출 비교 화면과 같게)
// 만원 → 원은 입력칸(NumberField isManwon)에서만 바꾸고, 계산, 검사, 저장(API-24), 기록 불러오기는 원 단위 그대로
// 기간은 칩에 없는 값을 [직접 입력]으로 받을 때의 범위 (1-600개월)
export const CALC_LIMITS = { amountMin: 10000, amountMax: 1000000000, rateMax: 20, feeMax: 5, growthMax: 20, monthsMin: 1, monthsMax: 600 }

// 계산기 상환 방식 4개 (코드는 API-24 repayMethod와 같게)
export const CALC_METHODS = [
  { code: 'EQUAL_PI', label: '원리금균등' },
  { code: 'EQUAL_P', label: '원금균등' },
  { code: 'BULLET', label: '만기일시' },
  { code: 'GRADUATED', label: '체증식' },
]

// 바로 열었을 때 처음 값 (금액 원, 기간 개월, 연 이자율 %)
// 숫자 칸은 빈칸으로 열고 [계산하기]를 눌러야 결과가 나옴 (상환 방식은 원리금균등 그대로. 예시 값으로 낸 결과를 내 결과로 오해하지 않게)
export const CALC_DEFAULTS = { amount: '', months: '', rate: '', method: 'EQUAL_PI' }

// 중도상환 후 방식 코드 (API-24 prepayMode와 같게): 월 납입액 줄이기, 기간 줄이기
const PREPAY_MODES = ['REDUCE_PAYMENT', 'SHORTEN_TERM']

// 기간 선택지 전체 (12, 36, 60, 120, 180개월)
const ALL_TERM_MONTHS = [...new Set([...MONTHS_OPTIONS_DEFAULT, ...MONTHS_OPTIONS_HOUSING])].sort((a, b) => a - b)

// 넘어온 기간으로 기간 칩 목록 정하기: 계산기는 넘어온 용도를 모르므로 기간으로 짐작한다.
// 12, 36은 그 밖 용도(12, 36, 60), 120, 180은 전월세, 주택 구입(60, 120, 180), 60이나 모르는 값은 용도를 알 수 없어 전체
export function getCalcTermOptions(months) {
  const isShort = MONTHS_OPTIONS_DEFAULT.includes(months)
  const isLong = MONTHS_OPTIONS_HOUSING.includes(months)
  if (isShort && !isLong) return MONTHS_OPTIONS_DEFAULT
  if (isLong && !isShort) return MONTHS_OPTIONS_HOUSING
  return ALL_TERM_MONTHS
}

// 다른 화면에서 navigate state로 넘긴 값 → 계산기 처음 값 (CA-01)
// state: { loanAmount 원, loanMonths 개월, interestRate 연 %, repayMethod } / 범위 밖이거나 이상한 값은 무시하고 처음 값 (숫자 칸은 빈칸)
//   기간은 칩에 없어도 1-600개월 정수면 받음 (칩에 없는 기간은 화면이 [직접 입력]으로 보여 줌)
//   저장한 기록(API-24 한 줄)을 그대로 넘기면 옵션도 복원: graceMonths, growthRate, prepayRound, prepayAmount 원, prepayFeeRate, prepayMode, changeRound, changeRate
// 결과: { amount 원, months, rate, method, termOptions } + 옵션이 맞으면 { graceMonths, growth, prepay, rateChange }
export function getInitialCalc(state) {
  const initial = { ...CALC_DEFAULTS, termOptions: ALL_TERM_MONTHS }

  if (isInRange(state?.loanAmount, CALC_LIMITS.amountMin, CALC_LIMITS.amountMax)) initial.amount = Math.round(state.loanAmount)

  const loanMonths = state?.loanMonths
  if (Number.isInteger(loanMonths) && isInRange(loanMonths, CALC_LIMITS.monthsMin, CALC_LIMITS.monthsMax)) {
    initial.months = loanMonths
    initial.termOptions = getCalcTermOptions(loanMonths)
  }

  const rate = state?.interestRate
  if (isNumber(rate) && rate >= 0 && rate <= CALC_LIMITS.rateMax) initial.rate = rate

  if (CALC_METHODS.some((method) => method.code === state?.repayMethod)) initial.method = state.repayMethod

  return Object.assign(initial, getSavedOptions(state, initial))
}

// 계산기 입력 칸 묶음(form)의 처음 모양. 금액 원, 중도상환액 원, 나머지는 개월, 회차, %
// 칸이 비어 있으면 ''. 거치, 수수료율, 변동 회차의 빈 칸은 0으로 본다.
// prepayMode: REDUCE_PAYMENT 월 납입액 줄이기 / SHORTEN_TERM 기간 줄이기
// initial에 저장한 기록의 옵션(graceMonths, growth, prepay, rateChange)이 있으면 그 값으로 채움
export function createCalcForm(initial = getInitialCalc()) {
  const { prepay, rateChange } = initial
  return {
    method: initial.method,
    amount: initial.amount,
    months: initial.months,
    rate: initial.rate,
    isGrace: (initial.graceMonths ?? 0) > 0,
    graceMonths: initial.graceMonths ?? 0,
    growth: initial.growth ?? '',
    isPrepay: Boolean(prepay),
    prepayRound: prepay?.round ?? '',
    prepayAmount: prepay?.amount ?? '',
    prepayFee: prepay?.feeRate ?? 0,
    prepayMode: prepay?.mode ?? 'REDUCE_PAYMENT',
    isRateChange: Boolean(rateChange),
    changeRound: rateChange?.round ?? 0,
    changeRate: rateChange?.rate ?? '',
  }
}

const isEmptyValue = (value) => value === '' || value === null || value === undefined
const orZero = (value) => (isEmptyValue(value) ? 0 : value)
const isInRange = (value, min, max) => isNumber(value) && value >= min && value <= max
const isRoundIn = (value, months) => Number.isInteger(value) && value >= 1 && value <= months

// 저장한 기록의 옵션 칸 → 처음 값 (getInitialCalc가 씀). 묶음마다 모두 맞을 때만 담고, 하나라도 틀리면 그 묶음은 무시
// 거치는 만기일시가 아닐 때 기간 미만, 증가율은 체증식만 (서버 검사와 같은 규칙), 회차는 1 이상 기간 이하
function getSavedOptions(state, { method, months }) {
  const options = {}

  const grace = state?.graceMonths
  if (method !== 'BULLET' && Number.isInteger(grace) && grace > 0 && grace < months) options.graceMonths = grace

  const growth = state?.growthRate
  if (method === 'GRADUATED' && isInRange(growth, 0, CALC_LIMITS.growthMax)) options.growth = growth

  const amount = isNumber(state?.prepayAmount) ? Math.round(state.prepayAmount) : null
  const isPrepayValid =
    isRoundIn(state?.prepayRound, months) &&
    isInRange(amount, CALC_LIMITS.amountMin, CALC_LIMITS.amountMax) &&
    isInRange(state?.prepayFeeRate, 0, CALC_LIMITS.feeMax) &&
    PREPAY_MODES.includes(state?.prepayMode)
  if (isPrepayValid) {
    options.prepay = { round: state.prepayRound, amount, feeRate: state.prepayFeeRate, mode: state.prepayMode }
  }

  if (isRoundIn(state?.changeRound, months) && isInRange(state?.changeRate, 0, CALC_LIMITS.rateMax)) {
    options.rateChange = { round: state.changeRound, rate: state.changeRate }
  }

  return options
}

// [결과 저장]으로 보낼 값 (API-24): params는 toScheduleParams 결과, schedule은 그 getSchedule 결과
// 옵션은 안 썼으면 null (서버가 null이면 없는 것으로 봄). 증가율은 체증식만, 거치는 만기일시면 0
export function toCalcRecord(params, schedule) {
  const { method, prepay, rateChange } = params
  return {
    loanAmount: params.principal,
    loanMonths: params.months,
    interestRate: params.rate,
    repayMethod: method,
    graceMonths: method === 'BULLET' ? 0 : params.graceMonths,
    totalInterest: schedule.totalInterest,
    firstPayment: schedule.firstPayment,
    growthRate: method === 'GRADUATED' ? params.growth : null,
    prepayRound: prepay?.round ?? null,
    prepayAmount: prepay?.amount ?? null,
    prepayFeeRate: prepay?.feeRate ?? null,
    prepayMode: prepay ? params.prepayMode : null,
    changeRound: rateChange?.round ?? null,
    changeRate: rateChange?.rate ?? null,
  }
}

// 중도상환 칸이 계산에 들어가는지: 체크했고 회차, 금액 중 하나라도 적었을 때 (둘 다 비어 있으면 아직 안 정한 것)
const isPrepayApplied = (form) => form.isPrepay && !(isEmptyValue(form.prepayRound) && isEmptyValue(form.prepayAmount))

// 금리 변동 칸이 계산에 들어가는지: 체크했고 변동 회차가 1 이상 (0이면 적용 안 함)
const isRateChangeApplied = (form) => form.isRateChange && orZero(form.changeRound) > 0

// 입력 칸 → 상환 스케줄 계산 값 (getSchedule에 그대로 넣음. 금액은 원 단위)
export function toScheduleParams(form) {
  return {
    method: form.method,
    principal: form.amount,
    rate: form.rate,
    months: form.months,
    graceMonths: orZero(form.graceMonths),
    growth: form.growth,
    prepayMode: form.prepayMode,
    prepay: isPrepayApplied(form)
      ? { round: form.prepayRound, amount: orZero(form.prepayAmount), feeRate: orZero(form.prepayFee) }
      : null,
    rateChange: isRateChangeApplied(form) ? { round: form.changeRound, rate: form.changeRate } : null,
  }
}

// 상환 스케줄 계산 오차: 0.5원 아래 남은 원금은 다 갚은 것으로 본다
const PAID_OFF = 0.005

// 연금식(원리금균등, 체증식)의 첫 달 기준 납입액: 남은 원금을 남은 회차(count)에 갚도록 현재가치를 맞춘다
// factor(index) = 상환 시작 후 index번째 달의 납입액 배수 (원리금균등은 항상 1, 체증식은 해마다 늘어남)
function solveBasePayment(balance, monthlyRate, startIndex, count, factor) {
  let discounted = 0
  for (let step = 0; step < count; step += 1) {
    discounted += factor(startIndex + step) / (1 + monthlyRate) ** (step + 1)
  }
  return balance / discounted
}

// 회차별 상환 스케줄 (CA-02, 05, 06)
// params: { method, principal 원, rate 연 %, months, graceMonths = 0, growth = 0 (체증식 연 증가율 %),
//   prepay = { round, amount 원, feeRate % } 또는 null, prepayMode = 'REDUCE_PAYMENT' | 'SHORTEN_TERM',
//   rateChange = { round, rate 연 % } 또는 null }
// - 거치기간: 그동안은 이자만 내고, 그 뒤 남은 회차에 원금을 갚는다 (만기일시는 거치 없음)
// - 체증식: 납입액이 12개월마다 growth %씩 늘어남 (처음 값은 전체를 갚도록 맞춤). 원금이 늘어나는 달이 생기면 계산 불가(null)
// - 중도상환: round회차 납입 뒤에 amount만큼 원금을 갚음 (남은 원금보다 크면 남은 원금까지, 수수료 = amount x feeRate%)
//     월 납입액 줄이기: 다음 회차부터 남은 회차에 맞춰 납입액(원금균등은 매달 원금)을 다시 계산 / 기간 줄이기: 납입액을 그대로 두어 일찍 끝남 (만기일시는 둘 다 같음)
// - 금리 변동: round회차부터 새 금리 (연금식은 남은 원래 회차 기준으로 납입액을 다시 계산)
// 결과: { rows [{ round, payment, principal, interest, prepay, balance }], totalInterest, prepayFee, totalPayment, firstPayment, lastRound }
//   (금액은 원 단위 반올림, 총이자는 반올림 전 합을 반올림) / 입력이 이상하거나 계산이 안 되면 null
export function getSchedule({
  method,
  principal,
  rate,
  months,
  graceMonths = 0,
  growth = 0,
  prepay = null,
  prepayMode = 'REDUCE_PAYMENT',
  rateChange = null,
}) {
  if (!isValidLoan(principal, rate, months)) return null
  if (!CALC_METHODS.some((item) => item.code === method)) return null

  const isBullet = method === 'BULLET'
  const isAnnuity = method === 'EQUAL_PI' || method === 'GRADUATED'
  const grace = isBullet ? 0 : graceMonths
  if (!Number.isInteger(grace) || grace < 0 || grace >= months) return null
  const growthRate = method === 'GRADUATED' ? growth : 0
  if (!isNumber(growthRate) || growthRate < 0) return null

  const factor = (index) => (1 + growthRate / 100) ** Math.floor(index / 12)

  let balance = principal
  let monthlyRate = rate / 12 / 100
  let basePayment = 0 // 연금식 첫 달 기준 납입액
  let principalUnit = 0 // 원금균등 매달 원금
  let needBase = true
  let needUnit = true
  let prepaidInGrace = 0 // 거치 중 중도상환한 돈 (기간 줄이기는 이 돈을 빼지 않고 납입액을 정함)
  let sumInterest = 0
  let sumFee = 0
  const rows = []

  for (let round = 1; round <= months && balance > PAID_OFF; round += 1) {
    if (rateChange && round === rateChange.round) {
      monthlyRate = rateChange.rate / 12 / 100
      needBase = true
    }

    const interest = balance * monthlyRate
    let principalPart
    if (isBullet) {
      principalPart = round === months ? balance : 0
    } else if (round <= grace) {
      principalPart = 0
    } else {
      const index = round - grace - 1 // 상환 시작 후 몇 번째 달인지 (0부터)
      const left = months - round + 1
      const planBalance = round === grace + 1 ? balance + prepaidInGrace : balance
      if (isAnnuity) {
        if (needBase) {
          basePayment = solveBasePayment(planBalance, monthlyRate, index, left, factor)
          needBase = false
        }
        principalPart = basePayment * factor(index) - interest
      } else {
        if (needUnit) {
          principalUnit = planBalance / left
          needUnit = false
        }
        principalPart = Math.min(principalUnit, balance)
      }
    }

    if (!isNumber(principalPart) || principalPart < -PAID_OFF) return null // 원금이 늘어나는 달이 있으면 계산 불가
    principalPart = Math.max(0, principalPart)
    // 마지막 회차(또는 납입액이 남은 원금을 넘는 회차)는 남은 원금을 전부 갚음
    if (round === months || principalPart > balance - PAID_OFF) principalPart = balance
    balance -= principalPart

    let prepayAmount = 0
    if (prepay && round === prepay.round && balance > PAID_OFF) {
      prepayAmount = Math.min(prepay.amount, balance)
      balance -= prepayAmount
      sumFee += (prepayAmount * prepay.feeRate) / 100
      if (prepayMode === 'SHORTEN_TERM') {
        if (round <= grace) prepaidInGrace += prepayAmount
      } else {
        needBase = true
        needUnit = true
      }
    }

    sumInterest += interest
    rows.push({ round, payment: principalPart + interest, principal: principalPart, interest, prepay: prepayAmount, balance })
  }

  const roundedRows = rows.map((row) => ({
    round: row.round,
    payment: Math.round(row.payment),
    principal: Math.round(row.principal),
    interest: Math.round(row.interest),
    prepay: Math.round(row.prepay),
    balance: Math.max(0, Math.round(row.balance)),
  }))
  const totalInterest = Math.round(sumInterest)
  const prepayFee = Math.round(sumFee)
  const totalPayment = Math.round(principal + sumInterest + sumFee)
  const isAllNumber = [totalInterest, prepayFee, totalPayment].every(isNumber)
  if (roundedRows.length === 0 || !isAllNumber || totalInterest < 0) return null

  return {
    rows: roundedRows,
    totalInterest,
    prepayFee,
    totalPayment,
    firstPayment: roundedRows[0].payment,
    lastRound: roundedRows.length,
  }
}

// 같은 입력으로 상환 방식 4개의 총이자 (CA-06 방식별 총이자). 계산이 안 되는 방식은 totalInterest가 null
export function getMethodInterests(params) {
  return CALC_METHODS.map(({ code, label }) => ({
    code,
    label,
    totalInterest: getSchedule({ ...params, method: code })?.totalInterest ?? null,
  }))
}

// 중도상환 후 방식 2개 비교 (CA-04): 방식 코드마다 { nextPayment 다음 회차 납입액 (없으면 null), totalInterest, lastRound } 또는 null
// 중도상환이 없으면 null
export function getPrepayModeResults(params) {
  if (!params.prepay) return null
  const results = {}
  for (const mode of ['REDUCE_PAYMENT', 'SHORTEN_TERM']) {
    const schedule = getSchedule({ ...params, prepayMode: mode })
    results[mode] = schedule
      ? {
          nextPayment: schedule.rows[params.prepay.round]?.payment ?? null,
          totalInterest: schedule.totalInterest,
          lastRound: schedule.lastRound,
        }
      : null
  }
  return results
}

// 중도상환 칸 오류 (비어 있으면 아직 안 정한 것이라 오류 아님)
function getPrepayErrors(form) {
  const errors = {}
  if (!isPrepayApplied(form)) return errors
  const months = form.months
  if (isEmptyValue(form.prepayRound)) {
    errors.prepayRound = '중도상환 회차를 입력해 주세요'
  } else if (!Number.isInteger(form.prepayRound) || form.prepayRound < 1 || form.prepayRound > months) {
    errors.prepayRound = `회차는 1회차부터 ${months}회차 사이로 입력해 주세요`
  }
  if (isEmptyValue(form.prepayAmount) || form.prepayAmount < CALC_LIMITS.amountMin) {
    errors.prepayAmount = '중도상환액을 1만원 이상 입력해 주세요'
  }
  if (!isEmptyValue(form.prepayFee) && !isInRange(form.prepayFee, 0, CALC_LIMITS.feeMax)) {
    errors.prepayFee = `수수료율은 0% 이상 ${CALC_LIMITS.feeMax}% 이하로 입력해 주세요`
  }
  return errors
}

// 금리 변동 칸 오류 (변동 회차가 0이거나 비어 있으면 적용 안 함이라 오류 아님)
function getRateChangeErrors(form) {
  const errors = {}
  if (!isRateChangeApplied(form)) return errors
  if (!Number.isInteger(form.changeRound) || form.changeRound > form.months) {
    errors.changeRound = `변동 회차는 1회차부터 ${form.months}회차 사이로 입력해 주세요`
  }
  if (isEmptyValue(form.changeRate)) {
    errors.changeRate = '변동 후 금리를 입력해 주세요'
  } else if (!isInRange(form.changeRate, 0, CALC_LIMITS.rateMax)) {
    errors.changeRate = `금리는 0% 이상 ${CALC_LIMITS.rateMax}% 이하로 입력해 주세요`
  }
  return errors
}

// 계산기 입력 검사 (E2): 칸 이름(amount, rate, months, graceMonths, growth, prepayRound, prepayAmount, prepayFee, changeRound, changeRate)별 오류 문구
// 오류가 없으면 빈 객체 = 계산할 수 있음
export function getCalcErrors(form) {
  const errors = {}
  const { amountMin, amountMax, rateMax, growthMax } = CALC_LIMITS

  if (isEmptyValue(form.amount)) {
    errors.amount = '빌릴 금액을 입력해 주세요'
  } else if (!isInRange(form.amount, amountMin, amountMax)) {
    errors.amount = `금액은 ${formatMoney(amountMin, '원')} 이상 ${formatMoney(amountMax, '원')} 이하로 입력해 주세요`
  }

  if (isEmptyValue(form.rate)) {
    errors.rate = '연 이자율을 입력해 주세요'
  } else if (!isInRange(form.rate, 0, rateMax)) {
    errors.rate = `연 이자율은 0% 이상 ${rateMax}% 이하로 입력해 주세요`
  }

  // 기간: 직접 입력 칸 하나
  const { monthsMin, monthsMax } = CALC_LIMITS
  if (isEmptyValue(form.months)) {
    errors.months = '상환 기간을 입력해 주세요'
    return errors
  }
  if (!Number.isInteger(form.months) || !isInRange(form.months, monthsMin, monthsMax)) {
    errors.months = `상환 기간은 ${monthsMin}개월 이상 ${monthsMax}개월 이하로 입력해 주세요`
    return errors
  }

  if (form.method !== 'BULLET') {
    const grace = orZero(form.graceMonths)
    if (!Number.isInteger(grace) || grace < 0 || grace >= form.months) {
      errors.graceMonths = `거치 기간은 0개월 이상 ${form.months}개월 미만으로 입력해 주세요`
    }
  }

  if (form.method === 'GRADUATED') {
    if (isEmptyValue(form.growth)) errors.growth = '연 증가율을 입력해 주세요'
    else if (!isInRange(form.growth, 0, growthMax)) errors.growth = `연 증가율은 0% 이상 ${growthMax}% 이하로 입력해 주세요`
  }

  Object.assign(errors, getPrepayErrors(form), getRateChangeErrors(form))

  // 중도상환액은 그 회차에 남은 원금 이하 (다른 칸이 다 맞아야 남은 원금을 계산할 수 있음)
  if (Object.keys(errors).length === 0 && isPrepayApplied(form)) {
    const base = getSchedule({ ...toScheduleParams(form), prepay: null })
    const remaining = base?.rows[form.prepayRound - 1]?.balance
    if (isNumber(remaining) && orZero(form.prepayAmount) > remaining) {
      errors.prepayAmount = `중도상환액은 그때 남은 원금(${formatMoney(remaining, '원')}) 이하로 입력해 주세요`
    }
  }

  return errors
}
