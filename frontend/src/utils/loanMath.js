// 대출 계산 함수 (화면 없는 계산)
// 지금은 비교 화면(CP-02, 03, 05)이 쓰는 원리금균등 계산과 유리 판정만 있다.
// 계산기(CA-02)가 쓰는 상환 스케줄은 그 이슈(CHORONG-49)에서 이 파일에 추가한다.

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

// 금리 중간값: 최저, 최고가 둘 다 있으면 평균(소수 둘째 자리), 하나만 있으면 그 값, 없으면 null
export function getMidRate(min, max) {
  const rates = [min, max].filter(isNumber)
  if (rates.length === 0) return null
  const mid = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
  return Number(mid.toFixed(2))
}

// 원리금균등 월 상환액, 총이자 (금액은 원, 금리는 연 %, 기간은 개월)
// 입력이 이상하면(0 이하 금액, 소수 개월, 음수 금리 등) 계산하지 않고 null
export function calcEqualPayment(principalWon, annualRate, months) {
  if (!isNumber(principalWon) || principalWon <= 0) return null
  if (!isNumber(annualRate) || annualRate < 0) return null
  if (!Number.isInteger(months) || months <= 0) return null

  const monthlyRate = annualRate / 12 / 100
  const rawMonthly =
    monthlyRate === 0
      ? principalWon / months
      : (principalWon * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
  const totalInterest = Math.round(rawMonthly * months - principalWon)

  if (!isNumber(rawMonthly) || !isNumber(totalInterest) || totalInterest < 0) return null
  return { monthly: Math.round(rawMonthly), totalInterest }
}

// 상품 하나의 월 상환, 총이자 (금액은 만원, 금리는 중간값 + 원리금균등)
// status: OK / UNAVAILABLE (없거나 숨김 상품) / NO_RATE (금리 기관 문의) / OVER_LIMIT (한도 초과) / OVER_TERM (기간 초과) / INVALID (계산 불가)
export function getLoanResult(product, amountMan, months) {
  if (!product || product.productStatus === 'HIDDEN') return { status: 'UNAVAILABLE' }

  const rate = getMidRate(product.rateMin, product.rateMax)
  if (rate === null) return { status: 'NO_RATE' }
  if (isNumber(product.limitAmount) && amountMan > product.limitAmount) return { status: 'OVER_LIMIT', rate }
  if (isNumber(product.termMax) && product.termMax > 0 && months > product.termMax) {
    return { status: 'OVER_TERM', rate }
  }

  const payment = calcEqualPayment(amountMan * 10000, rate, months)
  if (!payment) return { status: 'INVALID', rate }
  return { status: 'OK', rate, ...payment }
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
export function getCompareWinners(productA, productB, resultA, resultB) {
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
    monthly: isBothOk ? pickWinner(resultA.monthly, resultB.monthly, false) : null,
    totalInterest: isBothOk ? pickWinner(resultA.totalInterest, resultB.totalInterest, false) : null,
  }
}
