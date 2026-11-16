import api from './axiosInstance'

// 내 정보(회원) 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// 지금은 비교 화면(CP-01, 07)이 쓰는 API-20, 21, 23만 있다. 나머지는 쓰는 이슈(CHORONG-43 등)에서 추가한다.

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

// API-23 비교 결과 저장 (201). 같은 조합은 409 CONFLICT
export async function postCompare(productAId, productBId) {
  await api.post('/api/me/compares', { productAId, productBId })
}
