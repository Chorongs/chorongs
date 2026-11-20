import { describe, expect, it } from 'vitest'
import {
  adjustCompareInput,
  calcBullet,
  calcEqualPayment,
  calcEqualPrincipal,
  calcPayment,
  createCalcForm,
  getCalcErrors,
  getCalcTermOptions,
  getCompareDefaults,
  getCompareWinners,
  getInitialCalc,
  getLoanResult,
  getMethodInterests,
  getMethodPlan,
  getMidRate,
  getPrepayModeResults,
  getRepayCode,
  getSchedule,
  getSupportedMethods,
  toScheduleParams,
} from './loanMath'

describe('getMidRate', () => {
  it('최저, 최고 금리의 가운데 값을 돌려준다', () => {
    // Given
    const min = 4
    const max = 9.5
    // When
    const result = getMidRate(min, max)
    // Then
    expect(result).toBe(6.75)
  })

  it('한쪽만 있으면 그 값을 돌려준다', () => {
    // Given
    const min = null
    const max = 7.2
    // When
    const result = getMidRate(min, max)
    // Then
    expect(result).toBe(7.2)
  })

  it('둘 다 없으면 null을 돌려준다', () => {
    // Given
    const min = null
    const max = undefined
    // When
    const result = getMidRate(min, max)
    // Then
    expect(result).toBeNull()
  })
})

describe('calcEqualPayment', () => {
  it('1,000만원 연 12% 12개월의 월 상환액을 구한다', () => {
    // Given
    const principal = 10000000
    // When
    const result = calcEqualPayment(principal, 12, 12)
    // Then
    expect(result.monthly).toBe(888488)
  })

  it('1,000만원 연 12% 12개월의 총이자를 구한다', () => {
    // Given
    const principal = 10000000
    // When
    const result = calcEqualPayment(principal, 12, 12)
    // Then
    expect(result.totalInterest).toBe(661855)
  })

  it('3,000만원 연 5% 36개월의 월 상환액을 구한다', () => {
    // Given
    const principal = 30000000
    // When
    const result = calcEqualPayment(principal, 5, 36)
    // Then
    expect(result.monthly).toBe(899127)
  })

  it('금리가 0이면 이자 없이 나눠 갚는다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcEqualPayment(principal, 0, 12)
    // Then
    expect(result).toEqual({ monthly: 1000000, totalInterest: 0 })
  })

  it('금액이 0이면 null을 돌려준다', () => {
    // Given
    const principal = 0
    // When
    const result = calcEqualPayment(principal, 5, 12)
    // Then
    expect(result).toBeNull()
  })

  it('기간이 0이면 null을 돌려준다', () => {
    // Given
    const months = 0
    // When
    const result = calcEqualPayment(10000000, 5, months)
    // Then
    expect(result).toBeNull()
  })

  it('금리가 음수면 null을 돌려준다', () => {
    // Given
    const rate = -1
    // When
    const result = calcEqualPayment(10000000, rate, 12)
    // Then
    expect(result).toBeNull()
  })
})

describe('getLoanResult', () => {
  const product = { productStatus: 'ON', rateMin: 4, rateMax: 8, limitAmount: 5000, termMax: 60 }

  it('계산할 수 있으면 상태는 OK', () => {
    // Given
    const amountMan = 1000
    // When
    const result = getLoanResult(product, amountMan, 12)
    // Then
    expect(result.status).toBe('OK')
  })

  it('계산에 쓴 금리는 최저, 최고 금리의 중간값', () => {
    // Given
    const amountMan = 1000
    // When
    const result = getLoanResult(product, amountMan, 12)
    // Then
    expect(result.rate).toBe(6)
  })

  it('입력값으로 계산할 수 없으면 INVALID', () => {
    // Given
    const amountMan = 0
    // When
    const result = getLoanResult(product, amountMan, 12)
    // Then
    expect(result.status).toBe('INVALID')
  })

  it('한도가 숫자가 아니면 한도 초과로 보지 않는다', () => {
    // Given
    const noLimit = { ...product, limitAmount: null }
    // When
    const result = getLoanResult(noLimit, 999999, 12)
    // Then
    expect(result.status).toBe('OK')
  })

  it('금리가 없으면 NO_RATE', () => {
    // Given
    const noRate = { ...product, rateMin: null, rateMax: null }
    // When
    const result = getLoanResult(noRate, 1000, 12)
    // Then
    expect(result.status).toBe('NO_RATE')
  })

  it('금액이 한도를 넘으면 OVER_LIMIT', () => {
    // Given
    const amountMan = 6000
    // When
    const result = getLoanResult(product, amountMan, 12)
    // Then
    expect(result.status).toBe('OVER_LIMIT')
  })

  it('기간이 최대 기간을 넘으면 OVER_TERM', () => {
    // Given
    const months = 120
    // When
    const result = getLoanResult(product, 1000, months)
    // Then
    expect(result.status).toBe('OVER_TERM')
  })

  it('숨김 상품은 UNAVAILABLE', () => {
    // Given
    const hidden = { productId: 1, productStatus: 'HIDDEN' }
    // When
    const result = getLoanResult(hidden, 1000, 12)
    // Then
    expect(result.status).toBe('UNAVAILABLE')
  })
})

