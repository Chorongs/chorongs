import { describe, expect, it } from 'vitest'
import { formatPrice } from './sample'

describe('formatPrice', () => {
  it('0을 "0원"으로 표시한다', () => {
    // Given
    const price = 0
    // When
    const result = formatPrice(price)
    // Then
    expect(result).toBe('0원')
  })

  it('12000을 "12,000원"으로 표시한다', () => {
    // Given
    const price = 12000
    // When
    const result = formatPrice(price)
    // Then
    expect(result).toBe('12,000원')
  })

  it('1000000을 "1,000,000원"으로 표시한다', () => {
    // Given
    const price = 1000000
    // When
    const result = formatPrice(price)
    // Then
    expect(result).toBe('1,000,000원')
  })
})
