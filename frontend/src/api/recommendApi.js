import api from './axiosInstance'

// API-06 맞춤 추천: 입력값을 보내고 추천 결과(data)만 돌려받음
// 입력값(소득, 신용 등)은 console 출력 금지 (E6)
export const postRecommend = async (input) => {
  const response = await api.post('/api/recommendations', input)
  return response.data.data
}
