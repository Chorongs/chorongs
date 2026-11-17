import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'
import * as myApi from '../api/myApi'
import * as productApi from '../api/productApi'
import CompareCard from '../components/compare/CompareCard'
import CompareEmptySlot from '../components/compare/CompareEmptySlot'
import CompareInput from '../components/compare/CompareInput'
import CompareSidebar from '../components/compare/CompareSidebar'
import CompareTable from '../components/compare/CompareTable'
import CompareVerdict from '../components/compare/CompareVerdict'
import Disclaimer from '../components/common/Disclaimer'
import PageHeader from '../components/common/PageHeader'
import Icon from '../components/ui/Icon'
import { getTermOptions } from '../constants/options'
import useCompareStore, { getPurposes, hasSamePurpose } from '../store/useCompareStore'
import useUiStore from '../store/useUiStore'
import { Button, EmptyBox } from '../styles/common'
import { isNumberInRange } from '../utils/validate'
import {
  adjustCompareInput,
  getCompareDefaults,
  getCompareWinners,
  getLoanResult,
  getMethodPlan,
  REPAY_METHODS,
} from '../utils/loanMath'
import requireLogin from '../utils/requireLogin'

// CP-01 대출 비교 화면 (SCR-04, /compare): 자금 용도가 겹치는 상품 2개 비교. 모양과 순서는 시안과 같게
//   금액/기간 입력 → 카드 A, B → 판정 요약 → 비교표 → [결과 저장] → 안내 글 / 오른쪽(좁은 화면은 아래) 비교할 상품 고르기
// 화면을 열면 비교함 스토어의 pair(A, B)로 상품을 받는다 (API-03). 두 상품이 들어오면 금액, 기간을 두 상품에 맞게 조정하고 알림.
// [결과 저장] → API-23 (회원). 같은 조합은 409 '이미 저장한 조합' 안내, 요청 중 버튼 잠금 (E5)
// A, B가 같거나 자금 용도가 하나도 안 겹치면 B를 빈 칸 카드로 (E15). 두 칸이 다 차기 전에는 간단한 카드 + 빈 칸만 보여 줌
// 금액, 기간이 비면 오류 문구 + 결과(카드, 판정, 비교표) 숨김
// [결과 저장]은 requireLogin으로 감쌈: 비회원이면 로그인 안내 창 '비교 결과 저장은 회원 전용이에요.' (CM-17, CM-22, CHORONG-43에서 연결)
// TODO(ST-03, CHORONG-45): 처음 넣는 금액, 기간은 맞춤 추천에서 입력한 값(useRecommendStore의 lastInput need, months)을 getCompareDefaults의 마지막 값으로 넘긴다. (지금은 없음으로 넘겨 두 상품의 최대 한도, 최대 기간으로 시작)
// 처음 넣을 금액, 기간은 상품을 받은 뒤 정함 (utils/loanMath.js getCompareDefaults): 맞춤 추천에서 입력한 값 → 없으면 두 상품이 모두 되는 최대 한도, 최대 기간
// 상품을 받기 전에 잠깐 보이는 값만 아래 기본값
const DEFAULT_AMOUNT_MAN = 1000
const DEFAULT_MONTHS = 36
const MAX_AMOUNT_MAN = 100000

// 처음 넣은 금액, 기간의 근거 글 (사용자가 값을 바꾸면 사라짐)
// 상환 방식 글 (코드 → 글, '~로' 붙은 글)
const METHOD_LABEL = Object.fromEntries(REPAY_METHODS.map((item) => [item.code, item.label]))
const METHOD_WITH_RO = { EQUAL_PI: '원리금균등으로', EQUAL_P: '원금균등으로', BULLET: '만기일시로' }
const MONTHLY_MEANING = { EQUAL_P: '원금균등의 월 상환액은 첫 달', BULLET: '만기일시의 월 상환액은 매달 내는 이자' }

