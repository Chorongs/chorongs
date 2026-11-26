import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button, IconButton } from '../../styles/common'
import { HOME_REGIONS } from '../../utils/finance'
import { formatDate, formatMoney, formatRate } from '../../utils/format'
import { CALC_METHODS } from '../../utils/loanMath'
import MySection from '../my/MySection'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

// CA-07 계산 기록 목록: 저장한 기록 줄 / [불러오기] / 줄마다 지우기 / 전체 지우기 (API-24)
// 목록 틀(제목, 지우기 확인 창, 불러오는 중, 실패, 빈 상태)은 MY의 MySection(MY-03)을 다시 씀 (삭제는 확인 창 뒤에, E3, E11)
// - 비회원: API를 부르지 않고 '로그인하면 저장 가능' 문구만 (확인 중에는 아무것도 안 그림)
// - [불러오기]: onLoad(item)이 있으면 그 화면이 처리 (계산기 화면). 없으면 그 계산기 주소(/calc 등)로 이동하며 기록 한 줄을 넘김 (MY 계산 기록)
// - refreshKey: 바뀌면 목록을 다시 받음 (계산기에서 [결과 저장] 뒤)
// - kind: 어느 계산기의 기록인지 (LOAN 대출 이자 API-24, CHANGE 갈아타기 API-56, DSR API-57, REVERSE 상환능력 API-58, HOME 집 살 때 대출한도 API-59). 처음 값 LOAN
// - isOnlyWithItems: 저장한 기록이 있을 때만 그림 (계산기 화면 오른쪽 칸, CalculatorPage). 비회원, 불러오는 중, 실패, 빈 목록이면 아무것도 안 그림 (2026-11-26 사용자 결정)
//   모양은 대출 비교의 '비교할 상품 고르기'(CP-07 CompareSidebar)와 같게: 제목 + 안내 / 접었다 펴는 상자 (건수) / 카드 3개씩 쪽 넘김. 카드를 누르면 불러오기
//   카드마다 X (지우기), 상자 아래 '전체 지우기'. 지우기는 MY와 같이 확인 창 뒤에 (MySection과 같은 알림 글)
// TODO(API-24, CHORONG-48 BE): 계산 기록 API가 아직 서버에 없어 지금은 '준비 중' 안내 (axiosInstance PREPARING_APIS 목록). 서버가 올라오면 그 목록 줄만 지우면 그대로 동작
const METHOD_LABEL = Object.fromEntries(CALC_METHODS.map((method) => [method.code, method.label]))
const REGION_LABEL = Object.fromEntries(HOME_REGIONS.map((region) => [region.code, region.label]))

