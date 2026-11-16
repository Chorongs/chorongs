import { useEffect, useRef, useState } from 'react'
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
import { adjustCompareInput, getCompareWinners, getLoanResult } from '../utils/loanMath'

// CP-01 대출 비교 화면 (SCR-04, /compare): 자금 용도가 겹치는 상품 2개 비교. 모양과 순서는 시안과 같게
//   금액/기간 입력 → 카드 A, B → 판정 요약 → 비교표 → [결과 저장] → 안내 글 / 오른쪽(좁은 화면은 아래) 비교할 상품 고르기
// 화면을 열면 비교함 스토어의 pair(A, B)로 상품을 받는다 (API-03). 두 상품이 들어오면 금액, 기간을 두 상품에 맞게 조정하고 알림.
// [결과 저장] → API-23 (회원). 같은 조합은 409 '이미 저장한 조합' 안내, 요청 중 버튼 잠금 (E5)
// A, B가 같거나 자금 용도가 하나도 안 겹치면 B를 빈 칸 카드로 (E15). 두 칸이 다 차기 전에는 간단한 카드 + 빈 칸만 보여 줌
// 금액, 기간이 비면 오류 문구 + 결과(카드, 판정, 비교표) 숨김
// TODO(CM-17, CM-22, CHORONG-43): requireLogin이 올라오면 [결과 저장]을 requireLogin(저장, '비교 결과 저장은 회원 전용이에요.')으로 감싼다.
//   지금은 요청을 보내고 401이면 같은 문구를 알림으로 보여 준다.
const DEFAULT_AMOUNT_MAN = 2000
const DEFAULT_MONTHS = 36
const MAX_AMOUNT_MAN = 100000

// 오른쪽에 비교할 상품 고르기(300), 좁은 화면(1180 미만)에서는 결과 아래
const Shell = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  @media (min-width: 1180px) {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 48px;
    align-items: start;
  }
`

const Main = styled.div`
  min-width: 0;
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
  const [attempt, setAttempt] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  // 받은 결과에 어느 조합, 몇 번째 시도였는지 같이 적어 두면 '불러오는 중'을 따로 저장하지 않고 알 수 있다.
  const [result, setResult] = useState({ key: null, products: [], isFailed: false })
  const topRef = useRef(null)
  const inputRef = useRef({ amount, months })

  // 응답 안에서 가장 최근 입력값을 읽기 위한 복사 (조정 때 알림을 띄울지 판단)
  useEffect(() => {
    inputRef.current = { amount, months }
  })

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
        // 금액, 기간 자동 조정 계산은 utils/loanMath.js (테스트 있음)
        const next = adjustCompareInput(current, productA, productB, getTermOptions(getSharedPurposes([productA, productB])))
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
  const loanA = isReady ? getLoanResult(productA, amount, months) : { status: 'UNAVAILABLE' }
  const loanB = isReady ? getLoanResult(productB, amount, months) : { status: 'UNAVAILABLE' }
  const winners = getCompareWinners(productA, productB, loanA, loanB)

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
  const handleSave = async () => {
    if (isSaving || !isComparable) return
    setIsSaving(true)
    try {
      await myApi.postCompare(productA.productId, productB.productId)
      showToast('비교 결과를 저장했어요. MY의 비교 내역에서 다시 볼 수 있어요')
    } catch (error) {
      const status = error.response?.status
      if (status === 401) showToast('비교 결과 저장은 회원 전용이에요. 로그인해 주세요')
      else if (status === 409) showToast('이미 저장한 조합이에요')
      else showToast('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  // 한 칸: 상품이 있으면 간단한 카드(숨김 상품은 안내 카드), 없으면 빈 칸
  const renderSlot = (slot, product, keepProduct) =>
    product ? (
      <CompareCard slot={slot} product={product} amountMan={amount} months={months} isSummary />
    ) : (
      <CompareEmptySlot slot={slot} keepProduct={keepProduct} />
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
      <Slots>
        {renderSlot('A', productA, keepForA)}
        {renderSlot('B', productB, keepForB)}
      </Slots>
    )
  } else if (isReady) {
    body = (
      <>
        <Slots>
          <CompareCard slot="A" product={productA} amountMan={amount} months={months} />
          <CompareCard slot="B" product={productB} amountMan={amount} months={months} />
        </Slots>
        <VerdictBox>
          <CompareVerdict winners={winners} resultA={loanA} resultB={loanB} amountMan={amount} months={months} />
        </VerdictBox>
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
      <PageHeader
        crumbs={['대출 비교']}
        title="대출 비교"
        description="자금 용도가 겹치는 두 상품을 항목마다 비교해요. 추천·찜한 상품은 바로 골라 넣을 수 있어요."
      />
      <Shell>
        <Main>
          <CompareInput
            amount={amount}
            months={months}
            termOptions={termOptions}
            amountError={amountError}
            monthsError={monthsError}
            onAmountChange={setAmount}
            onMonthsChange={setMonths}
          />
          {body}
          <NoteBox>
            <Disclaimer>
              금리만 보고 고르지 마세요. 실제 금리는 신용점수와 심사에 따라 달라지고, 중도상환수수료와 신청 자격도 함께 봐야
              해요.
            </Disclaimer>
          </NoteBox>
        </Main>
        <CompareSidebar
          slotProducts={{ A: isOpen(productA) ? productA : null, B: isOpen(productB) ? productB : null }}
          onPicked={handlePicked}
        />
      </Shell>
    </div>
  )
}

export default ComparePage