// 계산 기준 안내: 상환 방식을 어떻게 정했는지와 그 이유
function getCalcNote(plan) {
  const base = '금리는 범위의 중간값으로 계산해요.'
  if (!plan) return base
  if (plan.mode === 'choose') return `${base} 고른 상환 방식으로 두 상품을 똑같이 계산해요. 월 상환액은 원금균등이면 첫 달, 만기일시면 매달 이자예요.`
  if (plan.mode === 'fixed') {
    const label = METHOD_LABEL[plan.method]
    const because = {
      A: `A가 ${label}만 가능해서`,
      B: `B가 ${label}만 가능해서`,
      both: `두 상품 모두 ${label}만 가능해서`,
      common: `두 상품이 모두 가능한 방식이 ${label}뿐이라서`,
    }[plan.limitedBy]
    const meaning = MONTHLY_MEANING[plan.method]
    return `${base} ${because} ${METHOD_WITH_RO[plan.method]} 계산했어요.${meaning ? ` ${meaning}이에요.` : ''}`
  }
  return `${base} 두 상품이 모두 가능한 상환 방식이 없어서 A는 ${METHOD_WITH_RO[plan.methodA]}, B는 ${METHOD_WITH_RO[plan.methodB]} 각각 계산했어요. 방식이 달라 월 상환액은 유리 판정에 넣지 않아요. 원금균등의 월 상환액은 첫 달, 만기일시는 매달 내는 이자예요.`
}
const AMOUNT_BASIS = { recommend: '맞춤 추천 입력값', limit: '두 상품의 최대 한도', fallback: '기본 1,000만원' }
const MONTHS_BASIS = { recommend: '맞춤 추천 입력값', term: '두 상품의 최대 기간', fallback: '첫 선택지' }

// 화면 설명: 입력줄 바로 아래
const Desc = styled.p`
  margin-top: 16px;
  color: var(--cocoa);
  font-size: var(--fs-md);
`

// 계산 기준 안내 + 시작 값 근거: 카드 바로 위
const CalcNote = styled.p`
  margin-top: 8px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const Slots = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 28px;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
`

const VerdictBox = styled.div`
  margin: 28px 0 8px;
`

const SaveRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  @media (max-width: 899px) {
    justify-content: stretch;
    & > button {
      flex: 1;
    }
  }
`

const SaveHint = styled.span`
  order: -1;
  margin-right: auto;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const NoteBox = styled.div`
  margin-top: 20px;
`

const StatusBox = styled.div`
  margin-top: 28px;
`

// pair의 두 번호와 받아 온 상품에서 화면에 그릴 A, B를 정한다.
// 같은 상품이 A, B에 다 있으면 B는 빈 칸, 자금 용도가 하나도 안 겹치면 B는 빈 칸 (숨김 상품은 용도를 몰라 이 검사에서 뺌)
function getShownProducts(idA, idB, byId) {
  const productA = idA === null ? null : (byId.get(idA) ?? null)
  let productB = idB === null || idB === idA ? null : (byId.get(idB) ?? null)
  const isBothOpen = productA && productB && productA.productStatus !== 'HIDDEN' && productB.productStatus !== 'HIDDEN'
  if (isBothOpen && !hasSamePurpose(productA, productB)) productB = null
  return { productA, productB }
}

// Layout 오른쪽 칸 찾기 (바뀌지 않는 DOM 값이라 구독할 것은 없음)
const subscribeNothing = () => () => {}
const getSideEl = () => document.getElementById('page-side')

