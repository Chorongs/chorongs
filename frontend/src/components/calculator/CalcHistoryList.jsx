import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button, IconButton } from '../../styles/common'
import { HOME_REGIONS } from '../../utils/finance'
import { formatDate, formatMoney, formatRate } from '../../utils/format'
import { toLoading } from '../../utils/loadingState'
import { CALC_METHODS } from '../../utils/loanMath'
import { getGoneText, isGoneError, REMOVE_FAIL_TEXT } from '../../utils/removeText'
import ConfirmDialog from '../common/ConfirmDialog'
import MySection, { RecordRow } from '../my/MySection'
import Icon from '../ui/Icon'

// CA-07 계산 기록 목록: 저장한 기록 줄 / [불러오기] / 줄마다 X / [선택 삭제] [전체 삭제] (API-24, API-56부터 API-59까지)
// 목록 틀(제목, 삭제 확인 창, 불러오는 중, 실패, 빈 상태)과 기록 한 줄(RecordRow)은 MY의 MySection(MY-03)을 다시 씀 (삭제는 확인 창 뒤에, E3, E11)
// - 비회원: API를 부르지 않고 '로그인하면 저장 가능' 문구만 (확인 중에는 아무것도 안 그림)
// - 기록 줄: 위 굵은 글 main(item) / 아래 작은 글 subs(item) (빈 값은 빼고 쉼표로 이음) + 저장 시각 / [불러오기]
// - [불러오기]: onLoad(item)이 있으면 그 화면이 처리 (계산기 화면)
//   없으면 그 계산기 주소(/calc 등)로 이동하며 값을 넘김 (MY 계산 기록): stateKeys가 있으면 그 칸만 (입력값만, 결과는 계산기가 다시 계산, CA-01), 없으면 기록 한 줄 그대로
// - 삭제 확인 창의 기록 이름: '{위 굵은 글}, {저장 시각} 저장' (MY-10)
// - title: 구역 이름 (기본 '계산 기록'. MY 계산 기록 칩 안에서는 '{칩 이름} 계산 기록', MY-03)
// - refreshKey: 바뀌면 목록을 다시 받음 (계산기에서 [결과 저장] 뒤)
// - kind: 어느 계산기의 기록인지 (LOAN 대출 이자 API-24, CHANGE 갈아타기 API-56, DSR API-57, REVERSE 상환능력 API-58, HOME 집 살 때 대출한도 API-59). 처음 값 LOAN
// - initialItems: 기억해 둔 목록이 있으면 '불러오는 중' 대신 그 목록으로 시작하고 서버에서 다시 받아 바꿈 (계산기 탭을 옮길 때 칸이 비지 않게)
// - onItemsChange(items): 목록을 받거나 지울 때마다 알림 (다시 받기가 실패하면 undefined = 기억해 둔 목록을 버림)
// - isOnlyWithItems: 저장한 기록이 있을 때만 그림 (계산기 화면 오른쪽 칸, CalculatorPage). 비회원, 불러오는 중, 실패, 빈 목록이면 아무것도 안 그림
//   모양은 대출 비교의 '비교할 상품 고르기'(CP-07 CompareSidebar)와 같게: 접었다 펴는 상자 ('{계산기 이름} 계산 기록' + 건수, 위 제목 없음) / 카드 3개씩 쪽 넘김. 카드를 누르면 불러오기
//   카드마다 X (MY와 같이 확인 창 뒤에 삭제, MySection과 같은 알림 글). 전체 삭제는 계산기 화면에 두지 않음 (MY에만)
const METHOD_LABEL = Object.fromEntries(CALC_METHODS.map((method) => [method.code, method.label]))
const REGION_LABEL = Object.fromEntries(HOME_REGIONS.map((region) => [region.code, region.label]))

