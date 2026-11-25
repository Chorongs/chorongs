import { useState } from 'react'
import styled from 'styled-components'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, IconButton, StatusText, Tag } from '../../styles/common'
import ConfirmDialog from '../common/ConfirmDialog'
import SectionHeader from '../common/SectionHeader'
import Checkbox from '../ui/Checkbox'
import Icon from '../ui/Icon'

// MY-03 MY 구역 틀: 제목 / 설명 / 오른쪽 [고르기] '지우기'(전체) / 목록(줄마다 X) 또는 빈 상태
// 줄 X → 확인 창 → onRemove(item) + '{구역 이름}에서 지웠어요' / '지우기' → 확인 창 → onClearAll() + '{구역 이름}을(를) 지웠어요'
// (줄 X도 실수로 지우지 않게 항상 확인 창, 회원 관리 기획서 3-7)
// [고르기] → 줄마다 체크칸 → [N개 지우기] → 확인 창 → 고른 기록을 한 건씩 차례로 onRemove (서버는 한 건 지우기만 있음)
//   + '{구역 이름}에서 N개를 지웠어요' / 하나라도 실패하면 거기서 멈추고 알림 (지운 것까지는 목록에서 빠짐) / [취소] → 고르기 끝
// title이 구역 이름 (최근 본 대출, 최근 검색, 비교 내역, 저장한 추천 결과, 계산 기록. MY 계산 기록 칩 안에서는 '{칩 이름} 계산 기록')
// onRemove, onClearAll을 안 넘기면 X, [고르기], '지우기'를 안 그림 (찜한 대출) / isInline: 줄 대신 칩처럼 옆으로 (최근 검색)
// status: 'loading' 불러오는 중 / 'error' 실패 문구 + [다시 시도] (E3) / 'done' 목록 또는 빈 상태 (E11)
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

// 고르는 중 줄 앞 체크칸 자리 (체크칸은 공통 Checkbox(UI-12), 칸 이름은 화면 낭독기용으로만)
const SelectSpot = styled.div`
  flex: none;
  ${({ $isInline }) => !$isInline && 'margin-top: 10px;'}
`

// 화면에는 안 보이고 화면 낭독기만 읽는 글
const ScreenReaderText = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`

// 제목 줄 오른쪽 버튼 묶음
const HeadActions = styled.div`
  display: flex;
  gap: 4px;
`

const Item = styled.li`
  display: flex;
  align-items: ${({ $isInline }) => ($isInline ? 'center' : 'flex-start')};
  gap: ${({ $isInline }) => ($isInline ? '0' : '8px')};
  ${({ $isInline }) => !$isInline && 'padding-top: 8px;'}
`

// 고르는 중에는 줄을 눌러도 체크만 바뀜 (손가락 모양)
const ItemBody = styled.div`
  flex: 1;
  min-width: 0;
  ${({ $isSelecting }) => $isSelecting && 'cursor: pointer;'}
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
  // 여러 개 골라 지우기: 고르는 중인지 / 고른 기록의 getKey 값 / 확인 창
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState([])
  const [isSelectConfirmOpen, setIsSelectConfirmOpen] = useState(false)
  // 지금 목록에 남아 있는 것만 (지운 기록, 다시 불러온 목록에 없는 기록은 빠짐)
  const selectedItems = items.filter((item) => selectedKeys.includes(getKey(item)))

  const stopSelecting = () => {
    setIsSelecting(false)
    setSelectedKeys([])
  }

  const toggleSelect = (key) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((one) => one !== key) : [...prev, key]))
  }

  // 고르는 중 줄 안을 누르면 원래 동작(상세 창, 이동, 찜 등)을 막고 체크만 바꿈 (잡는 단계에서 막아 안쪽 버튼까지 안 감)
  const handleSelectClick = (event, key) => {
    event.preventDefault()
    event.stopPropagation()
    toggleSelect(key)
  }

  const handleRemoveSelected = async () => {
    setIsPending(true)
    let removedCount = 0
    try {
      for (const item of selectedItems) {
        await onRemove(item)
        removedCount += 1
      }
      showToast(`${title}에서 ${removedCount}개를 지웠어요`)
      stopSelecting()
    } catch (error) {
      if (error.response?.status !== 401) showToast('지우지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSelectConfirmOpen(false)
      setIsPending(false)
    }
  }

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
            {isSelecting && (
              <SelectSpot $isInline={isInline}>
                <Checkbox
                  checked={selectedKeys.includes(getKey(item))}
                  onChange={() => toggleSelect(getKey(item))}
                  label={<ScreenReaderText>{`${getItemLabel(item)} 고르기`}</ScreenReaderText>}
                />
              </SelectSpot>
            )}
            <ItemBody
              $isSelecting={isSelecting}
              onClickCapture={isSelecting ? (event) => handleSelectClick(event, getKey(item)) : undefined}
            >
              {renderItem(item)}
            </ItemBody>
            {onRemove && !isSelecting && (
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
        {(onRemove || onClearAll) && status === 'done' && items.length > 0 && (
          <HeadActions>
            {isSelecting ? (
              <>
                <Button $size="sm" $variant="ghost" onClick={stopSelecting}>
                  취소
                </Button>
                <Button $size="sm" onClick={() => setIsSelectConfirmOpen(true)} disabled={selectedItems.length === 0}>
                  {selectedItems.length}개 지우기
                </Button>
              </>
            ) : (
              <>
                {onRemove && (
                  <Button $size="sm" $variant="ghost" onClick={() => setIsSelecting(true)}>
                    고르기
                  </Button>
                )}
                {onClearAll && (
                  <Button $size="sm" $variant="ghost" onClick={() => setIsConfirmOpen(true)}>
                    지우기
                  </Button>
                )}
              </>
            )}
          </HeadActions>
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

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        label={`${title} 지우기`}
        title={`${withObjectParticle(title)} 모두 지울까요?`}
        confirmLabel="지우기"
        onConfirm={handleClearAll}
        isConfirmDisabled={isPending}
      />
      <ConfirmDialog
        isOpen={isSelectConfirmOpen}
        onClose={() => setIsSelectConfirmOpen(false)}
        label={`${title}에서 고른 기록 지우기`}
        title={`고른 기록 ${selectedItems.length}개를 지울까요?`}
        confirmLabel="지우기"
        onConfirm={handleRemoveSelected}
        isConfirmDisabled={isPending || selectedItems.length === 0}
      />
      <ConfirmDialog
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        label={`${title}에서 지우기`}
        title="이 기록을 지울까요?"
        confirmLabel="지우기"
        onConfirm={() => handleRemove(removeTarget)}
        isConfirmDisabled={isPending}
      >
        {removeTarget !== null && <DialogTarget>{getItemLabel(removeTarget)}</DialogTarget>}
      </ConfirmDialog>
    </section>
  )
}

export default MySection
