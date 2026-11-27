import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useMyStore from '../../store/useMyStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import ProductRow from '../common/ProductRow'
import MySection, { ProductStatusTag } from './MySection'

// MY-04 찜한 대출 (최대 30개): 상품 목록, 쪽 나눔 (E7) / 빈 상태 '맞춤 추천 받기'
// 찜 취소는 줄의 하트(LikeButton)로 한 개씩, 또는 [선택 삭제]로 여러 개를 골라 한 번에 (MY-03, 줄 X와 [전체 삭제]는 없음: X는 하트와 겹치고, 찜은 일부러 모은 것이라 한 번에 다 지우는 버튼은 두지 않음)
// [선택 삭제]로 고른 상품: 아직 찜 상태면 찜 취소(API-20 DELETE, 상단 찜 개수도 같이 줄어듦), 하트로 이미 취소한 상품은 목록에서만 뺌
// 판매 종료 → '판매 종료', 숨긴 상품 → '지금은 볼 수 없는 상품' 딱지 (목록에서 빼지 않음)
// 찜 목록 응답은 공통 PageInfo { list, total, page, size }
// '맞춤 추천 받기'는 LY-05 '캐링 추천'과 같음: 추천받기 전이면 추천 창, 받은 뒤면 /recommend (hasResult = useRecommendStore result 유무)
const PAGE_SIZE = 20

const StatusLine = styled.div`
  display: flex;
  gap: 6px;
`

function LikedList() {
  const openRecommend = useUiStore((state) => state.openRecommend)
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [], total: 0 })
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  const hasResult = useRecommendStore((state) => state.result !== null)

  useEffect(() => {
    let isCancelled = false
    myApi
      .getLikes({ page, size: PAGE_SIZE })
      .then((data) => {
        if (isCancelled) return
        setResult((prev) => ({
          status: 'done',
          items: page === 1 ? (data?.list ?? []) : [...prev.items, ...(data?.list ?? [])],
          total: data?.total ?? 0,
        }))
      })
      .catch(() => {
        // 더 보기 실패는 받은 목록을 그대로 두고 [더 보기]만 다시 누를 수 있게
        if (!isCancelled) setResult((prev) => (page === 1 ? { status: 'error', items: [], total: 0 } : prev))
      })
      .finally(() => {
        if (!isCancelled) setIsMoreLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [page, attempt])

  const handleRetry = () => {
    setResult({ status: 'loading', items: [], total: 0 })
    setPage(1)
    setAttempt((count) => count + 1)
  }

  const handleMore = () => {
    setIsMoreLoading(true)
    setPage((current) => current + 1)
  }

  const handleRemove = async (item) => {
    const id = item.product.productId
    const { likedIds, toggleLike } = useMyStore.getState()
    if (likedIds.includes(id)) await toggleLike(id)
    setResult((prev) => ({
      ...prev,
      items: prev.items.filter((one) => one.product.productId !== id),
      total: Math.max(0, prev.total - 1),
    }))
  }

  // 추천받기 전이면 추천 창 열기, 받은 뒤면 /recommend 이동 (LY-05)
  const handleRecommend = () => {
    if (hasResult) navigate('/recommend')
    else openRecommend()
  }

  return (
    <MySection
      title="찜한 대출"
      itemName="찜"
      removeWord="취소"
      description="찜은 30개까지 할 수 있어요."
      status={result.status}
      onRetry={handleRetry}
      items={result.items}
      getKey={(item) => item.product.productId}
      getItemLabel={(item) => item.product.productName}
      onRemove={handleRemove}
      hasRowRemove={false}
      renderItem={(item) => (
        <>
          <StatusLine>
            <ProductStatusTag product={item.product} />
          </StatusLine>
          <ProductRow product={item.product} />
        </>
      )}
      emptyContent={
        <>
          아직 찜한 대출이 없어요
          <Button $size="sm" $variant="outline" onClick={handleRecommend}>
            맞춤 추천 받기
          </Button>
        </>
      }
      hasMore={result.items.length < result.total}
      onMore={handleMore}
      isMoreLoading={isMoreLoading}
    />
  )
}

export default LikedList