describe('getCompareWinners', () => {
  const productA = { productStatus: 'ON', rateMin: 3, rateMax: 5, limitAmount: 3000, termMax: 60, prepayFeeMax: 1.5, creditMin: 700 }
  const productB = { productStatus: 'ON', rateMin: 5, rateMax: 7, limitAmount: 5000, termMax: 60, prepayFeeMax: 0, creditMin: 600 }
  const resultA = { status: 'OK', monthly: 100, totalInterest: 50 }
  const resultB = { status: 'OK', monthly: 120, totalInterest: 80 }

  it('최저 금리가 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.rateMin
    // Then
    expect(result).toBe('A')
  })

  it('최고 금리가 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.rateMax
    // Then
    expect(result).toBe('A')
  })

  it('신용점수 기준이 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.credit
    // Then
    expect(result).toBe('B')
  })

  it('한도가 높은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.limit
    // Then
    expect(result).toBe('B')
  })

  it('값이 같으면 유리한 쪽이 없다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.term
    // Then
    expect(result).toBeNull()
  })

  it('중도상환수수료가 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.prepay
    // Then
    expect(result).toBe('B')
  })

  it('월 상환액이 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.monthly
    // Then
    expect(result).toBe('A')
  })

  it('총이자가 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = winners.totalInterest
    // Then
    expect(result).toBe('A')
  })

  it('한쪽 값이 없으면 그 항목은 판정하지 않는다', () => {
    // Given
    const noPrepay = { ...productB, prepayFeeMax: null }
    // When
    const winners = getCompareWinners(productA, noPrepay, resultA, resultB)
    // Then
    expect(winners.prepay).toBeNull()
  })

  it('계산 못 한 쪽이 있으면 월 상환은 판정하지 않는다', () => {
    // Given
    const failed = { status: 'NO_RATE' }
    // When
    const winners = getCompareWinners(productA, productB, resultA, failed)
    // Then
    expect(winners.monthly).toBeNull()
  })

  it('계산 못 한 쪽이 있으면 총이자는 판정하지 않는다', () => {
    // Given
    const failed = { status: 'NO_RATE' }
    // When
    const winners = getCompareWinners(productA, productB, resultA, failed)
    // Then
    expect(winners.totalInterest).toBeNull()
  })

  it('숨김 상품이 있으면 모든 항목을 판정하지 않는다', () => {
    // Given
    const hidden = { productStatus: 'HIDDEN' }
    // When
    const winners = getCompareWinners(productA, hidden, resultA, { status: 'UNAVAILABLE' })
    // Then
    expect(Object.values(winners).every((winner) => winner === null)).toBe(true)
  })
})

describe('getCompareWinners 방식이 다른 경우', () => {
  const productA = { productStatus: 'ON', rateMin: 3, rateMax: 5, limitAmount: 3000, termMax: 60 }
  const productB = { productStatus: 'ON', rateMin: 5, rateMax: 7, limitAmount: 5000, termMax: 60 }
  const resultA = { status: 'OK', monthly: 100, totalInterest: 50 }
  const resultB = { status: 'OK', monthly: 120, totalInterest: 80 }

  it('상환 방식이 서로 다르면 월 상환은 유리 판정에서 뺀다', () => {
    // Given
    const isSameMethod = false
    // When
    const winners = getCompareWinners(productA, productB, resultA, resultB, isSameMethod)
    // Then
    expect(winners.monthly).toBeNull()
  })

  it('상환 방식이 서로 달라도 총이자는 비교한다', () => {
    // Given
    const isSameMethod = false
    // When
    const winners = getCompareWinners(productA, productB, resultA, resultB, isSameMethod)
    // Then
    expect(winners.totalInterest).toBe('A')
  })
})

describe('adjustCompareInput', () => {
  const productA = { limitAmount: 5000, termMax: 60 }
  const productB = { limitAmount: 3000, termMax: 36 }
  const shortOptions = [12, 36, 60]
  const longOptions = [60, 120, 180]

  it('금액이 두 상품 한도보다 크면 작은 한도로 낮춘다', () => {
    // Given
    const input = { amount: 4000, months: 36 }
    // When
    const result = adjustCompareInput(input, productA, productB, shortOptions)
    // Then
    expect(result.amount).toBe(3000)
  })

  it('금액이 한도 이하면 그대로 둔다', () => {
    // Given
    const input = { amount: 2000, months: 36 }
    // When
    const result = adjustCompareInput(input, productA, productB, shortOptions)
    // Then
    expect(result.amount).toBe(2000)
  })

  it('한도가 숫자가 아닌 상품은 빼고 숫자인 한도만 본다', () => {
    // Given
    const noLimit = { limitAmount: null, termMax: 60 }
    const input = { amount: 4000, months: 36 }
    // When
    const result = adjustCompareInput(input, noLimit, productB, shortOptions)
    // Then
    expect(result.amount).toBe(3000)
  })

  it('기간이 두 상품 최대 기간보다 길면 그 안의 가장 긴 선택지로 줄인다', () => {
    // Given
    const input = { amount: 2000, months: 60 }
    // When
    const result = adjustCompareInput(input, productA, productB, shortOptions)
    // Then
    expect(result.months).toBe(36)
  })

  it('기간이 선택지 안이고 최대 기간 이하면 그대로 둔다', () => {
    // Given
    const input = { amount: 2000, months: 12 }
    // When
    const result = adjustCompareInput(input, productA, productB, shortOptions)
    // Then
    expect(result.months).toBe(12)
  })

  it('기간이 선택지에 없으면 최대 기간 안의 가장 긴 선택지로 바꾼다', () => {
    // Given
    const longProduct = { limitAmount: 30000, termMax: 360 }
    const input = { amount: 2000, months: 36 }
    // When
    const result = adjustCompareInput(input, longProduct, longProduct, longOptions)
    // Then
    expect(result.months).toBe(180)
  })

  it('선택지가 모두 최대 기간보다 길면 첫 선택지로 둔다', () => {
    // Given
    const shortProduct = { limitAmount: 5000, termMax: 36 }
    const input = { amount: 2000, months: 120 }
    // When
    const result = adjustCompareInput(input, shortProduct, shortProduct, longOptions)
    // Then
    expect(result.months).toBe(60)
  })
})

