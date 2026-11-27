import { describe, expect, it } from 'vitest'
import { getGoneText, isGoneError, withObjectParticle } from './removeText'

describe('getGoneText', () => {
  it('받침이 있으면 이에요를 붙인다', () => {
    // Given
    const itemName = '계산 기록'
    // When
    const text = getGoneText(itemName)
    // Then
    expect(text).toBe('이미 삭제한 계산 기록이에요')
  })

  it('받침이 없으면 예요를 붙인다', () => {
    // Given
    const itemName = '추천 결과'
    // When
    const text = getGoneText(itemName)
    // Then
    expect(text).toBe('이미 삭제한 추천 결과예요')
  })

  it('지우는 말을 바꿀 수 있다', () => {
    // Given
    const itemName = '찜'
    // When
    const text = getGoneText(itemName, '취소')
    // Then
    expect(text).toBe('이미 취소한 찜이에요')
  })
})

describe('withObjectParticle', () => {
  it('받침이 있으면 을을 붙인다', () => {
    // Given
    const word = '비교 내역'
    // When
    const text = withObjectParticle(word)
    // Then
    expect(text).toBe('비교 내역을')
  })

  it('받침이 없으면 를을 붙인다', () => {
    // Given
    const word = '추천 결과'
    // When
    const text = withObjectParticle(word)
    // Then
    expect(text).toBe('추천 결과를')
  })

  it('한글이 아닌 글자로 끝나면 을(를)을 붙인다', () => {
    // Given
    const word = 'DSR'
    // When
    const text = withObjectParticle(word)
    // Then
    expect(text).toBe('DSR을(를)')
  })
})

describe('isGoneError', () => {
  it('404면 true다', () => {
    // Given
    const error = { response: { status: 404 } }
    // When
    const isGone = isGoneError(error)
    // Then
    expect(isGone).toBe(true)
  })

  it('404가 아니면 false다', () => {
    // Given
    const error = { response: { status: 500 } }
    // When
    const isGone = isGoneError(error)
    // Then
    expect(isGone).toBe(false)
  })

  it('응답이 없으면 false다', () => {
    // Given
    const error = undefined
    // When
    const isGone = isGoneError(error)
    // Then
    expect(isGone).toBe(false)
  })
})
