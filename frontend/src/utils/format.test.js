import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPrepayFee,
  formatRange,
  formatRate,
  formatRateRange,
  formatTagValues,
  formatTime,
  getTodayText,
} from './format'

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

describe('formatPrepayFee', () => {
  it('0이면 없음', () => {
    // Given
    const value = 0
    // When
    const result = formatPrepayFee(value)
    // Then
    expect(result).toBe('없음')
  })

  it('숫자면 최대 n%', () => {
    // Given
    const value = 1.5
    // When
    const result = formatPrepayFee(value)
    // Then
    expect(result).toBe('최대 1.50%')
  })

  it('값이 없으면 기관 문의', () => {
    // Given
    const value = null
    // When
    const result = formatPrepayFee(value)
    // Then
    expect(result).toBe('기관 문의')
  })
})

describe('formatRange', () => {
  it('둘 다 있으면 a ~ b', () => {
    // Given
    const min = 19
    const max = 34
    // When
    const result = formatRange(min, max, '만 ', '세')
    // Then
    expect(result).toBe('만 19세 ~ 만 34세')
  })

  it('최소만 있으면 이상', () => {
    // Given
    const min = 600
    // When
    const result = formatRange(min, null, '', '점')
    // Then
    expect(result).toBe('600점 이상')
  })

  it('둘 다 없으면 정보 없음', () => {
    // Given
    const min = null
    // When
    const result = formatRange(min, null)
    // Then
    expect(result).toBe('정보 없음')
  })
})

describe('formatRateRange', () => {
  it('최소, 최대 금리가 다르면 범위로 보인다', () => {
    // Given
    const rateMin = 3.5
    const rateMax = 5.2
    // When
    const result = formatRateRange(rateMin, rateMax)
    // Then
    expect(result).toBe(`${formatRate(3.5)} ~ ${formatRate(5.2)}%`)
  })

  it('한쪽만 있으면 그 값 하나만 보인다', () => {
    // Given
    const rateMin = 4
    // When
    const result = formatRateRange(rateMin, null)
    // Then
    expect(result).toBe(`${formatRate(4)}%`)
  })

  it('둘 다 없으면 기관 문의로 보인다', () => {
    // Given
    const rateMin = null
    // When
    const result = formatRateRange(rateMin, null)
    // Then
    expect(result).toBe('금리는 기관 문의')
  })
})

describe('formatTagValues', () => {
  it('같은 종류 태그 값을 쉼표로 잇는다', () => {
    // Given
    const product = { tags: [{ tagType: 'REPAY', tagValue: '원리금균등' }, { tagType: 'TARGET', tagValue: '청년' }, { tagType: 'REPAY', tagValue: '만기일시' }] }
    // When
    const result = formatTagValues(product, 'REPAY')
    // Then
    expect(result).toBe('원리금균등, 만기일시')
  })

  it('그 종류 태그가 없으면 정보 없음이다', () => {
    // Given
    const product = { tags: [] }
    // When
    const result = formatTagValues(product, 'REPAY')
    // Then
    expect(result).toBe('정보 없음')
  })
})

describe('getTodayText', () => {
  it('한 자리 달, 날짜는 0을 붙여 YYYY-MM-DD로 만든다', () => {
    // Given
    const today = new Date(2026, 0, 5)
    // When
    const result = getTodayText(today)
    // Then
    expect(result).toBe('2026-01-05')
  })
})

describe('formatTime', () => {
  it('날짜와 시각 글에서 시:분만 꺼낸다', () => {
    // Given
    const value = '2026-11-19T14:32:10'
    // When
    const result = formatTime(value)
    // Then
    expect(result).toBe('14:32')
  })

  it('형식이 다르면 -를 돌려준다', () => {
    // Given
    const value = '14:32'
    // When
    const result = formatTime(value)
    // Then
    expect(result).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('날짜와 시각을 점 날짜와 시:분으로 보여 준다', () => {
    // Given
    const value = '2026-11-19T14:32:10'
    // When
    const result = formatDateTime(value)
    // Then
    expect(result).toBe('2026.11.19 14:32')
  })

  it('시각이 없으면 날짜만 보여 준다', () => {
    // Given
    const value = '2026-11-19'
    // When
    const result = formatDateTime(value)
    // Then
    expect(result).toBe('2026.11.19')
  })
})