describe('getRepayCode', () => {
  const tag = (tagValue) => ({ tagType: 'REPAY', tagValue })

  it('상환 방식 태그가 원금균등이면 EQUAL_P', () => {
    // Given
    const product = { tags: [tag('원금균등')] }
    // When
    const result = getRepayCode(product)
    // Then
    expect(result).toBe('EQUAL_P')
  })

  it('상환 방식 태그가 만기일시이면 BULLET', () => {
    // Given
    const product = { tags: [tag('만기일시')] }
    // When
    const result = getRepayCode(product)
    // Then
    expect(result).toBe('BULLET')
  })

  it('상환 방식이 여러 개이면 첫 번째 값을 따른다', () => {
    // Given
    const product = { tags: [tag('원금균등'), tag('원리금균등')] }
    // When
    const result = getRepayCode(product)
    // Then
    expect(result).toBe('EQUAL_P')
  })

  it('방식 미표기 상품은 EQUAL_PI', () => {
    // Given
    const product = { tags: [tag('분할상환(방식 미표기)')] }
    // When
    const result = getRepayCode(product)
    // Then
    expect(result).toBe('EQUAL_PI')
  })

  it('상환 방식 태그가 없으면 EQUAL_PI', () => {
    // Given
    const product = { tags: [{ tagType: 'PURPOSE', tagValue: '생활비' }] }
    // When
    const result = getRepayCode(product)
    // Then
    expect(result).toBe('EQUAL_PI')
  })

  it('상품이 없으면 EQUAL_PI', () => {
    // Given
    const product = null
    // When
    const result = getRepayCode(product)
    // Then
    expect(result).toBe('EQUAL_PI')
  })
})

describe('calcEqualPrincipal', () => {
  it('1,200만원, 연 12%, 12개월의 첫 달 상환액은 112만원이다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcEqualPrincipal(principal, 12, 12)
    // Then
    expect(result.monthly).toBe(1120000)
  })

  it('1,200만원, 연 12%, 12개월의 총이자는 78만원이다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcEqualPrincipal(principal, 12, 12)
    // Then
    expect(result.totalInterest).toBe(780000)
  })

  it('같은 조건에서 원리금균등보다 총이자가 적다', () => {
    // Given
    const equalPayment = calcEqualPayment(12000000, 12, 12)
    // When
    const result = calcEqualPrincipal(12000000, 12, 12)
    // Then
    expect(result.totalInterest).toBeLessThan(equalPayment.totalInterest)
  })

  it('금리가 0이면 첫 달은 원금을 개월 수로 나눈 값이다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcEqualPrincipal(principal, 0, 12)
    // Then
    expect(result.monthly).toBe(1000000)
  })

  it('금액이 0이면 null이다', () => {
    // Given
    const principal = 0
    // When
    const result = calcEqualPrincipal(principal, 12, 12)
    // Then
    expect(result).toBeNull()
  })
})

describe('calcBullet', () => {
  it('1,200만원, 연 12%이면 매달 이자는 12만원이다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcBullet(principal, 12, 12)
    // Then
    expect(result.monthly).toBe(120000)
  })

  it('1,200만원, 연 12%, 12개월의 총이자는 144만원이다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcBullet(principal, 12, 12)
    // Then
    expect(result.totalInterest).toBe(1440000)
  })

  it('금리가 0이면 매달 이자도 0이다', () => {
    // Given
    const principal = 12000000
    // When
    const result = calcBullet(principal, 0, 12)
    // Then
    expect(result.monthly).toBe(0)
  })

  it('개월이 0이면 null이다', () => {
    // Given
    const months = 0
    // When
    const result = calcBullet(12000000, 12, months)
    // Then
    expect(result).toBeNull()
  })
})

describe('calcPayment', () => {
  it('EQUAL_P이면 원금균등으로 계산한다', () => {
    // Given
    const method = 'EQUAL_P'
    // When
    const result = calcPayment(method, 12000000, 12, 12)
    // Then
    expect(result).toEqual(calcEqualPrincipal(12000000, 12, 12))
  })

  it('BULLET이면 만기일시로 계산한다', () => {
    // Given
    const method = 'BULLET'
    // When
    const result = calcPayment(method, 12000000, 12, 12)
    // Then
    expect(result).toEqual(calcBullet(12000000, 12, 12))
  })

  it('모르는 코드는 원리금균등으로 계산한다', () => {
    // Given
    const method = 'ETC'
    // When
    const result = calcPayment(method, 12000000, 12, 12)
    // Then
    expect(result).toEqual(calcEqualPayment(12000000, 12, 12))
  })
})

