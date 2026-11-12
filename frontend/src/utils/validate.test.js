import { describe, expect, it } from 'vitest'
import {
  getAboutMeError,
  getCreditError,
  getMoneyError,
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

const validAboutMe = { job: 'OFFICE', ageGroup: 'YOUTH', income: 3000, debtMonthly: 0, debtUnknown: false }
const validMoney = { purpose: '생활비', need: 500, months: 36 }
const validCredit = { creditBand: 'BAND3', overdue: false, priorities: ['LOW_RATE'] }

describe('getAboutMeError', () => {
  it('모두 채우면 null이다', () => {
    // Given
    const input = { ...validAboutMe }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result).toBeNull()
  })

  it('직업을 안 골랐으면 job 칸이 걸린다', () => {
    // Given
    const input = { ...validAboutMe, job: null }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result.field).toBe('job')
  })

  it('나이를 안 골랐으면 ageGroup 칸이 걸린다', () => {
    // Given
    const input = { ...validAboutMe, ageGroup: null }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result.field).toBe('ageGroup')
  })

  it('연소득이 99,999를 넘으면 income 칸이 걸린다', () => {
    // Given
    const input = { ...validAboutMe, income: 100000 }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result.field).toBe('income')
  })

  it('기존 대출을 비워 두면 debt 칸이 걸린다', () => {
    // Given
    const input = { ...validAboutMe, debtMonthly: null }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result.field).toBe('debt')
  })

  it('기존 대출을 잘 모르겠어요(debtUnknown)로 고르면 통과한다', () => {
    // Given
    const input = { ...validAboutMe, debtMonthly: null, debtUnknown: true }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result).toBeNull()
  })

  it('칸이 여러 개 틀리면 먼저 나오는 칸(job)이 걸린다', () => {
    // Given
    const input = { ...validAboutMe, job: null, income: -1 }
    // When
    const result = getAboutMeError(input)
    // Then
    expect(result.field).toBe('job')
  })
})

describe('getMoneyError', () => {
  it('모두 채우면 null이다', () => {
    // Given
    const input = { ...validMoney }
    // When
    const result = getMoneyError(input)
    // Then
    expect(result).toBeNull()
  })

  it('용도를 안 골랐으면 purpose 칸이 걸린다', () => {
    // Given
    const input = { ...validMoney, purpose: null }
    // When
    const result = getMoneyError(input)
    // Then
    expect(result.field).toBe('purpose')
  })

  it('필요 금액이 10만원 미만이면 need 칸이 걸린다', () => {
    // Given
    const input = { ...validMoney, need: 9 }
    // When
    const result = getMoneyError(input)
    // Then
    expect(result.field).toBe('need')
  })

  it('기간을 안 골랐으면 months 칸이 걸린다', () => {
    // Given
    const input = { ...validMoney, months: null }
    // When
    const result = getMoneyError(input)
    // Then
    expect(result.field).toBe('months')
  })

  it('기간을 잘 모르겠어요(0)로 고르면 통과한다', () => {
    // Given
    const input = { ...validMoney, months: 0 }
    // When
    const result = getMoneyError(input)
    // Then
    expect(result).toBeNull()
  })
})

describe('getCreditError', () => {
  it('모두 채우면 null이다', () => {
    // Given
    const input = { ...validCredit }
    // When
    const result = getCreditError(input)
    // Then
    expect(result).toBeNull()
  })

  it('신용 구간을 안 골랐으면 creditBand 칸이 걸린다', () => {
    // Given
    const input = { ...validCredit, creditBand: null }
    // When
    const result = getCreditError(input)
    // Then
    expect(result.field).toBe('creditBand')
  })

  it('연체 여부를 안 골랐으면 overdue 칸이 걸린다', () => {
    // Given
    const input = { ...validCredit, overdue: null }
    // When
    const result = getCreditError(input)
    // Then
    expect(result.field).toBe('overdue')
  })

  it('가장 중요한 것을 하나도 안 골랐으면 priorities 칸이 걸린다', () => {
    // Given
    const input = { ...validCredit, priorities: [] }
    // When
    const result = getCreditError(input)
    // Then
    expect(result.field).toBe('priorities')
  })

  it('가장 중요한 것을 4개 고르면 priorities 칸이 걸린다', () => {
    // Given
    const input = { ...validCredit, priorities: ['A', 'B', 'C', 'D'] }
    // When
    const result = getCreditError(input)
    // Then
    expect(result.field).toBe('priorities')
  })
})
