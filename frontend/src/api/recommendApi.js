import api from './axiosInstance'

// API-06 맞춤 추천: 입력값을 보내고 추천 결과(data)만 돌려받음
// 입력값(소득, 신용 등)은 console 출력 금지 (E6)
export const postRecommend = async (input) => {
  const response = await api.post('/api/recommendations', input)
  return response.data.data
}

// API-07 간편 검색 (SR-07, SR-09): 키워드 최대 5개(14개 중)를 보내고 추천 결과(data)만 돌려받음
export const postKeywordSearch = async (keywords) => {
  const response = await api.post('/api/recommendations/keywords', { keywords })
  return response.data.data
}