describe('getLoanResult 상환 방식', () => {
  const base = { productStatus: 'ON', rateMin: 12, rateMax: 12, limitAmount: 5000, termMax: 60 }

  it('원금균등 상품은 첫 달 상환액으로 계산한다', () => {
    // Given
    const product = { ...base, tags: [{ tagType: 'REPAY', tagValue: '원금균등' }] }
    // When
    const result = getLoanResult(product, 1200, 12)
    // Then
    expect(result.monthly).toBe(1120000)
  })

  it('만기일시 상품은 매달 이자로 계산한다', () => {
    // Given
    const product = { ...base, tags: [{ tagType: 'REPAY', tagValue: '만기일시' }] }
    // When
    const result = getLoanResult(product, 1200, 12)
    // Then
    expect(result.monthly).toBe(120000)
  })

  it('계산에 쓴 상환 방식 코드를 돌려준다', () => {
    // Given
    const product = { ...base, tags: [{ tagType: 'REPAY', tagValue: '만기일시' }] }
    // When
    const result = getLoanResult(product, 1200, 12)
    // Then
    expect(result.method).toBe('BULLET')
  })
})

describe('getCompareDefaults', () => {
  const productA = { limitAmount: 3000, termMax: 60 }
  const productB = { limitAmount: 5000, termMax: 120 }
  const shortOptions = [12, 36, 60]

  it('맞춤 추천 필요 금액이 한도 안이면 그 금액이다', () => {
    // Given
    const recommend = { need: 1500, months: 36 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.amount).toBe(1500)
  })

  it('맞춤 추천 금액이 한도 안이면 근거는 recommend이다', () => {
    // Given
    const recommend = { need: 1500, months: 36 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.amountSource).toBe('recommend')
  })

  it('맞춤 추천 금액이 두 상품 한도 중 작은 값보다 크면 그 한도로 줄인다', () => {
    // Given
    const recommend = { need: 8000, months: 36 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.amount).toBe(3000)
  })

  it('맞춤 추천 금액을 한도로 줄이면 근거는 limit이다', () => {
    // Given
    const recommend = { need: 8000, months: 36 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.amountSource).toBe('limit')
  })

  it('맞춤 추천 입력이 없으면 두 상품 한도 중 작은 값이다', () => {
    // Given
    const recommend = null
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.amount).toBe(3000)
  })

  it('한도가 숫자가 아닌 두 상품이고 추천 입력도 없으면 1,000만원이다', () => {
    // Given
    const noLimitA = { limitAmount: null, termMax: 60 }
    const noLimitB = { limitAmount: null, termMax: 60 }
    // When
    const result = getCompareDefaults(noLimitA, noLimitB, shortOptions, null)
    // Then
    expect(result.amount).toBe(1000)
  })

  it('맞춤 추천 기간이 선택지 안이면 그 기간이다', () => {
    // Given
    const recommend = { need: 1500, months: 12 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.months).toBe(12)
  })

  it('맞춤 추천 기간이 0(잘 모르겠어요)이면 두 상품 최대 기간 안의 가장 긴 선택지이다', () => {
    // Given
    const recommend = { need: 1500, months: 0 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.months).toBe(60)
  })

  it('맞춤 추천 기간이 선택지에 없으면 가장 긴 선택지이다', () => {
    // Given
    const recommend = { need: 1500, months: 120 }
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.months).toBe(60)
  })

  it('맞춤 추천 기간이 한 상품 최대 기간을 넘으면 그 안의 가장 긴 선택지이다', () => {
    // Given
    const shortTerm = { limitAmount: 3000, termMax: 36 }
    const recommend = { need: 1500, months: 60 }
    // When
    const result = getCompareDefaults(shortTerm, productB, shortOptions, recommend)
    // Then
    expect(result.months).toBe(36)
  })

  it('맞는 선택지가 하나도 없으면 첫 선택지이다', () => {
    // Given
    const veryShort = { limitAmount: 3000, termMax: 6 }
    // When
    const result = getCompareDefaults(veryShort, productB, shortOptions, null)
    // Then
    expect(result.months).toBe(12)
  })

  it('추천 입력이 없을 때 기간의 근거는 term이다', () => {
    // Given
    const recommend = null
    // When
    const result = getCompareDefaults(productA, productB, shortOptions, recommend)
    // Then
    expect(result.monthsSource).toBe('term')
  })
})

const repayTags = (...values) => values.map((tagValue) => ({ tagType: 'REPAY', tagValue }))

describe('getSupportedMethods', () => {
  it('상환 방식 태그를 코드로 바꿔 칩 순서로 돌려준다', () => {
    // Given
    const product = { tags: repayTags('원금균등', '원리금균등') }
    // When
    const result = getSupportedMethods(product)
    // Then
    expect(result).toEqual(['EQUAL_PI', 'EQUAL_P'])
  })

  it('만기일시도 지원 목록에 들어간다', () => {
    // Given
    const product = { tags: repayTags('만기일시', '원리금균등') }
    // When
    const result = getSupportedMethods(product)
    // Then
    expect(result).toEqual(['EQUAL_PI', 'BULLET'])
  })

  it('방식 미표기와 실제 방식이 같이 있으면 실제 방식만 돌려준다', () => {
    // Given
    const product = { tags: repayTags('분할상환(방식 미표기)', '원리금균등') }
    // When
    const result = getSupportedMethods(product)
    // Then
    expect(result).toEqual(['EQUAL_PI'])
  })

  it('방식 미표기만 있으면 방식 정보가 없어 세 방식 모두이다', () => {
    // Given
    const product = { tags: repayTags('분할상환(방식 미표기)') }
    // When
    const result = getSupportedMethods(product)
    // Then
    expect(result).toEqual(['EQUAL_PI', 'EQUAL_P', 'BULLET'])
  })

  it('상환 방식 태그가 없으면 세 방식 모두이다', () => {
    // Given
    const product = { tags: [] }
    // When
    const result = getSupportedMethods(product)
    // Then
    expect(result).toEqual(['EQUAL_PI', 'EQUAL_P', 'BULLET'])
  })

  it('기타만 있으면 세 방식 모두이다', () => {
    // Given
    const product = { tags: repayTags('기타') }
    // When
    const result = getSupportedMethods(product)
    // Then
    expect(result).toEqual(['EQUAL_PI', 'EQUAL_P', 'BULLET'])
  })
})

