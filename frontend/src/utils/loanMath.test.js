import { describe, expect, it } from 'vitest'
import { calcEqualPayment, getCompareWinners, getLoanResult, getMidRate } from './loanMath'

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

  it('금리 중간값으로 월 상환, 총이자를 구한다', () => {
    // Given
    const amountMan = 1000
    // When
    const result = getLoanResult(product, amountMan, 12)
    // Then
    expect(result.status).toBe('OK')
    expect(result.rate).toBe(6)
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

  it('최저, 최고 금리가 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = [winners.rateMin, winners.rateMax]
    // Then
    expect(result).toEqual(['A', 'A'])
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

  it('월 상환, 총이자는 낮은 쪽이 유리하다', () => {
    // Given
    const winners = getCompareWinners(productA, productB, resultA, resultB)
    // When
    const result = [winners.monthly, winners.totalInterest]
    // Then
    expect(result).toEqual(['A', 'A'])
  })

  it('한쪽 값이 없으면 그 항목은 판정하지 않는다', () => {
    // Given
    const noPrepay = { ...productB, prepayFeeMax: null }
    // When
    const winners = getCompareWinners(productA, noPrepay, resultA, resultB)
    // Then
    expect(winners.prepay).toBeNull()
  })

  it('계산 못 한 쪽이 있으면 월 상환, 총이자는 판정하지 않는다', () => {
    // Given
    const failed = { status: 'NO_RATE' }
    // When
    const winners = getCompareWinners(productA, productB, resultA, failed)
    // Then
    expect([winners.monthly, winners.totalInterest]).toEqual([null, null])
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