// 계산기별 이름 (오른쪽 칸 상자 제목), 목록 API, 기록 번호 칸, [불러오기]로 갈 계산기 주소, 줄에 보일 글 (main: 굵은 첫 줄, sub: 둘째 줄, 저장 시각은 공통으로 뒤에 붙임)
// 대출 이자 외 4개의 줄 글은 MY-10 명세서 '줄 모양'을 따름 (2026-11-26 사용자 결정)
// 넘긴 기록 한 줄은 그 계산기가 처음 값으로 씀 (CalculatorPage getInitialCalc, getInitialChange 등, 맞지 않는 값은 무시)
const KINDS = {
  LOAN: {
    name: '대출 이자',
    getList: myApi.getCalcs,
    remove: myApi.deleteCalc,
    clearAll: myApi.deleteCalcs,
    idKey: 'calcId',
    path: '/calc',
    main: (item) => `${formatMoney(item.loanAmount, '원')} · ${item.loanMonths}개월 · 연 ${formatRate(item.interestRate)}%`,
    sub: (item) =>
      `${METHOD_LABEL[item.repayMethod] ?? ''}${item.graceMonths > 0 ? ` · 거치 ${item.graceMonths}개월` : ''} · 총이자 ${formatMoney(item.totalInterest, '원')}`,
    label: (item) => `${formatMoney(item.loanAmount, '원')}, ${item.loanMonths}개월, ${METHOD_LABEL[item.repayMethod] ?? ''}`,
  },
  CHANGE: {
    name: '대출 갈아타기',
    getList: myApi.getChangeCalcs,
    remove: myApi.deleteChangeCalc,
    clearAll: myApi.deleteChangeCalcs,
    idKey: 'changeId',
    path: '/calc/change',
    main: (item) =>
      item.savingAmount >= 0
        ? `갈아타면 ${formatMoney(item.savingAmount, '원')} 아껴요`
        : `갈아타면 ${formatMoney(-item.savingAmount, '원')} 더 내요`,
    sub: (item) => `지금 ${formatRate(item.currentRate)}%에서 ${formatRate(item.newRate)}%`,
    label: (item) => `지금 ${formatRate(item.currentRate)}%에서 ${formatRate(item.newRate)}%로 갈아타기`,
  },
  DSR: {
    name: 'DSR',
    getList: myApi.getDsrCalcs,
    remove: myApi.deleteDsrCalc,
    clearAll: myApi.deleteDsrCalcs,
    idKey: 'dsrId',
    path: '/calc/dsr',
    main: (item) => `DSR ${formatRate(item.dsrRate)}% · 대출 ${item.loans?.length ?? 0}건`,
    sub: (item) => `연소득 ${formatMoney(item.annualIncome, '원')}`,
    label: (item) => `DSR ${formatRate(item.dsrRate)}%, 연소득 ${formatMoney(item.annualIncome, '원')}`,
  },
  REVERSE: {
    name: '상환능력 기반 대출',
    getList: myApi.getReverseCalcs,
    remove: myApi.deleteReverseCalc,
    clearAll: myApi.deleteReverseCalcs,
    idKey: 'reverseId',
    path: '/calc/reverse',
    main: (item) => `매달 ${formatMoney(item.monthlyPayment, '원')} · 연 ${formatRate(item.interestRate)}% · ${item.loanMonths}개월`,
    sub: (item) => `최대 ${formatMoney(item.maxLoan, '원')}`,
    label: (item) => `매달 ${formatMoney(item.monthlyPayment, '원')}, ${item.loanMonths}개월`,
  },
  HOME: {
    name: '집 살 때 대출한도',
    getList: myApi.getHomeCalcs,
    remove: myApi.deleteHomeCalc,
    clearAll: myApi.deleteHomeCalcs,
    idKey: 'homeId',
    path: '/calc/home',
    main: (item) => `집값 ${formatMoney(item.housePrice, '원')} · ${REGION_LABEL[item.homeRegion] ?? ''}`,
    sub: (item) => `최대 한도 ${formatMoney(item.maxLoan, '원')}`,
    label: (item) => `집값 ${formatMoney(item.housePrice, '원')}, 최대 한도 ${formatMoney(item.maxLoan, '원')}`,
  },
}

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

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
`

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Main = styled.b`
  font-size: var(--fs-base);
  font-weight: 700;
`

const Sub = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
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

const RailTitle = styled.h2`
  font-size: var(--fs-lg);
  font-weight: 800;
`

const RailHint = styled.p`
  margin-top: -8px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
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

const RailFoot = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 0 12px 12px;
`

const DialogText = styled.p`
  margin-bottom: 20px;
  font-size: var(--fs-lg);
  font-weight: 700;
`

const DialogTarget = styled.p`
  margin: -12px 0 20px;
  color: var(--cocoa);
  font-size: var(--fs-md);
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