describe('getMethodPlan', () => {
  const noInfo = { tags: [] }
  const only = (...values) => ({ tags: repayTags(...values) })

  it('두 상품 모두 방식 정보가 없으면 세 방식을 칩으로 고른다', () => {
    // Given
    const productA = noInfo
    const productB = noInfo
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'choose', options: ['EQUAL_PI', 'EQUAL_P', 'BULLET'] })
  })

  it('두 상품의 방식이 같고 2개 이상이면 그 방식을 칩으로 고른다', () => {
    // Given
    const productA = only('원리금균등', '원금균등')
    const productB = only('원금균등', '원리금균등')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'choose', options: ['EQUAL_PI', 'EQUAL_P'] })
  })

  it('종류가 달라도 겹치는 방식이 2개 이상이면 겹치는 방식을 칩으로 고른다', () => {
    // Given
    const productA = only('원리금균등', '원금균등', '만기일시')
    const productB = only('원리금균등', '원금균등')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'choose', options: ['EQUAL_PI', 'EQUAL_P'] })
  })

  it('A만 원리금균등 하나이면 원리금균등으로 고정하고 A 때문이라고 알린다', () => {
    // Given
    const productA = only('원리금균등')
    const productB = only('원리금균등', '원금균등')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'fixed', options: ['EQUAL_PI'], method: 'EQUAL_PI', limitedBy: 'A' })
  })

  it('B만 만기일시 하나이고 A가 방식 정보가 없으면 만기일시로 고정하고 B 때문이라고 알린다', () => {
    // Given
    const productA = noInfo
    const productB = only('만기일시')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'fixed', options: ['BULLET'], method: 'BULLET', limitedBy: 'B' })
  })

  it('두 상품 모두 원리금균등 하나뿐이면 둘 다 때문이라고 알린다', () => {
    // Given
    const productA = only('원리금균등')
    const productB = only('원리금균등')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result.limitedBy).toBe('both')
  })

  it('둘 다 여러 방식인데 겹치는 방식이 하나뿐이면 common으로 고정한다', () => {
    // Given
    const productA = only('원리금균등', '원금균등')
    const productB = only('원금균등', '만기일시')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'fixed', options: ['EQUAL_P'], method: 'EQUAL_P', limitedBy: 'common' })
  })

  it('겹치는 방식이 없으면 상품마다 자기 첫 방식으로 따로 계산한다', () => {
    // Given
    const productA = only('만기일시')
    const productB = only('원금균등')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'separate', options: [], methodA: 'BULLET', methodB: 'EQUAL_P' })
  })

  it('겹치는 방식이 없고 한쪽이 여러 방식이면 칩 순서로 첫 방식을 쓴다', () => {
    // Given
    const productA = only('원금균등', '원리금균등')
    const productB = only('만기일시')
    // When
    const result = getMethodPlan(productA, productB)
    // Then
    expect(result).toEqual({ mode: 'separate', options: [], methodA: 'EQUAL_PI', methodB: 'BULLET' })
  })
})

describe('getLoanResult 방식을 고른 경우', () => {
  const base = { productStatus: 'ON', rateMin: 12, rateMax: 12, limitAmount: 5000, termMax: 60 }

  it('상품이 지원하지 않는 방식을 고르면 UNSUPPORTED_METHOD이다', () => {
    // Given
    const product = { ...base, tags: repayTags('원리금균등') }
    // When
    const result = getLoanResult(product, 1200, 12, 'BULLET')
    // Then
    expect(result.status).toBe('UNSUPPORTED_METHOD')
  })

  it('지원하는 방식을 고르면 그 방식으로 계산한다', () => {
    // Given
    const product = { ...base, tags: repayTags('원리금균등', '만기일시') }
    // When
    const result = getLoanResult(product, 1200, 12, 'BULLET')
    // Then
    expect(result.monthly).toBe(120000)
  })

  it('방식을 안 주면 그 상품의 첫 상환 방식으로 계산한다', () => {
    // Given
    const product = { ...base, tags: repayTags('만기일시') }
    // When
    const result = getLoanResult(product, 1200, 12)
    // Then
    expect(result.method).toBe('BULLET')
  })
})

// ---- 계산기 (CA-02~06, CHORONG-49) ----

// 1,000만원, 연 6%, 24개월 기준 입력
const scheduleBase = { method: 'EQUAL_PI', principal: 10000000, rate: 6, months: 24 }

