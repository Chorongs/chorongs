import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { Button, Tag } from '../../styles/common'
import { formatDate } from '../../utils/format'
import ProductRow from '../common/ProductRow'
import MySection from './MySection'

// MY-08 저장한 추천 결과 (10개): 저장 시점, 조건 라벨, 상품 / '결과 다시 보기' / 삭제
// '결과 다시 보기' → 그때 상품을 최신 정보로 펼쳐 보임 (서버가 지금 상품 정보를 줌, API-38 GET)
// 삭제 → 줄 X 그 저장 1건, 지우기 전체 (API-38 DELETE) / 알림은 MySection (MY-03)
// 판매 끝난 상품 → '판매 종료', 숨긴 상품 → '지금은 볼 수 없는 상품' / 예상 금리, 월 상환 같은 개인 수치는 다시 안 보여줌
const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 2px;
  border-bottom: 1px solid var(--line);
`

const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const Label = styled.p`
  font-weight: 800;
`

const Meta = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Products = styled.ol`
  border-top: 1px solid var(--line);
  container-type: inline-size;
  container-name: plist;
`

const StatusLine = styled.div`
  display: flex;
  gap: 6px;
  padding-top: 8px;
`

function ProductStatusTag({ product }) {
  if (product.productStatus === 'CLOSED') return <Tag $variant="warn">판매 종료</Tag>
  if (product.productStatus === 'HIDDEN') return <Tag>지금은 볼 수 없는 상품</Tag>
  return null
}

function SavedRecList() {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let isCancelled = false
    myApi
      .getSavedRecommends()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.saves ?? [] })
      })
      .catch(() => {
        if (!isCancelled) setResult({ status: 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [attempt])

  const handleRetry = () => {
    setResult({ status: 'loading', items: [] })
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    await myApi.deleteSavedRecommend(item.saveId)
    setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one.saveId !== item.saveId) }))
  }

  const handleClearAll = async () => {
    await myApi.deleteSavedRecommend()
    setResult({ status: 'done', items: [] })
  }

  const renderItem = (save) => {
    const isOpen = openId === save.saveId
    const products = [...(save.products ?? [])].sort((a, b) => a.rankNo - b.rankNo)
    return (
      <Card>
        <Top>
          <div>
            <Label>{save.conditionLabel}</Label>
            <Meta>
              {formatDate(save.createdAt)} 저장 · 상품 {products.length}개
            </Meta>
          </div>
          <Button $size="sm" $variant="outline" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : save.saveId)}>
            {isOpen ? '접기' : '결과 다시 보기'}
          </Button>
        </Top>
        {isOpen && (
          <Products>
            {products.map((one) => (
              <li key={one.product.productId}>
                <StatusLine>
                  <Tag $variant="acc">{one.rankNo}위</Tag>
                  <ProductStatusTag product={one.product} />
                </StatusLine>
                <ProductRow product={one.product} />
              </li>
            ))}
          </Products>
        )}
      </Card>
    )
  }

  return (
    <MySection
      title="저장한 추천 결과"
      description="저장한 추천 결과를 10개까지 보관해요. 상품은 지금 정보로 보여 줘요."
      status={result.status}
      onRetry={handleRetry}
      items={result.items}
      getKey={(save) => save.saveId}
      getItemLabel={(save) => save.conditionLabel}
      renderItem={renderItem}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="저장한 추천 결과가 없어요"
    />
  )
}

export default SavedRecList
