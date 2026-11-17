import api from './axiosInstance'

// 내 정보 관련 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// 지금은 CR-03 신용 진단 결과 카드가 쓰는 API-25 putCreditReport만 있다.

// API-25 진단 리포트 저장 (구간 + 시각만, 점수와 답은 보내지 않음, 회원당 1개 덮어씀)
export async function putCreditReport(creditBand) {
  const response = await api.put('/api/me/reports/credit', { creditBand })
  return response.data.data
}