describe('getSchedule 원리금균등', () => {
  it('첫 달 납입액이 calcEqualPayment의 월 상환액과 같다', () => {
    // Given
    const expected = calcEqualPayment(10000000, 6, 24).monthly
    // When
    const result = getSchedule(scheduleBase)
    // Then
    expect(result.firstPayment).toBe(expected)
  })

  it('총이자가 calcEqualPayment의 총이자와 같다', () => {
    // Given
    const expected = calcEqualPayment(10000000, 6, 24).totalInterest
    // When
    const result = getSchedule(scheduleBase)
    // Then
    expect(result.totalInterest).toBe(expected)
  })

  it('마지막 회차의 남은 원금은 0이다', () => {
    // Given
    const params = scheduleBase
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[23].balance).toBe(0)
  })

  it('회차 수는 대출 기간과 같다', () => {
    // Given
    const params = scheduleBase
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows).toHaveLength(24)
  })

  it('금리 0%면 원금을 똑같이 나눠 갚고 이자는 0이다', () => {
    // Given
    const params = { ...scheduleBase, rate: 0 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.totalInterest).toBe(0)
  })
})

describe('getSchedule 원금균등, 만기일시', () => {
  it('원금균등 총이자가 calcEqualPrincipal의 총이자와 같다', () => {
    // Given
    const expected = calcEqualPrincipal(10000000, 6, 24).totalInterest
    // When
    const result = getSchedule({ ...scheduleBase, method: 'EQUAL_P' })
    // Then
    expect(result.totalInterest).toBe(expected)
  })

  it('원금균등 첫 달 납입액이 가장 크다', () => {
    // Given
    const params = { ...scheduleBase, method: 'EQUAL_P' }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[0].payment).toBeGreaterThan(result.rows[23].payment)
  })

  it('만기일시 총이자가 calcBullet의 총이자와 같다', () => {
    // Given
    const expected = calcBullet(10000000, 6, 24).totalInterest
    // When
    const result = getSchedule({ ...scheduleBase, method: 'BULLET' })
    // Then
    expect(result.totalInterest).toBe(expected)
  })

  it('만기일시는 마지막 회차에 원금을 한 번에 갚는다', () => {
    // Given
    const params = { ...scheduleBase, method: 'BULLET' }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[23].principal).toBe(10000000)
  })

  it('만기일시는 거치 기간을 줘도 무시한다', () => {
    // Given
    const params = { ...scheduleBase, method: 'BULLET', graceMonths: 6 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.totalInterest).toBe(calcBullet(10000000, 6, 24).totalInterest)
  })
})

describe('getSchedule 거치기간', () => {
  it('거치 중에는 원금을 갚지 않는다', () => {
    // Given
    const params = { ...scheduleBase, graceMonths: 6 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows.slice(0, 6).every((row) => row.principal === 0)).toBe(true)
  })

  it('거치가 끝난 뒤에도 마지막 회차에 다 갚는다', () => {
    // Given
    const params = { ...scheduleBase, graceMonths: 6 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[23].balance).toBe(0)
  })

  it('거치가 있으면 총이자가 더 많다', () => {
    // Given
    const withoutGrace = getSchedule(scheduleBase)
    // When
    const withGrace = getSchedule({ ...scheduleBase, graceMonths: 6 })
    // Then
    expect(withGrace.totalInterest).toBeGreaterThan(withoutGrace.totalInterest)
  })

  it('거치 기간이 대출 기간 이상이면 null이다', () => {
    // Given
    const params = { ...scheduleBase, graceMonths: 24 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result).toBeNull()
  })
})

describe('getSchedule 체증식', () => {
  const graduated = { ...scheduleBase, method: 'GRADUATED', growth: 10 }

  it('13개월째 납입액이 12개월째보다 크다', () => {
    // Given
    const params = graduated
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[12].payment).toBeGreaterThan(result.rows[11].payment)
  })

  it('마지막 회차의 남은 원금은 0이다', () => {
    // Given
    const params = graduated
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[23].balance).toBe(0)
  })

  it('증가율이 0%면 원리금균등과 총이자가 같다', () => {
    // Given
    const expected = getSchedule(scheduleBase).totalInterest
    // When
    const result = getSchedule({ ...graduated, growth: 0 })
    // Then
    expect(result.totalInterest).toBe(expected)
  })

  it('처음에 원금이 늘어나는 조건이면 null이다', () => {
    // Given
    const params = { method: 'GRADUATED', principal: 10000000, rate: 20, months: 600, growth: 20 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result).toBeNull()
  })
})

