import { describe, expect, it } from 'vitest'
import { adjustCompareInput, calcEqualPayment, getCompareWinners, getLoanResult, getMidRate } from './loanMath'

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
