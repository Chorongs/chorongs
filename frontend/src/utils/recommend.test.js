import { describe, expect, it } from 'vitest'
import { getCalcState } from './recommend'

// 테스트용 추천 항목: 한도 1,000만원, 최대 60개월, 예상 금리 2.0~3.0
const makeItem = (productChanges = {}, itemChanges = {}) => ({
  product: { limitAmount: 1000, termMax: 60, tags: [], ...productChanges },
  estRateMin: 2,
  estRateMax: 3,
  ...itemChanges,
})

describe('getCalcState 금액', () => {
  it('필요 금액이 한도보다 작으면 필요 금액을 원으로 넘긴다', () => {
    // Given
    const item = makeItem()
    const lastInput = { need: 500, months: 36 }
    // When
    const result = getCalcState(item, lastInput)
    // Then
    expect(result.loanAmount).toBe(5000000)
  })

  it('필요 금액이 한도보다 크면 한도를 원으로 넘긴다', () => {
    // Given
    const item = makeItem()
    const lastInput = { need: 3000, months: 36 }
    // When
    const result = getCalcState(item, lastInput)
    // Then
    expect(result.loanAmount).toBe(10000000)
  })

  it('추천받은 조건이 없으면 한도를 원으로 넘긴다', () => {
    // Given
    const item = makeItem()
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result.loanAmount).toBe(10000000)
  })

  it('한도가 숫자가 아니면 필요 금액을 원으로 넘긴다', () => {
    // Given
    const item = makeItem({ limitAmount: null })
    const lastInput = { need: 3000, months: 36 }
    // When
    const result = getCalcState(item, lastInput)
    // Then
    expect(result.loanAmount).toBe(30000000)
  })

  it('필요 금액도 한도도 없으면 금액을 넘기지 않는다', () => {
    // Given
    const item = makeItem({ limitAmount: null })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result).not.toHaveProperty('loanAmount')
  })
})

describe('getCalcState 기간', () => {
  it('갚을 기간이 최대 기간보다 짧으면 갚을 기간을 넘긴다', () => {
    // Given
    const item = makeItem({ termMax: 60 })
    const lastInput = { need: 500, months: 36 }
    // When
    const result = getCalcState(item, lastInput)
    // Then
    expect(result.loanMonths).toBe(36)
  })

  it('갚을 기간이 최대 기간보다 길면 최대 기간을 넘긴다', () => {
    // Given
    const item = makeItem({ termMax: 24 })
    const lastInput = { need: 500, months: 36 }
    // When
    const result = getCalcState(item, lastInput)
    // Then
    expect(result.loanMonths).toBe(24)
  })

  it("갚을 기간이 '잘 모르겠어요'(0)이면 기간을 넘기지 않는다", () => {
    // Given
    const item = makeItem()
    const lastInput = { need: 500, months: 0 }
    // When
    const result = getCalcState(item, lastInput)
    // Then
    expect(result).not.toHaveProperty('loanMonths')
  })
})

describe('getCalcState 금리', () => {
  it('예상 금리 가운데 값을 넘긴다', () => {
    // Given
    const item = makeItem({}, { estRateMin: 2, estRateMax: 3 })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result.interestRate).toBe(2.5)
  })

  it('예상 금리가 한쪽만 있으면 그 값을 넘긴다', () => {
    // Given
    const item = makeItem({}, { estRateMin: 4.5, estRateMax: null })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result.interestRate).toBe(4.5)
  })

  it('예상 금리가 없으면 금리를 넘기지 않는다', () => {
    // Given
    const item = makeItem({}, { estRateMin: null, estRateMax: null })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result).not.toHaveProperty('interestRate')
  })
})

describe('getCalcState 상환 방식', () => {
  it('상환 방식이 만기일시뿐이면 BULLET을 넘긴다', () => {
    // Given
    const item = makeItem({ tags: [{ tagType: 'REPAY', tagValue: '만기일시' }] })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result.repayMethod).toBe('BULLET')
  })

  it('상환 방식이 여러 개면 EQUAL_PI를 넘긴다', () => {
    // Given
    const item = makeItem({
      tags: [
        { tagType: 'REPAY', tagValue: '원리금균등' },
        { tagType: 'REPAY', tagValue: '만기일시' },
      ],
    })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result.repayMethod).toBe('EQUAL_PI')
  })

  it('상환 방식 태그가 없으면 EQUAL_PI를 넘긴다', () => {
    // Given
    const item = makeItem({ tags: undefined })
    // When
    const result = getCalcState(item, null)
    // Then
    expect(result.repayMethod).toBe('EQUAL_PI')
  })
})
