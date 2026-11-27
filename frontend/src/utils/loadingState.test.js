import { describe, expect, it } from 'vitest'
import { toLoading } from './loadingState'

describe('toLoading', () => {
  it('다 받은 결과를 보여 준 뒤 다시 받으면 이전 목록을 남기고 hasShown이 true다', () => {
    // Given
    const prev = { status: 'done', items: [] }
    // When
    const next = toLoading(prev)
    // Then
    expect(next).toEqual({ status: 'loading', items: [], hasShown: true })
  })

  it('처음 받는 중이면 hasShown이 false다', () => {
    expect(toLoading({ status: 'loading', items: [] }).hasShown).toBe(false)
  })

  it('실패 뒤 다시 받으면 hasShown이 false다', () => {
    expect(toLoading({ status: 'error', items: [] }).hasShown).toBe(false)
  })

  it('받는 중에 또 다시 받아도 hasShown을 그대로 둔다', () => {
    expect(toLoading({ status: 'loading', items: [1], hasShown: true }).hasShown).toBe(true)
  })
})