// 계산기별 이름 (오른쪽 칸 상자 제목), 목록 API, 기록 번호 칸, [불러오기]로 갈 계산기 주소, MY에서 넘길 입력 칸, 줄에 보일 글 (main: 위 굵은 글, subs: 아래 작은 글 목록)
// 대출 이자 외 4개의 줄 글은 MY-10 명세서 '줄 모양'을 따름
// 대출 이자는 기록 한 줄을 그대로 넘김 (옵션 칸까지 받음, CA-01). 맞지 않는 값은 계산기가 무시
const KINDS = {
  LOAN: {
    name: '대출 이자',
    getList: myApi.getCalcs,
    remove: myApi.deleteCalc,
    clearAll: myApi.deleteCalcs,
    idKey: 'calcId',
    path: '/calc',
    stateKeys: null,
    main: (item) => `${formatMoney(item.loanAmount, '원')}, ${item.loanMonths}개월, 연 ${formatRate(item.interestRate)}%`,
    subs: (item) => [
      METHOD_LABEL[item.repayMethod],
      item.graceMonths > 0 && `거치 ${item.graceMonths}개월`,
      `총이자 ${formatMoney(item.totalInterest, '원')}`,
    ],
  },
  CHANGE: {
    name: '대출 갈아타기',
    getList: myApi.getChangeCalcs,
    remove: myApi.deleteChangeCalc,
    clearAll: myApi.deleteChangeCalcs,
    idKey: 'changeId',
    path: '/calc/change',
    stateKeys: [
      'currentRepayMethod',
      'currentBalance',
      'currentRate',
      'currentMonths',
      'newRepayMethod',
      'newRate',
      'newMonths',
      'feeRate',
      'etcCost',
    ],
    // savingAmount: 더 내면 음수
    main: (item) =>
      item.savingAmount >= 0
        ? `갈아타면 ${formatMoney(item.savingAmount, '원')} 아껴요`
        : `${formatMoney(-item.savingAmount, '원')} 더 내요`,
    subs: (item) => [`지금 ${formatRate(item.currentRate)}%에서 ${formatRate(item.newRate)}%`],
  },
  DSR: {
    name: 'DSR',
    getList: myApi.getDsrCalcs,
    remove: myApi.deleteDsrCalc,
    clearAll: myApi.deleteDsrCalcs,
    idKey: 'dsrId',
    path: '/calc/dsr',
    stateKeys: ['annualIncome', 'loans'],
    main: (item) => `DSR ${formatRate(item.dsrRate)}%`,
    subs: (item) => [`대출 ${item.loans?.length ?? 0}건`, `연소득 ${formatMoney(item.annualIncome, '원')}`],
  },
  REVERSE: {
    name: '상환능력 기반 대출',
    getList: myApi.getReverseCalcs,
    remove: myApi.deleteReverseCalc,
    clearAll: myApi.deleteReverseCalcs,
    idKey: 'reverseId',
    path: '/calc/reverse',
    stateKeys: ['repayMethod', 'monthlyPayment', 'interestRate', 'loanMonths'],
    main: (item) => `매달 ${formatMoney(item.monthlyPayment, '원')}`,
    subs: (item) => [
      `연 ${formatRate(item.interestRate)}%`,
      `${item.loanMonths}개월`,
      `최대 ${formatMoney(item.maxLoan, '원')}`,
    ],
  },
  HOME: {
    name: '집 살 때 대출한도',
    getList: myApi.getHomeCalcs,
    remove: myApi.deleteHomeCalc,
    clearAll: myApi.deleteHomeCalcs,
    idKey: 'homeId',
    path: '/calc/home',
    stateKeys: [
      'housePrice',
      'homeRegion',
      'firstHome',
      'annualIncome',
      'otherInterest',
      'otherLoans',
      'interestRate',
      'rateType',
      'loanYears',
    ],
    main: (item) => `집값 ${formatMoney(item.housePrice, '원')}`,
    subs: (item) => [REGION_LABEL[item.homeRegion], `최대 한도 ${formatMoney(item.maxLoan, '원')}`],
  },
}

// 아래 작은 글 (빈 값은 빼고 쉼표로 이음)
const getSubText = (config, item) => config.subs(item).filter(Boolean).join(', ')

// 삭제 확인 창, 버튼 이름에 쓰는 기록 이름
const getItemLabel = (config, item) => `${config.main(item)}, ${formatDate(item.calcAt)} 저장`

const Guest = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const GuestTitle = styled.h2`
  font-size: var(--fs-h4);
  font-weight: 800;
`

const GuestText = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-md);
`

// ----- 계산기 화면 오른쪽 칸 모양 (CP-07 CompareSidebar와 같은 값) -----
const RAIL_PAGE_SIZE = 3

const RailWrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  /* 좁은 화면(1180 미만)에서는 오른쪽 칸이 본문 아래로 내려가므로 위 간격 */
  @media (max-width: 1179px) {
    margin-top: 40px;
  }
`

const RailGroup = styled.details`
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

const RailList = styled.ul`
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

// 카드와 X를 겹쳐 두는 칸 (버튼 안에 버튼을 넣지 않으려고 X는 카드 옆 형제로 두고 위치만 겹침)
const RailItem = styled.li`
  position: relative;
`

