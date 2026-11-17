import { REPAY_METHOD_CODE } from '../constants/options'

// 대출 계산 함수 (화면 없는 계산)
// 지금은 비교 화면(CP-02, 03, 05)이 쓰는 상환 방식별(원리금균등, 원금균등, 만기일시) 계산과 유리 판정만 있다.
// 계산기(CA-02)가 쓰는 상환 스케줄은 그 이슈(CHORONG-49)에서 이 파일에 추가한다.

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

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
// 금액: ① 맞춤 추천에서 입력한 필요 금액 → ② 두 상품이 모두 빌려 주는 최대 한도(한도 중 작은 값) → ③ 한도 정보가 없으면 1,000만원
//   (③은 상세 창 [이자 계산]의 기본 금액과 같은 값). 추천 금액이 한도보다 크면 한도로 줄이고 근거는 '한도'
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
  } else if (minLimit !== null) {
    amount = minLimit
    amountSource = 'limit'
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
