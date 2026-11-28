import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { toLoading } from '../../utils/loadingState'
import ProductRow from '../common/ProductRow'
import MySection, { ProductStatusTag } from './MySection'

// MY-05 최근 본 대출 (최근 상세 연 상품 10개): 상품 목록 (줄마다 X) / [선택 삭제] [전체 삭제]
// 줄 X → API-21 DELETE /{productId} / [전체 삭제] → API-21 DELETE (전체) / 알림은 MySection (MY-03)
// 판매 종료 → '판매 종료', 숨긴 상품 → '지금은 볼 수 없는 상품' 딱지 (목록에서 빼지 않음)
const StatusLine = styled.div`
  display: flex;
  gap: 6px;
`

function RecentList() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    let isCancelled = false
    myApi
      .getRecentViews()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [] })
      })
      .catch(() => {
        if (!isCancelled) setResult({ status: 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [attempt])

  // 다시 받기 ([다시 시도], 이미 지워진 기록을 지우려 했을 때): 보여 준 목록이 있으면 받는 동안 흐리게 남김
  const reload = () => {
    setResult(toLoading)
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    await myApi.deleteRecentView(item.product.productId)
    setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one.product.productId !== item.product.productId) }))
  }

  const handleClearAll = async () => {
    await myApi.deleteRecentViews()
    setResult({ status: 'done', items: [] })
  }

  return (
    <MySection
      title="최근 본 대출"
      itemName="상품"
      description="상세 창을 연 상품을 최근 10개까지 보여 줘요."
      status={result.status}
      hasShown={result.hasShown}
      onRetry={reload}
      onReload={reload}
      items={result.items}
      getKey={(item) => item.product.productId}
      getItemLabel={(item) => item.product.productName}
      renderItem={(item) => (
        <>
          <StatusLine>
            <ProductStatusTag product={item.product} />
          </StatusLine>
          <ProductRow product={item.product} />
        </>
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="최근 본 대출이 없어요"
    />
  )
}

export default RecentList