describe('getSchedule 중도상환', () => {
  const prepayParams = { ...scheduleBase, prepay: { round: 6, amount: 3000000, feeRate: 1.5 } }

  it('중도상환 회차에 중도상환 금액이 표시된다', () => {
    // Given
    const params = prepayParams
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[5].prepay).toBe(3000000)
  })

  it('수수료는 중도상환액 x 수수료율이다', () => {
    // Given
    const params = prepayParams
    // When
    const result = getSchedule(params)
    // Then
    expect(result.prepayFee).toBe(45000)
  })

  it('월 납입액 줄이기는 다음 달 납입액이 줄고 기간은 그대로다', () => {
    // Given
    const before = getSchedule(prepayParams).rows[5].payment
    // When
    const result = getSchedule({ ...prepayParams, prepayMode: 'REDUCE_PAYMENT' })
    // Then
    expect(result.rows[6].payment).toBeLessThan(before)
  })

  it('월 납입액 줄이기는 기간이 그대로다', () => {
    // Given
    const params = { ...prepayParams, prepayMode: 'REDUCE_PAYMENT' }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.lastRound).toBe(24)
  })

  it('기간 줄이기는 대출이 일찍 끝난다', () => {
    // Given
    const params = { ...prepayParams, prepayMode: 'SHORTEN_TERM' }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.lastRound).toBeLessThan(24)
  })

  it('기간 줄이기는 월 납입액 줄이기보다 총이자가 적다', () => {
    // Given
    const reduce = getSchedule({ ...prepayParams, prepayMode: 'REDUCE_PAYMENT' })
    // When
    const shorten = getSchedule({ ...prepayParams, prepayMode: 'SHORTEN_TERM' })
    // Then
    expect(shorten.totalInterest).toBeLessThan(reduce.totalInterest)
  })

  it('중도상환액이 남은 원금보다 크면 남은 원금까지만 갚는다', () => {
    // Given
    const params = { ...scheduleBase, prepay: { round: 6, amount: 999999999, feeRate: 0 } }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[5].balance).toBe(0)
  })

  it('중도상환을 하면 총이자가 줄어든다', () => {
    // Given
    const without = getSchedule(scheduleBase)
    // When
    const result = getSchedule(prepayParams)
    // Then
    expect(result.totalInterest).toBeLessThan(without.totalInterest)
  })
})

describe('getSchedule 금리 변동', () => {
  it('금리가 오르면 총이자가 늘어난다', () => {
    // Given
    const without = getSchedule(scheduleBase)
    // When
    const result = getSchedule({ ...scheduleBase, rateChange: { round: 7, rate: 9 } })
    // Then
    expect(result.totalInterest).toBeGreaterThan(without.totalInterest)
  })

  it('변동 전 회차의 납입액은 그대로다', () => {
    // Given
    const without = getSchedule(scheduleBase)
    // When
    const result = getSchedule({ ...scheduleBase, rateChange: { round: 7, rate: 9 } })
    // Then
    expect(result.rows[5].payment).toBe(without.rows[5].payment)
  })

  it('금리가 올라도 마지막 회차에 다 갚는다', () => {
    // Given
    const params = { ...scheduleBase, rateChange: { round: 7, rate: 9 } }
    // When
    const result = getSchedule(params)
    // Then
    expect(result.rows[23].balance).toBe(0)
  })
})

describe('getSchedule 잘못된 입력', () => {
  it('금액이 0이면 null이다', () => {
    // Given
    const params = { ...scheduleBase, principal: 0 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result).toBeNull()
  })

  it('금리가 음수면 null이다', () => {
    // Given
    const params = { ...scheduleBase, rate: -1 }
    // When
    const result = getSchedule(params)
    // Then
    expect(result).toBeNull()
  })

  it('모르는 상환 방식이면 null이다', () => {
    // Given
    const params = { ...scheduleBase, method: 'UNKNOWN' }
    // When
    const result = getSchedule(params)
    // Then
    expect(result).toBeNull()
  })
})

describe('getMethodInterests', () => {
  it('상환 방식 4개의 총이자를 돌려준다', () => {
    // Given
    const params = scheduleBase
    // When
    const result = getMethodInterests(params)
    // Then
    expect(result.map((item) => item.code)).toEqual(['EQUAL_PI', 'EQUAL_P', 'BULLET', 'GRADUATED'])
  })

  it('만기일시 총이자가 가장 많다', () => {
    // Given
    const params = scheduleBase
    // When
    const result = getMethodInterests(params)
    // Then
    const bullet = result.find((item) => item.code === 'BULLET').totalInterest
    expect(result.every((item) => item.totalInterest <= bullet)).toBe(true)
  })
})

describe('getPrepayModeResults', () => {
  it('중도상환이 없으면 null이다', () => {
    // Given
    const params = scheduleBase
    // When
    const result = getPrepayModeResults(params)
    // Then
    expect(result).toBeNull()
  })

  it('기간 줄이기가 월 납입액 줄이기보다 일찍 끝난다', () => {
    // Given
    const params = { ...scheduleBase, prepay: { round: 6, amount: 3000000, feeRate: 0 } }
    // When
    const result = getPrepayModeResults(params)
    // Then
    expect(result.SHORTEN_TERM.lastRound).toBeLessThan(result.REDUCE_PAYMENT.lastRound)
  })
})

describe('getCalcTermOptions', () => {
  it('36개월이면 12, 36, 60개월이다', () => {
    // Given
    const months = 36
    // When
    const result = getCalcTermOptions(months)
    // Then
    expect(result).toEqual([12, 36, 60])
  })

  it('120개월이면 60, 120, 180개월이다', () => {
    // Given
    const months = 120
    // When
    const result = getCalcTermOptions(months)
    // Then
    expect(result).toEqual([60, 120, 180])
  })

  it('60개월이면 용도를 알 수 없어 5개 전부다', () => {
    // Given
    const months = 60
    // When
    const result = getCalcTermOptions(months)
    // Then
    expect(result).toEqual([12, 36, 60, 120, 180])
  })
})

