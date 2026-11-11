import api from './axiosInstance'

// API-44 내 조건 안내 판정: 추천 입력값을 보내고 판정 결과(data)만 돌려받음
// 입력값(소득, 신용 등)은 console 출력 금지 (E6)
export const postEligibility = async (productId, input) => {
  const response = await api.post(`/api/products/${productId}/eligibility`, input)
  return response.data.data
}
