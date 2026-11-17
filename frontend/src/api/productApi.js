import api from './axiosInstance'

// 상품 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// CM-07 상품 상세 창이 쓰는 API-02, 05와 CM-08 내 조건 안내가 쓰는 API-44가 있다.

// API-02 상품 상세
export async function getProduct(id) {
  const response = await api.get(`/api/products/${id}`)
  return response.data.data
}

// API-05 상품 조회 기록 (204, 본문 없음)
export async function postProductView(id) {
  await api.post(`/api/products/${id}/views`)
}

// API-44 내 조건 안내 판정: 추천 입력값을 보내고 판정 결과(data)만 돌려받음
// 입력값(소득, 신용 등)은 console 출력 금지 (E6)
export const postEligibility = async (productId, input) => {
  const response = await api.post(`/api/products/${productId}/eligibility`, input)
  return response.data.data
}
