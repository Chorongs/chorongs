import { describe, expect, it } from 'vitest'
import { getCompareBlock, getMethods, hasSameMethod } from './useCompareStore'

const product = (purposes, methods) => ({
  tags: [
    ...purposes.map((tagValue) => ({ tagType: 'PURPOSE', tagValue })),
    ...methods.map((tagValue) => ({ tagType: 'REPAY', tagValue })),
  ],
})

describe('getMethods', () => {
  it('상환 방식 태그를 코드로 돌려준다', () => {
    // Given
    const target = product(['생활비'], ['원금균등'])
    // When
    const result = getMethods(target)
    // Then
    expect(result).toEqual(['EQUAL_P'])
  })

  it('비교함 상품은 담아 둔 methods를 그대로 돌려준다', () => {
    // Given
    const trayItem = { productId: 1, purposes: ['생활비'], methods: ['BULLET'] }
    // When
    const result = getMethods(trayItem)
    // Then
    expect(result).toEqual(['BULLET'])
  })

  it('방식 정보가 없는 상품은 세 방식 모두이다', () => {
    // Given
    const target = product(['생활비'], [])
    // When
    const result = getMethods(target)
    // Then
    expect(result).toEqual(['EQUAL_PI', 'EQUAL_P', 'BULLET'])
  })
})

describe('hasSameMethod', () => {
  it('상환 방식이 하나라도 겹치면 true이다', () => {
    // Given
    const productA = product(['생활비'], ['원리금균등'])
    const productB = product(['생활비'], ['원리금균등', '원금균등'])
    // When
    const result = hasSameMethod(productA, productB)
    // Then
    expect(result).toBe(true)
  })

  it('각자 다른 방식 하나씩이면 false이다', () => {
    // Given
    const productA = product(['생활비'], ['만기일시'])
    const productB = product(['생활비'], ['원금균등'])
    // When
    const result = hasSameMethod(productA, productB)
    // Then
    expect(result).toBe(false)
  })

  it('한쪽이 방식 정보가 없으면 true이다', () => {
    // Given
    const productA = product(['생활비'], ['만기일시'])
    const productB = product(['생활비'], [])
    // When
    const result = hasSameMethod(productA, productB)
    // Then
    expect(result).toBe(true)
  })
})

describe('getCompareBlock', () => {
  it('용도와 상환 방식이 모두 겹치면 null이다', () => {
    // Given
    const productA = product(['생활비'], ['원리금균등'])
    const productB = product(['생활비'], ['원리금균등', '만기일시'])
    // When
    const result = getCompareBlock(productA, productB)
    // Then
    expect(result).toBeNull()
  })

  it('용도가 안 겹치면 purpose이다', () => {
    // Given
    const productA = product(['생활비'], ['원리금균등'])
    const productB = product(['창업'], ['원리금균등'])
    // When
    const result = getCompareBlock(productA, productB)
    // Then
    expect(result).toBe('purpose')
  })

  it('용도는 겹치고 상환 방식이 각자 다른 하나씩이면 method이다', () => {
    // Given
    const productA = product(['생활비'], ['만기일시'])
    const productB = product(['생활비'], ['원금균등'])
    // When
    const result = getCompareBlock(productA, productB)
    // Then
    expect(result).toBe('method')
  })

  it('용도도 방식도 안 겹치면 용도를 먼저 알린다', () => {
    // Given
    const productA = product(['생활비'], ['만기일시'])
    const productB = product(['창업'], ['원금균등'])
    // When
    const result = getCompareBlock(productA, productB)
    // Then
    expect(result).toBe('purpose')
  })
})
