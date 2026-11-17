import api from './axiosInstance'

// 상품 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// 지금은 CM-07 상품 상세 창이 쓰는 API-02, 05만 있다.

// API-02 상품 상세
export async function getProduct(id) {
  const response = await api.get(`/api/products/${id}`)
  return response.data.data
}

// API-05 상품 조회 기록 (204, 본문 없음)
export async function postProductView(id) {
  await api.post(`/api/products/${id}/views`)
}
