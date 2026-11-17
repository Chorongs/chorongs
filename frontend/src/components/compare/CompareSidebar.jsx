import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useCompareStore, { getCompareBlock } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, IconButton, SlotBadge } from '../../styles/common'
import { formatRate } from '../../utils/format'
import Icon from '../ui/Icon'

// CP-07 비교할 상품 고르기: 비교 화면에서 바로 상품 채우기 (구역마다 3개씩 쪽 넘김 + 건수). 모양은 시안과 같게 접었다 펴는 구역
// 카드를 누르면 빈 칸에 먼저, 둘 다 차 있으면 B를 바꿈. 이미 있는 상품 → '이미 A에 있어요' 알림
// 다른 한 상품과 자금 용도나 상환 방식이 안 겹치는 카드는 흐리게 + '용도가(상환 방식이) 달라 비교 불가', 누르면 안 담고 경고 (E15)
// 찜, 최근 본은 회원만: 요청이 401이면 그 구역을 숨긴다. 목록을 못 받으면 그 구역만 실패 문구 (E3). 구역이 모두 비면 사이드바째 숨김
// 판매 종료, 숨김 상품은 목록에서 뺀다 (관리자가 상태를 바꾸면 안 나옴, 상태 ON만 보임)
// TODO(ST-01, CHORONG-43): useAuthStore가 올라오면 status가 'member'일 때만 찜을 요청한다. (지금은 401로 비회원을 알아냄) 비회원이 요청하면 401로 로그인 안내 창이 열리니 그때 회원일 때만 요청하게 바꾼다.
// TODO(MEM-08, CHORONG-42): 최근 본은 비회원도 보게 하는 규칙(11-17 결정)이라, 서버가 비회원에게도 200을 주면 401로 숨기던 것을 없앤다.
// TODO(ST-02, CHORONG-43): useMyStore의 likedIds가 올라오면 찜이 바뀔 때 찜 구역을 다시 받는다. (지금은 열 때 한 번)
// TODO(ST-03, CHORONG-45): '추천 상품' 구역 (useRecommendStore의 result.items, 카드에 '일치도 N%' 딱지, 비회원도 가능, 새 API 없음)을 찜 구역 위에 넣는다. (일치도 딱지 모양은 test-compare 브랜치의 CompareSidebar에 만들어 둠)
const PAGE_SIZE = 3

const Wrap = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  /* 좁은 화면(1180 미만)에서는 판정 요약과 비교표 사이에 들어가므로 위아래 간격 */
  @media (max-width: 1179px) {
    margin: 28px 0;
  }
`

const Title = styled.h2`
  font-size: var(--fs-lg);
  font-weight: 800;
`

const Hint = styled.p`
  margin-top: -8px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const Group = styled.details`
  overflow: hidden;
  border: 1px solid var(--line-2);
  border-radius: var(--r-lg);
  background: var(--paper);
  & > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    font-size: var(--fs-lg);
    font-weight: 800;
    list-style: none;
    cursor: pointer;
    &::-webkit-details-marker {
      display: none;
    }
    small {
      margin-left: 8px;
      color: var(--muted);
      font-family: var(--f-num);
      font-size: var(--fs-md);
      font-weight: 800;
    }
    [data-icon] {
      flex: none;
      color: var(--muted);
      transition: transform var(--t-pop);
    }
  }
  &[open] > summary {
    background: var(--mist);
    [data-icon] {
      transform: rotate(180deg);
    }
  }
`

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 12px;
  list-style: none;
  @media (max-width: 1179px) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Card = styled.button.attrs({ type: 'button' })`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  opacity: ${({ $isNo }) => ($isNo ? 0.5 : 1)};
  transition: border-color var(--t-fast), background-color var(--t-fast);
  &:hover {
    border-color: var(--cocoa);
  }
  ${({ $slot }) =>
    $slot
      ? `
    --ab: ${$slot === 'B' ? 'var(--viz-1)' : 'var(--viz-2)'};
    border-color: var(--ab);
    box-shadow: 0 0 0 1px var(--ab);
    background: color-mix(in srgb, var(--ab) 8%, var(--paper));
  `
      : ''}
`

const Org = styled.span`
  padding-right: ${({ $isOn }) => ($isOn ? '80px' : '0')};
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 700;
`

const Name = styled.b`
  font-size: var(--fs-md);
  font-weight: 800;
  line-height: 1.4;
`

const Meta = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`

const Rate = styled.span`
  color: var(--brand-text);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-weight: 800;
`

const On = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--ab);
  font-size: var(--fs-xs);
  font-weight: 800;
`

const No = styled.span`
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 700;
`

const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 12px 12px;
  span {
    color: var(--cocoa);
    font-size: var(--fs-sm);
    font-weight: 800;
  }
`

const Flip = styled.span`
  display: inline-flex;
  transform: rotate(180deg);
