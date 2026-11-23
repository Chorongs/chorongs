import CalcHistoryList from '../calculator/CalcHistoryList'

// MY-10 계산 기록: 계산 기록 전체 (CalcHistoryList 다시 사용, API-24는 CalcHistoryList가 부름)
// 제목, 지우기, 준비 중 안내(API-24가 서버에 올라오기 전, Q5)는 CalcHistoryList가 MySection으로 그림
// [불러오기]는 계산기(/calc)로 이동하며 값을 넘김
// TODO(API-24, CHORONG-48 BE): 계산 기록 API가 올라오면 axiosInstance PREPARING_APIS에서 그 줄만 지우면 됨
function CalcRecords() {
  return <CalcHistoryList />
}

export default CalcRecords
