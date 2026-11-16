import api from './axiosInstance'

// 상품 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// CM-07 상품 상세 창이 쓰는 API-02, 05, 비교 화면이 쓰는 API-03이 있다.

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
