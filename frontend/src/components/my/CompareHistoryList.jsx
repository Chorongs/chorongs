import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useCompareStore from '../../store/useCompareStore'
import { Button } from '../../styles/common'
import { formatDate } from '../../utils/format'
import MySection, { ProductStatusTag } from './MySection'

// MY-07 비교 내역 (저장한 비교 10개): A vs B / '다시 비교' / 줄마다 X / [선택 삭제] [전체 삭제]
// 줄 X → API-23 DELETE /{compareId} (404면 목록 다시 불러옴) / [전체 삭제] → API-23 DELETE (전체) / 알림은 MySection (MY-03)
// 판매 종료, 숨긴 상품이 있으면 딱지 + 안내
// '다시 비교' → useCompareStore.setPair(productA.productId, productB.productId) 후 /compare (ST-04)
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 2px;
  border-bottom: 1px solid var(--line);
`

const Pair = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Names = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-weight: 800;
`

const Versus = styled.span`
  color: var(--muted);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-weight: 900;
`

const Meta = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Warn = styled.span`
  color: var(--warn);
  font-size: var(--fs-sm);
  font-weight: 600;
`

function ProductName({ product }) {
  return (
    <>
      {product.companyName} {product.productName}
      <ProductStatusTag product={product} />
    </>
  )
}

function CompareHistoryList() {
  const navigate = useNavigate()
  const setPair = useCompareStore((state) => state.setPair)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })

  // '다시 비교': 비교 화면 두 칸을 이 조합으로 채우고 이동 (MY-07)
  const handleCompareAgain = (item) => {
    setPair(item.productA.productId, item.productB.productId)
    navigate('/compare')
  }

  useEffect(() => {
    let isCancelled = false
    myApi
      .getCompares()
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

  // 다시 받을 때 이전 줄을 남김 (받는 동안 MySection이 흐리게 둠)
  const reload = () => {
    setResult((prev) => ({ ...prev, status: 'loading' }))
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    try {
      await myApi.deleteCompare(item.compareId)
      setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one.compareId !== item.compareId) }))
    } catch (error) {
      // 이미 지워진 기록이면 목록을 다시 받음 (API-23)
      if (error.response?.status === 404) reload()
      else throw error
    }
  }

  const handleClearAll = async () => {
    await myApi.deleteCompares()
    setResult({ status: 'done', items: [] })
  }

  const renderItem = (item) => {
    const hasUnavailable = [item.productA, item.productB].some((product) => product.productStatus !== 'ON')
    return (
      <Row>
        <Pair>
          <Names>
            <ProductName product={item.productA} />
            <Versus>vs</Versus>
            <ProductName product={item.productB} />
          </Names>
          <Meta>{formatDate(item.comparedAt)} 저장</Meta>
          {hasUnavailable && <Warn>판매가 끝났거나 지금은 볼 수 없는 상품이 있어요</Warn>}
        </Pair>
        <Button $size="sm" $variant="outline" onClick={() => handleCompareAgain(item)}>
          다시 비교
        </Button>
      </Row>
    )
  }

  return (
    <MySection
      title="비교 내역"
      itemName="비교 내역"
      description="저장한 비교를 최근 10개까지 보여 줘요."
      status={result.status}
      onRetry={reload}
      items={result.items}
      getKey={(item) => item.compareId}
      getItemLabel={(item) => `${item.productA.productName} vs ${item.productB.productName}`}
      renderItem={renderItem}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="저장한 비교 내역이 없어요"
    />
  )
}

export default CompareHistoryList
