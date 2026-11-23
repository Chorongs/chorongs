import api from './axiosInstance'

// 상품 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// CM-07 상품 상세 창이 쓰는 API-02, 05, 비교 화면이 쓰는 API-03, CM-08 내 조건 안내가 쓰는 API-44가 있다.

// API-02 상품 상세
export async function getProduct(id) {
  const response = await api.get(`/api/products/${id}`)
  return response.data.data
}

// API-05 상품 조회 기록 (204, 본문 없음)
export async function postProductView(id) {
  await api.post(`/api/products/${id}/views`)
}

// API-03 비교용 상품 1~2개 상세 (ids = 상품 번호 배열, 숨김 상품은 번호, 금융사, 상품명, 상태만 옴)
export async function getCompareProducts(ids) {
  const response = await api.get('/api/products', { params: { ids: ids.join(',') } })
  return response.data.data
}

// API-44 내 조건 안내 판정: 추천 입력값을 보내고 판정 결과(data)만 돌려받음
// 입력값(소득, 신용 등)은 console 출력 금지 (E6)
export const postEligibility = async (productId, input) => {
  const response = await api.post(`/api/products/${productId}/eligibility`, input)
  return response.data.data
}

// API-01 상품 상세 검색 (SR-02): { q, target, purpose, amount, repay, fin, inst, region, credit (쉼표로 이은 글), rt, sort, page, size, cmp (비교함 상품 번호, 쉼표로 이은 글, 선택) }
export async function getProducts(params) {
  const response = await api.get('/api/products', { params })
  return response.data.data
}

// API-52 상품 필터 칩 목록 (SR-02): 화면을 열 때 한 번
export async function getFilterChips() {
  const response = await api.get('/api/products/filters')
  return response.data.data
}
