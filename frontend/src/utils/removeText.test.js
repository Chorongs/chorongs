import { describe, expect, it } from 'vitest'
import { getGoneText, isGoneError } from './removeText'

describe('getGoneText', () => {
  it('받침이 있으면 이에요를 붙인다', () => {
    expect(getGoneText('계산 기록')).toBe('이미 삭제한 계산 기록이에요')
  })

  it('받침이 없으면 예요를 붙인다', () => {
    expect(getGoneText('추천 결과')).toBe('이미 삭제한 추천 결과예요')
  })

  it('지우는 말을 바꿀 수 있다', () => {
    expect(getGoneText('찜', '취소')).toBe('이미 취소한 찜이에요')
  })
})

describe('isGoneError', () => {
  it('404면 true, 그 밖은 false다', () => {
    expect(isGoneError({ response: { status: 404 } })).toBe(true)
    expect(isGoneError({ response: { status: 500 } })).toBe(false)
    expect(isGoneError(undefined)).toBe(false)
  })
})