// 화면 폭 1180px 이상이면 사이드바가 오른쪽 칸, 미만이면 판정 요약과 비교표 사이 (창을 줄이거나 늘리면 바로 바뀜)
const WIDE_QUERY = '(min-width: 1180px)'
const subscribeWide = (onChange) => {
  const media = window.matchMedia(WIDE_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const getIsWide = () => window.matchMedia(WIDE_QUERY).matches

const isOpen = (product) => Boolean(product) && product.productStatus !== 'HIDDEN'

// 비교에 쓰는 상품들의 겹치는 자금 용도 (한 상품이면 그 상품 용도)
function getSharedPurposes(products) {
  const lists = products.filter(isOpen).map(getPurposes)
  if (lists.length === 0) return []
  return lists.reduce((shared, list) => shared.filter((purpose) => list.includes(purpose)))
}

function ComparePage() {
  const pair = useCompareStore((state) => state.pair)
  const showToast = useUiStore((state) => state.showToast)
  const [idA, idB] = pair

  const [amount, setAmount] = useState(DEFAULT_AMOUNT_MAN)
  const [months, setMonths] = useState(DEFAULT_MONTHS)
  const [basis, setBasis] = useState(null)
  const [method, setMethod] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  // 받은 결과에 어느 조합, 몇 번째 시도였는지 같이 적어 두면 '불러오는 중'을 따로 저장하지 않고 알 수 있다.
  const [result, setResult] = useState({ key: null, products: [], isFailed: false })
  const topRef = useRef(null)
  // Layout 오른쪽 칸(#page-side). 서버 렌더에는 없고, 화면에 붙은 뒤에 DOM에서 찾음
  const sideEl = useSyncExternalStore(subscribeNothing, getSideEl, () => null)
  const isWide = useSyncExternalStore(subscribeWide, getIsWide, () => true)
  const inputRef = useRef({ amount, months })
  const hasStartedRef = useRef(false)

  // 응답 안에서 가장 최근 입력값을 읽기 위한 복사 (조정 때 알림을 띄울지 판단)
  useEffect(() => {
    inputRef.current = { amount, months }
  })

  // 사용자가 직접 바꾸면 처음 값은 끝 (이후 상품을 바꿔도 사용자 값은 한도, 기간에 맞게만 조정)
  const handleAmountChange = (value) => {
    hasStartedRef.current = true
    setBasis(null)
    setAmount(value)
  }
  const handleMethodChange = (value) => {
    setMethod(value)
  }
  const handleMonthsChange = (value) => {
    hasStartedRef.current = true
    setBasis(null)
    setMonths(value)
  }

  const key = `${idA}-${idB}-${attempt}`

  // 상품 불러오기 (API-03): A, B에 찬 상품만, 같으면 1개로 요청. 0개면 요청 안 함
  useEffect(() => {
    const ids = [...new Set([idA, idB].filter((id) => id !== null))]
    if (ids.length === 0) return undefined
    let isCancelled = false
    productApi
      .getCompareProducts(ids)
      .then((products) => {
        if (isCancelled) return
        setResult({ key, products, isFailed: false })
        const byId = new Map(products.map((product) => [product.productId, product]))
        const { productA, productB } = getShownProducts(idA, idB, byId)
        if (!isOpen(productA) || !isOpen(productB)) return
        const current = inputRef.current
        const options = getTermOptions(getSharedPurposes([productA, productB]))
        // 처음 두 상품이 들어왔을 때: 맞춤 추천 입력값 → 없으면 최대 한도, 최대 기간으로 시작 (알림 없이 근거 글만)
        if (!hasStartedRef.current) {
          hasStartedRef.current = true
          const start = getCompareDefaults(productA, productB, options, null)
          setAmount(start.amount)
          setMonths(start.months)
          setBasis({ amount: start.amountSource, months: start.monthsSource })
          return
        }
        // 그 뒤 상품이 바뀌면 입력값을 한도, 기간에 맞게만 조정 (utils/loanMath.js, 테스트 있음)
        const next = adjustCompareInput(current, productA, productB, options)
        if (next.amount !== current.amount || next.months !== current.months) {
          setAmount(next.amount)
          setMonths(next.months)
          showToast('금액과 기간을 두 상품에 맞게 조정했어요')
        }
      })
      .catch(() => {
        if (!isCancelled) setResult({ key, products: [], isFailed: true })
      })
    return () => {
      isCancelled = true
    }
  }, [idA, idB, key, showToast])

  const hasIds = idA !== null || idB !== null
  const isLoading = hasIds && result.key !== key
  const byId = new Map(result.key === key ? result.products.map((product) => [product.productId, product]) : [])
  const { productA, productB } = getShownProducts(idA, idB, byId)

  // 입력 검사 (E2)
  const isAmountValid = isNumberInRange(amount, 1, MAX_AMOUNT_MAN)
  const termOptions = getTermOptions(getSharedPurposes([productA, productB]))
  const isMonthsValid = termOptions.includes(months)
  let amountError = ''
  if (amount === '' || amount === null) amountError = '빌릴 금액을 입력해 주세요'
  else if (!isAmountValid) amountError = `금액은 1만원 이상 ${MAX_AMOUNT_MAN.toLocaleString('ko-KR')}만원 이하로 입력해 주세요`
  const monthsError = isMonthsValid ? '' : '상환 기간을 골라 주세요'

  const isComparable = isOpen(productA) && isOpen(productB)
  const isReady = isAmountValid && isMonthsValid
  // 상환 방식: 두 상품이 모두 가능한 방식으로 정함 (2개 이상이면 칩으로 고름, 1개면 그 방식으로 고정, 없으면 상품마다 따로)
  const plan = isComparable ? getMethodPlan(productA, productB) : null
  const chosenMethod = plan?.mode === 'choose' ? (plan.options.includes(method) ? method : plan.options[0]) : null
  const methodOf = {
    A: plan?.mode === 'choose' ? chosenMethod : plan?.mode === 'fixed' ? plan.method : plan?.methodA,
    B: plan?.mode === 'choose' ? chosenMethod : plan?.mode === 'fixed' ? plan.method : plan?.methodB,
  }
  const methodOptions = plan?.mode === 'choose' ? plan.options.map((code) => ({ value: code, label: METHOD_LABEL[code] })) : []
  const loanA = isReady ? getLoanResult(productA, amount, months, methodOf.A) : { status: 'UNAVAILABLE' }
  const loanB = isReady ? getLoanResult(productB, amount, months, methodOf.B) : { status: 'UNAVAILABLE' }
  const winners = getCompareWinners(productA, productB, loanA, loanB, plan?.mode !== 'separate')

  // 빈 칸에서 상품 찾기로 갈 때 남기는 상품 (남은 쪽이 숨김 상품이면 없는 것으로)
  const keepForA = isOpen(productB) ? productB : null
  const keepForB = isOpen(productA) ? productA : null

  const handlePicked = () => {
    // 좁은 화면에서는 상품 고르기가 결과 아래에 있으니 넣은 뒤 화면 위(결과)로
    if (window.matchMedia('(max-width: 1179px)').matches) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // [결과 저장] (API-23): 같은 조합은 409
  const saveResult = async () => {
    if (isSaving || !isComparable) return
    setIsSaving(true)
    try {
      await myApi.postCompare(productA.productId, productB.productId)
      showToast('비교 결과를 저장했어요. MY의 비교 내역에서 다시 볼 수 있어요')
    } catch (error) {
      const status = error.response?.status
      // 401(로그인 풀림)은 axiosInstance가 로그인 안내 창을 띄우므로 알림을 겹쳐 띄우지 않음 (E4)
      if (status === 401) return
      if (status === 409) showToast('이미 저장한 조합이에요')
      else showToast('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  // 비회원이면 저장 대신 로그인 안내 창 (CM-22, 문구는 CM-17 '비교 결과 저장')
  const handleSave = () => requireLogin(saveResult, '비교 결과 저장은 회원 전용이에요.')

  // 한 칸: 상품이 있으면 간단한 카드(숨김 상품은 안내 카드), 없으면 빈 칸
  const renderSlot = (slot, product, keepProduct) =>
    product ? (
      <CompareCard slot={slot} product={product} amountMan={amount} months={months} isSummary />
    ) : (
      <CompareEmptySlot slot={slot} keepProduct={keepProduct} />
    )

  // 비교할 상품 고르기: 넓은 화면은 Layout 오른쪽 칸(도우미 위), 좁은 화면은 카드, 판정 요약과 비교표 사이
  const sidebar = (
    <CompareSidebar
      slotProducts={{ A: isOpen(productA) ? productA : null, B: isOpen(productB) ? productB : null }}
      onPicked={handlePicked}
    />
  )

  // 판정 요약 (A 0 : B 2): 넓은 화면은 카드 바로 아래, 좁은 화면은 비교할 상품 고르기 아래
  const verdict = (
    <VerdictBox>
      <CompareVerdict winners={winners} resultA={loanA} resultB={loanB} amountMan={amount} months={months} />
    </VerdictBox>
  )

  let body
  if (isLoading) {
    body = (
      <StatusBox>
        <EmptyBox role="status">상품을 불러오는 중이에요</EmptyBox>
      </StatusBox>
    )
  } else if (result.key === key && result.isFailed) {
    body = (
      <StatusBox>
        <EmptyBox>
          비교할 상품을 불러오지 못했어요
          <Button $size="sm" $variant="outline" onClick={() => setAttempt((count) => count + 1)}>
            다시 시도
          </Button>
        </EmptyBox>
      </StatusBox>
    )
  } else if (!isComparable) {
    body = (
      <>
        <Slots>
          {renderSlot('A', productA, keepForA)}
          {renderSlot('B', productB, keepForB)}
        </Slots>
        {!isWide && sidebar}
      </>
    )
  } else if (isReady) {
    body = (
      <>
        <Slots>
          <CompareCard slot="A" product={productA} amountMan={amount} months={months} method={methodOf.A} />
          <CompareCard slot="B" product={productB} amountMan={amount} months={months} method={methodOf.B} />
        </Slots>
        {isWide ? (
          verdict
        ) : (
          <>
            {sidebar}
            {verdict}
          </>
        )}
        <CompareTable
          productA={productA}
          productB={productB}
          resultA={loanA}
          resultB={loanB}
          winners={winners}
          amountMan={amount}
          months={months}
        />
        <SaveRow>
          <SaveHint>[결과 저장]을 눌러야 MY의 비교 내역에 남아요. 저장은 회원만 할 수 있어요.</SaveHint>
          <Button $size="sm" $variant="outline" disabled={isSaving} onClick={handleSave}>
            <Icon name="doc" size={16} />
            결과 저장
          </Button>
        </SaveRow>
      </>
    )
  }

  return (
    <div ref={topRef}>
      <PageHeader crumbs={['대출 비교']} title="대출 비교" />
      <CompareInput
        amount={amount}
        months={months}
        method={chosenMethod}
        termOptions={termOptions}
        methodOptions={methodOptions}
        amountError={amountError}
        monthsError={monthsError}
        onAmountChange={handleAmountChange}
        onMonthsChange={handleMonthsChange}
        onMethodChange={handleMethodChange}
      />
      <Desc>자금 용도가 겹치는 두 상품을 항목마다 비교해요. 추천·찜한 상품은 바로 골라 넣을 수 있어요.</Desc>
      {isComparable && (
        <CalcNote>{`${getCalcNote(plan)}${basis ? ` 시작 값: 금액은 ${AMOUNT_BASIS[basis.amount]}, 기간은 ${MONTHS_BASIS[basis.months]}.` : ''}`}</CalcNote>
      )}
      {body}
      <NoteBox>
        <Disclaimer>
          금리만 보고 고르지 마세요. 실제 금리는 신용점수와 심사에 따라 달라지고, 중도상환수수료와 신청 자격도 함께 봐야
          해요.
        </Disclaimer>
      </NoteBox>
      {/* 넓은 화면(1180 이상): Layout 오른쪽 칸(도우미 위)에 끼워 넣음 */}
      {isWide && sideEl && createPortal(sidebar, sideEl)}
    </div>
  )
}

export default ComparePage
