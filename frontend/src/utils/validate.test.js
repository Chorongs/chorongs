import { describe, expect, it } from 'vitest'
import {
  getMonthsOptions,
  isBlank,
  isLengthInRange,
  isNumberInRange,
  isValidIncome,
  isValidMonths,
  isValidNeed,
  isValidNickname,
} from './validate'

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

describe('isValidIncome', () => {
  it('연소득 0만원은 통과한다', () => {
    // Given
    const income = 0
    // When
    const result = isValidIncome(income)
    // Then
    expect(result).toBe(true)
  })

  it('연소득 99,999만원은 통과한다', () => {
    // Given
    const income = 99999
    // When
    const result = isValidIncome(income)
    // Then
    expect(result).toBe(true)
  })

  it('연소득 100,000만원은 실패한다', () => {
    // Given
    const income = 100000
    // When
    const result = isValidIncome(income)
    // Then
    expect(result).toBe(false)
  })

  it('연소득이 비어 있으면 실패한다', () => {
    // Given
    const income = null
    // When
    const result = isValidIncome(income)
    // Then
    expect(result).toBe(false)
  })
})

describe('isValidNeed', () => {
  it('필요 금액 10만원은 통과한다', () => {
    // Given
    const need = 10
    // When
    const result = isValidNeed(need)
    // Then
    expect(result).toBe(true)
  })

  it('필요 금액 9만원은 실패한다', () => {
    // Given
    const need = 9
    // When
    const result = isValidNeed(need)
    // Then
    expect(result).toBe(false)
  })

  it('필요 금액 10억원(100,000만원)은 통과한다', () => {
    // Given
    const need = 100000
    // When
    const result = isValidNeed(need)
    // Then
    expect(result).toBe(true)
  })

  it('필요 금액이 10억원을 넘으면 실패한다', () => {
    // Given
    const need = 100001
    // When
    const result = isValidNeed(need)
    // Then
    expect(result).toBe(false)
  })
})

describe('getMonthsOptions', () => {
  it('전월세는 60, 120, 180개월이다', () => {
    // Given
    const purpose = '전월세'
    // When
    const result = getMonthsOptions(purpose)
    // Then
    expect(result).toEqual([60, 120, 180])
  })

  it('주택 구입은 60, 120, 180개월이다', () => {
    // Given
    const purpose = '주택 구입'
    // When
    const result = getMonthsOptions(purpose)
    // Then
    expect(result).toEqual([60, 120, 180])
  })

  it('생활비는 12, 36, 60개월이다', () => {
    // Given
    const purpose = '생활비'
    // When
    const result = getMonthsOptions(purpose)
    // Then
    expect(result).toEqual([12, 36, 60])
  })
})

describe('isValidMonths', () => {
  it('잘 모르겠어요(0)는 어느 용도에서나 통과한다', () => {
    // Given
    const purpose = '전월세'
    // When
    const result = isValidMonths(purpose, 0)
    // Then
    expect(result).toBe(true)
  })

  it('전월세에서 120개월은 통과한다', () => {
    // Given
    const purpose = '전월세'
    // When
    const result = isValidMonths(purpose, 120)
    // Then
    expect(result).toBe(true)
  })

  it('생활비에서 120개월은 선택지에 없어 실패한다', () => {
    // Given
    const purpose = '생활비'
    // When
    const result = isValidMonths(purpose, 120)
    // Then
    expect(result).toBe(false)
  })

  it('기간을 고르지 않으면(null) 실패한다', () => {
    // Given
    const purpose = '생활비'
    // When
    const result = isValidMonths(purpose, null)
    // Then
    expect(result).toBe(false)
  })
})
