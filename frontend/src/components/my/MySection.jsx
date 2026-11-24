import { useState } from 'react'
import styled from 'styled-components'
import { PREPARING_TEXT } from '../../api/axiosInstance'
import useUiStore from '../../store/useUiStore'
import { Button, DialogActions, DialogText, EmptyBox, IconButton, StatusText, Tag } from '../../styles/common'
import SectionHeader from '../common/SectionHeader'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

// MY-03 MY 구역 틀: 제목 / 설명 / 오른쪽 '지우기'(전체) / 목록(줄마다 X) 또는 빈 상태
// 줄 X → 확인 창 → onRemove(item) + '{구역 이름}에서 지웠어요' / '지우기' → 확인 창 → onClearAll() + '{구역 이름}을(를) 지웠어요'
// (줄 X도 실수로 지우지 않게 항상 확인 창, 회원 관리 기획서 3-7)
// title이 구역 이름 (최근 본 대출, 최근 검색, 비교 내역, 저장한 추천 결과, 계산 기록)
// onRemove, onClearAll을 안 넘기면 X, '지우기'를 안 그림 (찜한 대출) / isInline: 줄 대신 칩처럼 옆으로 (최근 검색)
// status: 'loading' 불러오는 중 / 'error' 실패 문구 + [다시 시도] (E3) / 'preparing' 서버 API가 아직 없음 → '아직 준비 중인 서비스예요' (E3) / 'done' 목록 또는 빈 상태 (E11)
// 많으면 [더 보기] (E7): hasMore, onMore, isMoreLoading
// 상품 줄(ProductRow)이 목록 폭에 맞춰 바뀌도록 ProductList와 같은 이름(plist)으로 폭을 잼
const List = styled.ul`
  display: flex;
  flex-direction: ${({ $isInline }) => ($isInline ? 'row' : 'column')};
  flex-wrap: wrap;
  gap: ${({ $isInline }) => ($isInline ? '8px' : '0')};
  border-top: ${({ $isInline }) => ($isInline ? '0' : '1px solid var(--line)')};
  container-type: inline-size;
  container-name: plist;
`

const Item = styled.li`
  display: flex;
  align-items: ${({ $isInline }) => ($isInline ? 'center' : 'flex-start')};
  gap: ${({ $isInline }) => ($isInline ? '0' : '8px')};
  ${({ $isInline }) => !$isInline && 'padding-top: 8px;'}
`

const ItemBody = styled.div`
  flex: 1;
  min-width: 0;
`

const More = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`

// 지울 기록 이름 (확인 창 안, 길면 2줄에서 자름)
const DialogTarget = styled.p`
  display: -webkit-box;
  overflow: hidden;
  margin: -12px 0 20px;
  color: var(--cocoa);
  font-size: var(--fs-md);
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

// 상품 상태 딱지 (MY 상품 목록이 같이 씀): 판매 종료 → '판매 종료', 숨긴 상품 → '지금은 볼 수 없는 상품', 게시 중이면 없음
export function ProductStatusTag({ product }) {
  if (product.productStatus === 'CLOSED') return <Tag $variant="warn">판매 종료</Tag>
  if (product.productStatus === 'HIDDEN') return <Tag>지금은 볼 수 없는 상품</Tag>
  return null
}

// 받침이 있으면 '을', 없으면 '를' (한글이 아닌 글자로 끝나면 '을(를)')
function withObjectParticle(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return `${word}을(를)`
  return `${word}${code % 28 === 0 ? '를' : '을'}`
}

function MySection({
  title,
  description,
  status,
  onRetry,
  items = [],
  getKey,
  getItemLabel,
  renderItem,
  onRemove,
  onClearAll,
  emptyContent,
  isInline = false,
  hasMore = false,
  onMore,
  isMoreLoading = false,
}) {
  const showToast = useUiStore((state) => state.showToast)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  // 줄 X로 지울 기록 (null이면 확인 창 닫힘)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [isPending, setIsPending] = useState(false)

  const handleRemove = async (item) => {
    setIsPending(true)
    try {
      await onRemove(item)
      showToast(`${title}에서 지웠어요`)
      setRemoveTarget(null)
    } catch (error) {
      if (error.response?.status !== 401) showToast('지우지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  const handleClearAll = async () => {
    setIsPending(true)
    try {
      await onClearAll()
      showToast(`${withObjectParticle(title)} 지웠어요`)
      setIsConfirmOpen(false)
    } catch (error) {
      if (error.response?.status !== 401) showToast('지우지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  let body
  if (status === 'loading') {
    body = <StatusText role="status">불러오는 중이에요</StatusText>
  } else if (status === 'preparing') {
    body = <EmptyBox>{PREPARING_TEXT}</EmptyBox>
  } else if (status === 'error') {
    body = (
      <EmptyBox>
        {withObjectParticle(title)} 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={onRetry}>
          다시 시도
        </Button>
      </EmptyBox>
    )
  } else if (items.length === 0) {
    body = <EmptyBox>{emptyContent}</EmptyBox>
  } else {
    body = (
      <List $isInline={isInline}>
        {items.map((item) => (
          <Item key={getKey(item)} $isInline={isInline}>
            <ItemBody>{renderItem(item)}</ItemBody>
            {onRemove && (
              <IconButton aria-label={`${getItemLabel(item)} 지우기`} onClick={() => setRemoveTarget(item)} disabled={isPending}>
                <Icon name="close" size={16} />
              </IconButton>
            )}
          </Item>
        ))}
      </List>
    )
  }

  return (
    <section>
      <SectionHeader title={title} description={description} size="md">
        {onClearAll && status === 'done' && items.length > 0 && (
          <Button $size="sm" $variant="ghost" onClick={() => setIsConfirmOpen(true)}>
            지우기
          </Button>
        )}
      </SectionHeader>

      {body}

      {hasMore && status === 'done' && (
        <More>
          <Button $variant="outline" onClick={onMore} disabled={isMoreLoading}>
            {isMoreLoading ? '불러오는 중' : '더 보기'}
          </Button>
        </More>
      )}

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label={`${title} 지우기`} width={380} showClose={false}>
        <DialogText>{withObjectParticle(title)} 모두 지울까요?</DialogText>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(false)}>
            취소
          </Button>
          <Button onClick={handleClearAll} disabled={isPending}>
            지우기
          </Button>
        </DialogActions>
      </Modal>

      <Modal isOpen={removeTarget !== null} onClose={() => setRemoveTarget(null)} label={`${title}에서 지우기`} width={380} showClose={false}>
        <DialogText>이 기록을 지울까요?</DialogText>
        {removeTarget !== null && <DialogTarget>{getItemLabel(removeTarget)}</DialogTarget>}
        <DialogActions>
          <Button $variant="outline" onClick={() => setRemoveTarget(null)}>
            취소
          </Button>
          <Button onClick={() => handleRemove(removeTarget)} disabled={isPending}>
            지우기
          </Button>
        </DialogActions>
      </Modal>
    </section>
  )
}

export default MySection