`

// 판매 종료(CLOSED), 숨김(HIDDEN) 상품은 비교할 수 없으니 빼고 게시(ON) 상품만 둔다.
const isOnProduct = (product) => Boolean(product) && product.productStatus === 'ON'

// 구역 하나의 목록 받기: { status: loading / ok / error / guest (401), items: 상품 요약 목록 }
function useSectionData(load) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    let isCancelled = false
    load()
      .then((data) => {
        if (isCancelled) return
        const items = (data?.items ?? []).map((item) => item.product).filter(isOnProduct)
        setState({ status: 'ok', items })
      })
      .catch((error) => {
        if (isCancelled) return
        setState({ status: error.response?.status === 401 ? 'guest' : 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [load, attempt])

  const retry = () => {
    setState({ status: 'loading', items: [] })
    setAttempt((count) => count + 1)
  }

  return [state, retry]
}

function isShown(state) {
  return state.status === 'loading' || state.status === 'error' || (state.status === 'ok' && state.items.length > 0)
}

function getRateText(product) {
  const { rateMin, rateMax } = product
  if (rateMin == null && rateMax == null) return '금리는 기관 문의'
  const low = formatRate(rateMin ?? rateMax)
  const high = formatRate(rateMax ?? rateMin)
  return low === high ? `${low}%` : `${low} ~ ${high}%`
}

function SectionBox({ title, state, onRetry, pair, otherProduct, onPick }) {
  const [page, setPage] = useState(0)
  const { status, items } = state
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visibleItems = items.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <Group open>
      <summary>
        <span>
          {title}
          {status === 'ok' && <small>{items.length}</small>}
        </span>
        <Icon name="chevron_down" />
      </summary>
      {status === 'loading' && (
        <List>
          <li>
            <EmptyBox role="status">불러오는 중이에요</EmptyBox>
          </li>
        </List>
      )}
      {status === 'error' && (
        <List>
          <li>
            <EmptyBox>
              목록을 불러오지 못했어요
              <Button $size="sm" $variant="outline" onClick={onRetry}>
                다시 시도
              </Button>
            </EmptyBox>
          </li>
        </List>
      )}
      {status === 'ok' && (
        <>
          <List>
            {visibleItems.map((product) => {
              const slot = pair[0] === product.productId ? 'A' : pair[1] === product.productId ? 'B' : null
              const block = !slot && otherProduct ? getCompareBlock(product, otherProduct) : null
              const isNo = block !== null
              return (
                <li key={product.productId}>
                  <Card $slot={slot} $isNo={isNo} aria-pressed={Boolean(slot)} onClick={() => onPick(product)}>
                    <Org $isOn={Boolean(slot)}>{product.companyName}</Org>
                    <Name>{product.productName}</Name>
                    <Meta>
                      <Rate>{getRateText(product)}</Rate>
                    </Meta>
                    {slot && (
                      <On>
                        <SlotBadge $slot={slot} $size={20}>
                          {slot}
                        </SlotBadge>
                        선택 중
                      </On>
                    )}
                    {isNo && <No>{block === 'method' ? '상환 방식이 달라 비교 불가' : '용도가 달라 비교 불가'}</No>}
                  </Card>
                </li>
              )
            })}
          </List>
          {pageCount > 1 && (
            <Pager>
              <IconButton aria-label={`${title} 이전 쪽`} disabled={current === 0} onClick={() => setPage(current - 1)}>
                <Flip>
                  <Icon name="chevron_right" size={16} />
                </Flip>
              </IconButton>
              <span>
                {current + 1} / {pageCount}
              </span>
              <IconButton
                aria-label={`${title} 다음 쪽`}
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
              >
                <Icon name="chevron_right" size={16} />
              </IconButton>
            </Pager>
          )}
        </>
      )}
    </Group>
  )
}

// slotProducts: { A, B } 비교 화면 칸의 상품 상세 (없거나 숨김이면 null) / onPicked: 상품을 넣은 뒤 부르는 함수 (좁은 화면에서 결과로 스크롤)
function CompareSidebar({ slotProducts, onPicked }) {
  const pair = useCompareStore((state) => state.pair)
  const putPair = useCompareStore((state) => state.putPair)
  const canCompare = useCompareStore((state) => state.canCompare)
  const showToast = useUiStore((state) => state.showToast)
  const [likes, retryLikes] = useSectionData(myApi.getLikes)
  const [recents, retryRecents] = useSectionData(myApi.getRecentViews)

  if (!isShown(likes) && !isShown(recents)) return null

  // 새 상품이 들어갈 칸: 빈 칸 먼저, 둘 다 차 있으면 B / 그때 남는 다른 한 상품
  const targetSlot = pair[0] === null ? 'A' : 'B'
  const otherProduct = targetSlot === 'A' ? slotProducts.B : slotProducts.A

  const handlePick = (product) => {
    const slot = pair[0] === product.productId ? 'A' : pair[1] === product.productId ? 'B' : null
    if (slot) {
      showToast(`이미 ${slot}에 있어요`)
      return
    }
    if (otherProduct && !canCompare(product, otherProduct)) {
      const reason = getCompareBlock(product, otherProduct) === 'method' ? '상환 방식이' : '자금 용도가'
      showToast(`${reason} 겹치지 않아 ${otherProduct.productName} 상품과 비교할 수 없어요`)
      return
    }
    const hadProduct = targetSlot === 'B' && pair[1] !== null
    putPair(product.productId)
    showToast(hadProduct ? `B를 ${product.productName}(으)로 바꿨어요` : `${targetSlot}에 넣었어요`)
    onPicked?.()
  }

  return (
    <Wrap aria-label="비교할 상품 고르기">
      <Title>비교할 상품 고르기</Title>
      <Hint>누르면 빈 칸에 먼저 넣고, 둘 다 차 있으면 B를 바꿔요.</Hint>
      {isShown(likes) && (
        <SectionBox
          title="찜한 대출"
          state={likes}
          onRetry={retryLikes}
          pair={pair}
          otherProduct={otherProduct}
          onPick={handlePick}
        />
      )}
      {isShown(recents) && (
        <SectionBox
          title="최근 본 상품"
          state={recents}
          onRetry={retryRecents}
          pair={pair}
          otherProduct={otherProduct}
          onPick={handlePick}
        />
      )}
    </Wrap>
  )
}

export default CompareSidebar
