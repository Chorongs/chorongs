import api from './axiosInstance'

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
