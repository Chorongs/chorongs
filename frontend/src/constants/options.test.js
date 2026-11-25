import { describe, expect, it } from 'vitest'
import { getRankingHint, getTermOptions, readRankingParams } from './options'

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

describe('readRankingParams', () => {
  it('주소에 값이 없으면 금리순, 낮은 순, 전체', () => {
    // Given
    const params = { cat: null, metric: null, dir: null }
    // When
    const result = readRankingParams(params)
    // Then
    expect(result).toEqual({ cat: '', metric: 'rate', dir: 'asc' })
  })

  it('정해진 값이면 그대로 쓴다', () => {
    // Given
    const params = { cat: '은행권', metric: 'limit', dir: 'asc' }
    // When
    const result = readRankingParams(params)
    // Then
    expect(result).toEqual({ cat: '은행권', metric: 'limit', dir: 'asc' })
  })

  it('metric만 있으면 순서는 그 기준의 기본값 (인기순은 높은 순)', () => {
    // Given
    const params = { cat: null, metric: 'views', dir: null }
    // When
    const result = readRankingParams(params)
    // Then
    expect(result).toEqual({ cat: '', metric: 'views', dir: 'desc' })
  })

  it('정해진 값이 아니면 기본값으로 바꾼다', () => {
    // Given
    const params = { cat: '<script>', metric: 'price', dir: 'up' }
    // When
    const result = readRankingParams(params)
    // Then
    expect(result).toEqual({ cat: '', metric: 'rate', dir: 'asc' })
  })

  it("cat이 '전체'이면 빈 값", () => {
    // Given
    const params = { cat: '전체', metric: 'term', dir: 'desc' }
    // When
    const result = readRankingParams(params)
    // Then
    expect(result.cat).toBe('')
  })
})

describe('getRankingHint', () => {
  it('금리순 낮은 순이면 기준 설명 뒤에 같은 값일 때 규칙이 붙는다', () => {
    // Given
    const metric = 'rate'
    const dir = 'asc'
    // When
    const result = getRankingHint(metric, dir)
    // Then
    expect(result).toBe('최저 금리가 낮은 순서예요. 금리가 같으면 캐링에서 많이 본 상품이 먼저 나와요')
  })

  it('인기순은 같은 값일 때 규칙이 붙지 않는다', () => {
    // Given
    const metric = 'views'
    const dir = 'desc'
    // When
    const result = getRankingHint(metric, dir)
    // Then
    expect(result).toBe('캐링에서 많이 본 순서예요 (상세 보기 조회수)')
  })

  it('기본이 아닌 순서면 반대 설명', () => {
    // Given
    const metric = 'limit'
    const dir = 'asc'
    // When
    const result = getRankingHint(metric, dir)
    // Then
    expect(result).toContain('최대 한도가 낮은 순서예요')
  })
})