describe('getInitialCalc', () => {
  it('넘어온 값이 없으면 기본값이다', () => {
    // Given
    const state = null
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result).toMatchObject({ amount: 1000, months: 36, rate: 5, method: 'EQUAL_PI' })
  })

  it('넘어온 금액(원)을 만원으로 바꿔 넣는다', () => {
    // Given
    const state = { loanAmount: 20000000 }
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result.amount).toBe(2000)
  })

  it('넘어온 기간, 금리, 상환 방식을 처음 값으로 쓴다', () => {
    // Given
    const state = { loanMonths: 120, interestRate: 4.35, repayMethod: 'EQUAL_P' }
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result).toMatchObject({ months: 120, rate: 4.35, method: 'EQUAL_P' })
  })

  it('기간 선택지에 없는 기간은 무시한다', () => {
    // Given
    const state = { loanMonths: 24 }
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result.months).toBe(36)
  })

  it('범위 밖 금리는 무시한다', () => {
    // Given
    const state = { interestRate: 35 }
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result.rate).toBe(5)
  })

  it('1만원보다 작은 금액은 무시한다', () => {
    // Given
    const state = { loanAmount: 100 }
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result.amount).toBe(1000)
  })

  it('모르는 상환 방식은 무시한다', () => {
    // Given
    const state = { repayMethod: 'UNKNOWN' }
    // When
    const result = getInitialCalc(state)
    // Then
    expect(result.method).toBe('EQUAL_PI')
  })
})

describe('getCalcErrors', () => {
  it('처음 값은 오류가 없다', () => {
    // Given
    const form = createCalcForm()
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors).toEqual({})
  })

  it('금액이 비면 금액 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), amount: '' }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.amount).toBe('빌릴 금액을 입력해 주세요')
  })

  it('금액이 0이면 금액 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), amount: 0 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.amount).toContain('1만원 이상')
  })

  it('이자율이 20%를 넘으면 이자율 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), rate: 21 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.rate).toContain('20%')
  })

  it('이자율 0%는 오류가 아니다', () => {
    // Given
    const form = { ...createCalcForm(), rate: 0 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.rate).toBeUndefined()
  })

  it('거치 기간이 대출 기간 이상이면 거치 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), graceMonths: 36 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.graceMonths).toContain('36개월 미만')
  })

  it('만기일시는 거치 기간을 검사하지 않는다', () => {
    // Given
    const form = { ...createCalcForm(), method: 'BULLET', graceMonths: 99 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.graceMonths).toBeUndefined()
  })

  it('체증식이 아니면 증가율을 검사하지 않는다', () => {
    // Given
    const form = { ...createCalcForm(), growth: 99 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.growth).toBeUndefined()
  })

  it('체증식 증가율이 범위 밖이면 증가율 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), method: 'GRADUATED', growth: 25 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.growth).toContain('20%')
  })

  it('중도상환을 체크만 하고 비워 두면 오류가 아니다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors).toEqual({})
  })

  it('중도상환 회차가 대출 기간을 넘으면 회차 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true, prepayRound: 40, prepayAmount: 100 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.prepayRound).toContain('36회차')
  })

  it('중도상환 금액만 적고 회차가 비면 회차 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true, prepayAmount: 100 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.prepayRound).toBe('중도상환 회차를 입력해 주세요')
  })

  it('중도상환액이 그때 남은 원금보다 크면 금액 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true, prepayRound: 6, prepayAmount: 1000 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.prepayAmount).toContain('남은 원금')
  })

  it('중도상환액이 남은 원금 이하면 오류가 없다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true, prepayRound: 6, prepayAmount: 500 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors).toEqual({})
  })

  it('수수료율이 5%를 넘으면 수수료율 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true, prepayRound: 6, prepayAmount: 100, prepayFee: 6 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.prepayFee).toContain('5%')
  })

  it('변동 회차가 0이면 금리 변동을 적용하지 않고 오류도 없다', () => {
    // Given
    const form = { ...createCalcForm(), isRateChange: true, changeRound: 0, changeRate: '' }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors).toEqual({})
  })

  it('변동 회차를 적었는데 변동 후 금리가 비면 금리 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), isRateChange: true, changeRound: 12 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.changeRate).toBe('변동 후 금리를 입력해 주세요')
  })

  it('변동 회차가 대출 기간을 넘으면 회차 오류가 난다', () => {
    // Given
    const form = { ...createCalcForm(), isRateChange: true, changeRound: 40, changeRate: 7 }
    // When
    const errors = getCalcErrors(form)
    // Then
    expect(errors.changeRound).toContain('36회차')
  })
})

describe('toScheduleParams', () => {
  it('금액(만원)을 원으로 바꾼다', () => {
    // Given
    const form = { ...createCalcForm(), amount: 2000 }
    // When
    const params = toScheduleParams(form)
    // Then
    expect(params.principal).toBe(20000000)
  })

  it('중도상환을 체크하지 않으면 중도상환 값이 없다', () => {
    // Given
    const form = { ...createCalcForm(), prepayRound: 6, prepayAmount: 100 }
    // When
    const params = toScheduleParams(form)
    // Then
    expect(params.prepay).toBeNull()
  })

  it('중도상환액(만원)을 원으로 바꾼다', () => {
    // Given
    const form = { ...createCalcForm(), isPrepay: true, prepayRound: 6, prepayAmount: 300, prepayFee: 1.2 }
    // When
    const params = toScheduleParams(form)
    // Then
    expect(params.prepay).toEqual({ round: 6, amount: 3000000, feeRate: 1.2 })
  })

  it('변동 회차가 0이면 금리 변동 값이 없다', () => {
    // Given
    const form = { ...createCalcForm(), isRateChange: true, changeRound: 0, changeRate: 8 }
    // When
    const params = toScheduleParams(form)
    // Then
    expect(params.rateChange).toBeNull()
  })
})
