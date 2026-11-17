import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useUiStore from '../../store/useUiStore'
import { Button, Tag } from '../../styles/common'
import ProductRow from '../common/ProductRow'
import MySection from './MySection'

// MY-04 찜한 대출 (최대 30개): 상품 목록, 쪽 나눔 (E7) / 빈 상태 '맞춤 추천 받기'
// 찜 취소는 줄의 하트(LikeButton)로 함 (X, 지우기 없음)
// 판매 종료 → '판매 종료', 숨긴 상품 → '지금은 볼 수 없는 상품' 딱지 (목록에서 빼지 않음)
// TODO(API-20, CHORONG-42 BE): 찜 API는 오늘 서버 범위 밖. 응답 칸 이름 확정 후 맞춤 (지금은 develop 공통 PageInfo { list, total, page, size } 기준)
// TODO(ST-03, CHORONG-45 김채희): '맞춤 추천 받기'는 LY-05 '캐링 추천'과 같음. useRecommendStore의 result가 올라오면 hasResult를 result 유무로 바꾼다.
const PAGE_SIZE = 20

const StatusLine = styled.div`
  display: flex;
  gap: 6px;
`

function ProductStatusTag({ product }) {
  if (product.productStatus === 'CLOSED') return <Tag $variant="warn">판매 종료</Tag>
  if (product.productStatus === 'HIDDEN') return <Tag>지금은 볼 수 없는 상품</Tag>
  return null
}

function LikedList() {
  const openRecommend = useUiStore((state) => state.openRecommend)
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [], total: 0 })
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  const hasResult = false

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

  // 추천받기 전이면 추천 창 열기, 받은 뒤면 /recommend 이동 (LY-05)
  const handleRecommend = () => {
    if (hasResult) navigate('/recommend')
    else openRecommend()
  }

  return (
    <MySection
      title="찜한 대출"
      description="찜은 30개까지 할 수 있어요."
      status={result.status}
      onRetry={handleRetry}
      items={result.items}
      getKey={(item) => item.product.productId}
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