const RailCard = styled.button.attrs({ type: 'button' })`
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  padding: 12px 44px 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--t-fast), background-color var(--t-fast);
  &:hover {
    border-color: var(--cocoa);
  }
`

const RailDate = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 700;
`

const RailName = styled.b`
  font-size: var(--fs-md);
  font-weight: 800;
  line-height: 1.4;
`

const RailSub = styled.span`
  color: var(--brand-text);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-weight: 800;
`

const RailRemove = styled(IconButton)`
  position: absolute;
  top: 6px;
  right: 6px;
`

const RailPager = styled.div`
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

const RailFlip = styled.span`
  display: inline-flex;
  transform: rotate(180deg);
`

// 삭제 확인 창 안 기록 이름
const DialogTarget = styled.p`
  margin: -12px 0 20px;
  color: var(--cocoa);
  font-size: var(--fs-md);
`

// 계산기 화면 오른쪽 칸의 계산 기록 (items가 1개 이상일 때만 그려짐): 카드를 누르면 onLoad(item), X는 확인 창 뒤에 onRemove
// 이미 지워진 기록(404)은 MySection과 같이 '이미 삭제한 계산 기록이에요' + 창 닫기 + onReload()
function CalcHistoryRail({ config, items, onLoad, onRemove, onReload }) {
  const showToast = useUiStore((state) => state.showToast)
  const [page, setPage] = useState(0)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [isPending, setIsPending] = useState(false)
  const pageCount = Math.max(1, Math.ceil(items.length / RAIL_PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visibleItems = items.slice(current * RAIL_PAGE_SIZE, current * RAIL_PAGE_SIZE + RAIL_PAGE_SIZE)
  // 상자 제목 (예: '대출 이자 계산 기록'). 삭제 알림 글에도 씀 (MySection과 같은 '{구역 이름}에서 삭제했어요')
  const groupTitle = `${config.name} 계산 기록`

  // 삭제: 요청 → 알림, 창 닫기 / 실패하면 알림 (401은 로그인 안내 창이 뜨므로 알림 안 함, MySection과 같음)
  const handleRemove = async () => {
    setIsPending(true)
    try {
      await onRemove(removeTarget)
      showToast(`${groupTitle}에서 삭제했어요`)
      setRemoveTarget(null)
    } catch (error) {
      if (isGoneError(error)) {
        showToast(getGoneText('계산 기록'))
        setRemoveTarget(null)
        onReload()
      } else if (error.response?.status !== 401) showToast(REMOVE_FAIL_TEXT)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <RailWrap aria-label={groupTitle}>
      <RailGroup open>
        <summary>
          <span>
            {groupTitle}
            <small>{items.length}</small>
          </span>
          <Icon name="chevron_down" />
        </summary>
        <RailList>
          {visibleItems.map((item) => (
            <RailItem key={item[config.idKey]}>
              <RailCard onClick={() => onLoad(item)} aria-label={`${getItemLabel(config, item)} 불러오기`}>
                <RailDate>{formatDate(item.calcAt)}</RailDate>
                <RailName>{config.main(item)}</RailName>
                <RailSub>{getSubText(config, item)}</RailSub>
              </RailCard>
              <RailRemove aria-label={`${getItemLabel(config, item)} 삭제`} disabled={isPending} onClick={() => setRemoveTarget(item)}>
                <Icon name="close" size={16} />
              </RailRemove>
            </RailItem>
          ))}
        </RailList>
        {pageCount > 1 && (
          <RailPager>
            <IconButton aria-label={`${groupTitle} 이전 쪽`} disabled={current === 0} onClick={() => setPage(current - 1)}>
              <RailFlip>
                <Icon name="chevron_right" size={16} />
              </RailFlip>
            </IconButton>
            <span>
              {current + 1} / {pageCount}
            </span>
            <IconButton
              aria-label={`${groupTitle} 다음 쪽`}
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              <Icon name="chevron_right" size={16} />
            </IconButton>
          </RailPager>
        )}
      </RailGroup>

      <ConfirmDialog
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        label="계산 기록 삭제 확인"
        title="이 계산 기록을 삭제할까요?"
        confirmLabel="삭제"
        onConfirm={handleRemove}
        isConfirmDisabled={isPending}
      >
        {removeTarget !== null && <DialogTarget>{getItemLabel(config, removeTarget)}</DialogTarget>}
      </ConfirmDialog>
    </RailWrap>
  )
}

function CalcHistoryList({
  onLoad,
  refreshKey = 0,
  kind = 'LOAN',
  title = '계산 기록',
  isOnlyWithItems = false,
  initialItems,
  onItemsChange,
}) {
  const config = KINDS[kind] ?? KINDS.LOAN
  const navigate = useNavigate()
  const authStatus = useAuthStore((state) => state.status)
  const isMember = authStatus === 'member'
  const [attempt, setAttempt] = useState(0)
  // result.kind: 지금 보여 주는 줄이 어느 계산기 기록인지 (MY에서 칩을 바꾼 뒤 새 목록이 올 때까지 이전 줄을 그 모양대로 흐리게 둠, E7)
  const [result, setResult] = useState(() =>
    initialItems ? { status: 'done', items: initialItems, kind } : { status: 'loading', items: [], kind },
  )
  if (!isOnlyWithItems && result.kind !== kind && result.status !== 'loading') setResult(toLoading)
  const itemConfig = KINDS[result.kind] ?? config

  useEffect(() => {
    if (!isMember) return undefined
    let isCancelled = false
    config
      .getList()
      .then((data) => {
        if (isCancelled) return
        const items = data?.items ?? []
        setResult({ status: 'done', items, kind })
        onItemsChange?.(items)
      })
      .catch(() => {
        if (isCancelled) return
        setResult({ status: 'error', items: [], kind })
        onItemsChange?.(undefined)
      })
    return () => {
      isCancelled = true
    }
  }, [isMember, attempt, refreshKey, config, kind, onItemsChange])

  // 다시 받기 ([다시 시도], 이미 지워진 기록을 지우려 했을 때)
  // MY 목록은 보여 준 목록이 있으면 받는 동안 흐리게 남김 / 계산기 화면 칸은 'done'이 아니면 사라지므로 상태를 그대로 두고 새 목록으로 바꿈
  const reload = () => {
    if (!isOnlyWithItems) setResult(toLoading)
    setAttempt((count) => count + 1)
  }

  // 목록에서 빼기는 직전 상태(prev)에서: [선택 삭제]가 같은 함수를 연달아 불러도 먼저 지운 줄이 되살아나지 않음
  // onItemsChange(계산기 화면 칸)는 한 건씩만 지우므로 지금 목록에서 뺀 값을 알림
  const handleRemove = async (item) => {
    const { idKey } = itemConfig
    await itemConfig.remove(item[idKey])
    setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one[idKey] !== item[idKey]) }))
    onItemsChange?.(result.items.filter((one) => one[idKey] !== item[idKey]))
  }

  const handleClearAll = async () => {
    await itemConfig.clearAll()
    setResult((prev) => ({ ...prev, status: 'done', items: [] }))
    onItemsChange?.([])
  }

  const handleLoad = (item) => {
    if (onLoad) {
      onLoad(item)
      return
    }
    const state = itemConfig.stateKeys ? Object.fromEntries(itemConfig.stateKeys.map((key) => [key, item[key]])) : item
    navigate(itemConfig.path, { state })
  }

  if (authStatus === 'checking') return null
  if (isOnlyWithItems) {
    if (!isMember || result.status !== 'done' || result.items.length === 0) return null
    return <CalcHistoryRail config={config} items={result.items} onLoad={handleLoad} onRemove={handleRemove} onReload={reload} />
  }

  if (!isMember) {
    return (
      <Guest>
        <GuestTitle>{title}</GuestTitle>
        <GuestText>로그인하면 저장 가능</GuestText>
      </Guest>
    )
  }

  // key: 칩을 바꾸면 고르는 중, 열린 확인 창은 새로 시작 (이전 목록은 result로 흐리게 남음)
  return (
    <MySection
      key={kind}
      title={title}
      itemName="계산 기록"
      description="[결과 저장]을 누른 기록이에요."
      status={result.status}
      hasShown={result.hasShown}
      onRetry={reload}
      onReload={reload}
      items={result.items}
      getKey={(item) => item[itemConfig.idKey]}
      getItemLabel={(item) => getItemLabel(itemConfig, item)}
      renderItem={(item) => (
        <RecordRow
          main={itemConfig.main(item)}
          sub={[getSubText(itemConfig, item), formatDate(item.calcAt)].filter(Boolean).join(', ')}
          action={
            <Button $size="sm" $variant="outline" onClick={() => handleLoad(item)}>
              불러오기
            </Button>
          }
        />
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="저장한 계산 기록이 없어요"
    />
  )
}

export default CalcHistoryList
