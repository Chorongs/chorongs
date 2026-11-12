import { describe, expect, it } from 'vitest'
import { formatDate, formatMoney, formatNumber, formatRate } from './format'

describe('formatNumber', () => {
  it('천 단위 쉼표를 붙인다', () => {
    // Given
    const value = 1234567
    // When
    const result = formatNumber(value)
    // Then
    expect(result).toBe('1,234,567')
  })

  it('숫자가 아니면 -를 돌려준다', () => {
    // Given
    const value = 'abc'
    // When
    const result = formatNumber(value)
    // Then
    expect(result).toBe('-')
  })
})

describe('formatMoney', () => {
  it('만원 단위 값은 쉼표와 만원을 붙인다', () => {
    // Given
    const value = 3000
    // When
    const result = formatMoney(value)
    // Then
    expect(result).toBe('3,000만원')
  })

  it('10000만원은 1억원으로 묶는다', () => {
    // Given
    const value = 10000
    // When
    const result = formatMoney(value)
    // Then
    expect(result).toBe('1억원')
  })

  it('억과 나머지 만원을 같이 쓴다', () => {
    // Given
    const value = 12000
    // When
    const result = formatMoney(value)
    // Then
    expect(result).toBe('1억 2,000만원')
  })

  it('원 단위 값이 만원으로 떨어지면 만원으로 바꾼다', () => {
    // Given
    const value = 10000000
    // When
    const result = formatMoney(value, '원')
    // Then
    expect(result).toBe('1,000만원')
  })

  it('원 단위 값이 만원으로 안 떨어지면 원으로 그대로 쓴다', () => {
    // Given
    const value = 12345678
    // When
    const result = formatMoney(value, '원')
    // Then
    expect(result).toBe('12,345,678원')
  })

  it('값이 없으면 -를 돌려준다', () => {
    // Given
    const value = null
    // When
    const result = formatMoney(value)
    // Then
    expect(result).toBe('-')
  })
})

describe('formatRate', () => {
  it('소수 둘째 자리까지 0으로 채운다', () => {
    // Given
    const value = 5.5
    // When
    const result = formatRate(value)
    // Then
    expect(result).toBe('5.50')
  })

  it('소수 둘째 자리까지만 남긴다', () => {
    // Given
    const value = 4.567
    // When
    const result = formatRate(value)
    // Then
    expect(result).toBe('4.57')
  })

  it('값이 없으면 -를 돌려준다', () => {
    // Given
    const value = undefined
    // When
    const result = formatRate(value)
    // Then
    expect(result).toBe('-')
  })
})

describe('formatDate', () => {
  it('하이픈을 점으로 바꾼다', () => {
    // Given
    const value = '2026-10-18'
    // When
    const result = formatDate(value)
    // Then
    expect(result).toBe('2026.10.18')
  })

  it('시각이 붙어 있어도 날짜만 쓴다', () => {
    // Given
    const value = '2026-10-18T09:30:00'
    // When
    const result = formatDate(value)
    // Then
    expect(result).toBe('2026.10.18')
  })

  it('날짜 모양이 아니면 -를 돌려준다', () => {
    // Given
    const value = '어제'
    // When
    const result = formatDate(value)
    // Then
    expect(result).toBe('-')
  })
})
