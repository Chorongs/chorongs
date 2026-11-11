import { describe, expect, it } from 'vitest'
import { isBlank, isLengthInRange, isNumberInRange, isValidNickname } from './validate'

describe('isBlank', () => {
  it('공백만 있는 글자는 빈 값이다', () => {
    // Given
    const value = '   '
    // When
    const result = isBlank(value)
    // Then
    expect(result).toBe(true)
  })

  it('null은 빈 값이다', () => {
    // Given
    const value = null
    // When
    const result = isBlank(value)
    // Then
    expect(result).toBe(true)
  })

  it('숫자 0은 빈 값이 아니다', () => {
    // Given
    const value = 0
    // When
    const result = isBlank(value)
    // Then
    expect(result).toBe(false)
  })
})

describe('isNumberInRange', () => {
  it('범위 끝 값(max)은 통과한다', () => {
    // Given
    const value = 100
    // When
    const result = isNumberInRange(value, 1, 100)
    // Then
    expect(result).toBe(true)
  })

  it('범위보다 크면 실패한다', () => {
    // Given
    const value = 101
    // When
    const result = isNumberInRange(value, 1, 100)
    // Then
    expect(result).toBe(false)
  })

  it('빈 글자는 0으로 보지 않고 실패한다', () => {
    // Given
    const value = ''
    // When
    const result = isNumberInRange(value, 0, 100)
    // Then
    expect(result).toBe(false)
  })

  it('숫자가 아닌 글자는 실패한다', () => {
    // Given
    const value = 'abc'
    // When
    const result = isNumberInRange(value, 0, 100)
    // Then
    expect(result).toBe(false)
  })
})

describe('isLengthInRange', () => {
  it('앞뒤 공백을 빼고 글자 수를 센다', () => {
    // Given
    const text = '  가나다  '
    // When
    const result = isLengthInRange(text, 1, 3)
    // Then
    expect(result).toBe(true)
  })

  it('최대 글자 수를 넘으면 실패한다', () => {
    // Given
    const text = '가나다라'
    // When
    const result = isLengthInRange(text, 1, 3)
    // Then
    expect(result).toBe(false)
  })
})

describe('isValidNickname', () => {
  it('2자 닉네임은 통과한다', () => {
    // Given
    const nickname = '캐링'
    // When
    const result = isValidNickname(nickname)
    // Then
    expect(result).toBe(true)
  })

  it('1자 닉네임은 실패한다', () => {
    // Given
    const nickname = '캐'
    // When
    const result = isValidNickname(nickname)
    // Then
    expect(result).toBe(false)
  })

  it('12자 닉네임은 통과한다', () => {
    // Given
    const nickname = '가나다라마바사아자차카타'
    // When
    const result = isValidNickname(nickname)
    // Then
    expect(result).toBe(true)
  })

  it('13자 닉네임은 실패한다', () => {
    // Given
    const nickname = '가나다라마바사아자차카타파'
    // When
    const result = isValidNickname(nickname)
    // Then
    expect(result).toBe(false)
  })

  it('공백으로만 2자를 채우면 실패한다', () => {
    // Given
    const nickname = ' 캐 '
    // When
    const result = isValidNickname(nickname)
    // Then
    expect(result).toBe(false)
  })
})
