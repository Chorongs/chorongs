import api from './axiosInstance'

// 내 정보(회원) 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// 지금은 비교 화면(CP-01, 07)이 쓰는 API-20, 21, 23과 추천이 쓰는 API-38, 25만 있다. 나머지는 쓰는 이슈(CHORONG-43 등)에서 추가한다.

// API-20 찜 목록 (data.items: createdAt, product = ProductSummaryDTO, 최신순). 찜은 최대 30개라 한 번에 받는다.
export async function getLikes() {
  const response = await api.get('/api/me/likes', { params: { size: 30 } })
  return response.data.data
}

// API-21 최근 본 대출 (data.items: 최근 10개 viewedAt, product = ProductSummaryDTO)
export async function getRecentViews() {
  const response = await api.get('/api/me/recent-views')
  return response.data.data
}

// API-21 최근 본 대출 기록 (상품 상세 창을 열 때, 실패해도 안내 안 함)
export async function postRecentView(productId) {
  await api.post('/api/me/recent-views', { productId })
}

// API-23 비교 결과 저장 (201). 같은 조합은 409 CONFLICT
export async function postCompare(productAId, productBId) {
  await api.post('/api/me/compares', { productAId, productBId })
}

// API-38 추천 결과 저장 (POST): purpose, need, months, job + 순위대로 productIds만 보냄
// 소득, 신용 값, 예상 금리는 보내지 않음 (E6). 로그인 필요. 돌려받는 값(201): saveId
export const postSavedRecommend = async (payload) => {
  const response = await api.post('/api/me/recommendations', payload)
  return response.data.data
}

// API-25 진단 리포트 조회 (GET): 저장한 신용 구간 { creditBand, createdAt }, 리포트가 없으면(204) null
// 점수, 답은 오지 않음 (E6). 로그인 필요
export const getCreditReport = async () => {
  const response = await api.get('/api/me/reports/credit')
  return response.status === 204 ? null : response.data.data
}
