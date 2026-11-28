import { CREDIT_BAND_LABEL } from '../constants/options'
import { useRecommendStore } from '../store/useRecommendStore'
import useUiStore from '../store/useUiStore'

const MAN_WON = 10000 // 만원 → 원

const isPositiveNumber = (value) => typeof value === 'number' && value > 0

// 추천 카드 [이자 계산]이 계산기(CA-01)로 넘길 값 (RC-08). 값이 없는 칸은 빼고 보냄 (계산기 기본값을 쓰게)
// - item: RecommendItemDTO (product, estRateMin, estRateMax) / lastInput: 마지막으로 추천을 실행한 조건 (없으면 null)
// - 금액(원): 필요 금액(lastInput.need)과 한도 중 작은 값 (만원 x 10,000)
// - 기간(개월): 갚을 기간과 최대 기간(termMax) 중 짧은 값. '잘 모르겠어요'(0)이면 안 넘김
// - 금리: 예상 금리 가운데 값 (소수 2자리)
// - 방식: 상품 상환 방식(REPAY 태그)이 만기일시만이면 BULLET, 그 밖은 EQUAL_PI (추천 월 상환과 같은 기준)
export const getCalcState = (item, lastInput) => {
  const { product, estRateMin, estRateMax } = item
  const state = {}

  const amounts = [lastInput?.need, product.limitAmount].filter(isPositiveNumber)
  if (amounts.length > 0) state.loanAmount = Math.min(...amounts) * MAN_WON

  if (isPositiveNumber(lastInput?.months)) {
    state.loanMonths = Math.min(...[lastInput.months, product.termMax].filter(isPositiveNumber))
  }

  const rates = [estRateMin, estRateMax].filter((rate) => typeof rate === 'number')
  if (rates.length > 0) {
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    state.interestRate = Math.round(mean * 100) / 100
  }

  const repayTags = (product.tags ?? []).filter((tag) => tag.tagType === 'REPAY')
  const isBulletOnly = repayTags.length > 0 && repayTags.every((tag) => tag.tagValue === '만기일시')
  state.repayMethod = isBulletOnly ? 'BULLET' : 'EQUAL_PI'

  return state
}

// 추천도(서버는 소수 2자리, 예: 96.5)를 화면에는 정수로 (예: '추천도 97%')
export const formatMatchRate = (matchRate) => Math.round(matchRate)

// 월 상환 값(원)을 만원 단위로: 100만원 이상은 정수, 그보다 작으면 소수 첫째 자리 (예: 28.9만원)
export const toManWon = (won) => {
  const man = won / 10000
  return man >= 100 ? Math.round(man) : Math.round(man * 10) / 10
}

// [결과 저장]이 서버(API-38)로 보낼 값: 용도, 금액, 기간, 직업 + 순위대로 상품 번호
export const buildSavePayload = (lastInput, items) => ({
  purpose: lastInput.purpose,
  need: lastInput.need,
  months: lastInput.months,
  job: lastInput.job,
  productIds: items.map((item) => item.product.productId),
})

// 저장 내용이 같은지 비교하는 글: 같은 조건에 같은 순위의 결과면 같은 글 (중복 저장 막기용)
export const getSaveKey = (payload) => JSON.stringify(payload)

// 신용 구간으로 추천받기 (진단 결과 카드 CR-03, MY 진단 리포트 MY-09가 같이 씀)
// 추천 입력의 신용 구간을 creditBand로 채움 → 추천받기 전이면 추천 창을 '잠깐' 창 없이 1단계부터 열고 알림 (나머지 입력은 이용자가 채움)
// 받은 뒤면 그 구간으로 다시 추천 실행 → /recommend 이동 + 알림 / 실패하면 알림 (E3). 실행 중 버튼 잠금(E5)은 부르는 화면이 함
// navigate: 부르는 화면의 useNavigate() 값 (이 함수는 컴포넌트가 아니라 훅을 직접 못 씀)
export const recommendWithBand = async (creditBand, navigate) => {
  const { result, setInput, run } = useRecommendStore.getState()
  const { openRecommend, showToast } = useUiStore.getState()
  const bandLabel = CREDIT_BAND_LABEL[creditBand] ?? creditBand
  setInput({ creditBand })
  if (result === null) {
    openRecommend(true)
    showToast(`${bandLabel} 구간을 3단계에 골라 뒀어요`)
    return
  }
  try {
    await run()
    navigate('/recommend')
    showToast(`${bandLabel} 구간으로 추천했어요`)
  } catch {
    showToast('추천을 불러오지 못했어요. 다시 시도해 주세요')
  }
}