// 계산기 화면 오른쪽 칸의 계산 기록 (items가 1개 이상일 때만 그려짐): 카드를 누르면 onLoad(item), X와 '전체 지우기'는 확인 창 뒤에 onRemove, onClearAll
function CalcHistoryRail({ config, items, onLoad, onRemove, onClearAll }) {
  const showToast = useUiStore((state) => state.showToast)
  const [page, setPage] = useState(0)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const pageCount = Math.max(1, Math.ceil(items.length / RAIL_PAGE_SIZE))
  const current = Math.min(page, pageCount - 1)
  const visibleItems = items.slice(current * RAIL_PAGE_SIZE, current * RAIL_PAGE_SIZE + RAIL_PAGE_SIZE)
  const groupTitle = `${config.name} 기록`

  // 지우기 공통: 요청 → 알림, 창 닫기 / 실패하면 알림 (401은 로그인 안내 창이 뜨므로 알림 안 함, MySection과 같음)
  const runRemove = async (request, doneText, close) => {
    setIsPending(true)
    try {
      await request()
      showToast(doneText)
      close()
    } catch (error) {
      if (error.response?.status !== 401) showToast('지우지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <RailWrap aria-label="계산 기록">
      <RailTitle>계산 기록</RailTitle>
      <RailHint>[결과 저장]을 누른 기록이에요. 누르면 그 값으로 다시 계산해요.</RailHint>
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
              <RailCard onClick={() => onLoad(item)} aria-label={`${config.label(item)} 불러오기`}>
                <RailDate>{formatDate(item.calcAt)}</RailDate>
                <RailName>{config.main(item)}</RailName>
                <RailSub>{config.sub(item)}</RailSub>
              </RailCard>
              <RailRemove aria-label={`${config.label(item)} 지우기`} disabled={isPending} onClick={() => setRemoveTarget(item)}>
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
        <RailFoot>
          <Button $size="sm" $variant="ghost" onClick={() => setIsClearOpen(true)}>
            전체 지우기
          </Button>
        </RailFoot>
      </RailGroup>

      <Modal isOpen={isClearOpen} onClose={() => setIsClearOpen(false)} label="계산 기록 지우기" width={380} showClose={false}>
        <DialogText>{groupTitle}을 모두 지울까요?</DialogText>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsClearOpen(false)}>
            취소
          </Button>
          <Button
            disabled={isPending}
            onClick={() => runRemove(onClearAll, '계산 기록을 지웠어요', () => setIsClearOpen(false))}
          >
            지우기
          </Button>
        </DialogActions>
      </Modal>

      <Modal isOpen={removeTarget !== null} onClose={() => setRemoveTarget(null)} label="계산 기록에서 지우기" width={380} showClose={false}>
        <DialogText>이 기록을 지울까요?</DialogText>
        {removeTarget !== null && <DialogTarget>{config.label(removeTarget)}</DialogTarget>}
        <DialogActions>
          <Button $variant="outline" onClick={() => setRemoveTarget(null)}>
            취소
          </Button>
          <Button
            disabled={isPending}
            onClick={() => runRemove(() => onRemove(removeTarget), '계산 기록에서 지웠어요', () => setRemoveTarget(null))}
          >
            지우기
          </Button>
        </DialogActions>
      </Modal>
    </RailWrap>
  )
}

function CalcHistoryList({ onLoad, refreshKey = 0, kind = 'LOAN', isOnlyWithItems = false }) {
  const config = KINDS[kind] ?? KINDS.LOAN
  const navigate = useNavigate()
  const authStatus = useAuthStore((state) => state.status)
  const isMember = authStatus === 'member'
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    if (!isMember) return undefined
    let isCancelled = false
    config
      .getList()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [] })
      })
      .catch((error) => {
        if (!isCancelled) setResult({ status: error.isPreparing ? 'preparing' : 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [isMember, attempt, refreshKey, config])

  const handleRetry = () => {
    setResult({ status: 'loading', items: [] })
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    await config.remove(item[config.idKey])
    setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one[config.idKey] !== item[config.idKey]) }))
  }

  const handleClearAll = async () => {
    await config.clearAll()
    setResult({ status: 'done', items: [] })
  }

  // 불러오기: onLoad가 있으면 그 화면이 처리 (계산기 화면), 없으면 그 계산기로 기록 한 줄을 그대로 넘겨 이동 (MY, 옵션도 함께 복원, 맞지 않는 값은 계산기가 무시)
  const handleLoad = (item) => {
    if (onLoad) {
      onLoad(item)
      return
    }
    navigate(config.path, { state: item })
  }

  if (authStatus === 'checking') return null
  if (isOnlyWithItems) {
    if (!isMember || result.status !== 'done' || result.items.length === 0) return null
    return (
      <CalcHistoryRail
        config={config}
        items={result.items}
        onLoad={handleLoad}
        onRemove={handleRemove}
        onClearAll={handleClearAll}
      />
    )
  }

  if (!isMember) {
    return (
      <Guest>
        <GuestTitle>계산 기록</GuestTitle>
        <GuestText>로그인하면 저장 가능</GuestText>
      </Guest>
    )
  }

  return (
    <MySection
      title="계산 기록"
      description="[결과 저장]을 누른 기록이에요."
      status={result.status}
      onRetry={handleRetry}
      items={result.items}
      getKey={(item) => item[config.idKey]}
      getItemLabel={config.label}
      renderItem={(item) => (
        <Row>
          <Info>
            <Main>{config.main(item)}</Main>
            <Sub>
              {config.sub(item)} · {formatDate(item.calcAt)}
            </Sub>
          </Info>
          <Button $size="sm" $variant="outline" onClick={() => handleLoad(item)}>
            불러오기
          </Button>
        </Row>
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="저장한 계산 기록이 없어요"
    />
  )
}

export default CalcHistoryList
