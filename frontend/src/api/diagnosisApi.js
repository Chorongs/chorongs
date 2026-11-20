import api from './axiosInstance'

// 신용 진단 서버 요청. 본문 { success, data }의 data만 꺼내 돌려준다.
// 답은 서버로 보내기만 하고 console 등에 출력하지 않는다. (E6)

// API-09 신용 셀프 진단 / answers: [{ questionNo, choices: [보기 번호] }] (문항 5는 보기 번호 목록, 대출 없으면 [])
export async function postCreditCheck(answers) {
  const response = await api.post('/api/diagnosis/credit', { answers })
  return response.data.data
}
