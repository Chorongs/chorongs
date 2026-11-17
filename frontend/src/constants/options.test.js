import { describe, expect, it } from 'vitest'
import { getTermOptions } from './options'

describe('getTermOptions', () => {
  it('전월세만 있으면 60, 120, 180개월', () => {
    // Given
    const purposes = ['전월세']
    // When
    const result = getTermOptions(purposes)
    // Then
    expect(result).toEqual([60, 120, 180])
  })

  it('전월세와 주택 구입이 함께 있어도 60, 120, 180개월', () => {
    // Given
    const purposes = ['주택 구입', '전월세']
    // When
    const result = getTermOptions(purposes)
    // Then
    expect(result).toEqual([60, 120, 180])
  })

  it('그 밖의 용도는 12, 36, 60개월', () => {
    // Given
    const purposes = ['생활비']
    // When
    const result = getTermOptions(purposes)
    // Then
    expect(result).toEqual([12, 36, 60])
  })

  it('장기 용도와 그 밖의 용도가 섞이면 12, 36, 60개월', () => {
    // Given
    const purposes = ['전월세', '생활비']
    // When
    const result = getTermOptions(purposes)
    // Then
    expect(result).toEqual([12, 36, 60])
  })

  it('용도 목록이 비어 있으면 12, 36, 60개월', () => {
    // Given
    const purposes = []
    // When
    const result = getTermOptions(purposes)
    // Then
    expect(result).toEqual([12, 36, 60])
  })

  it('용도 목록이 없으면 12, 36, 60개월', () => {
    // Given
    const purposes = undefined
    // When
    const result = getTermOptions(purposes)
    // Then
    expect(result).toEqual([12, 36, 60])
  })
})
