import api from './axiosInstance'

// 찜, 최근 본, 최근 검색, 비교 내역, 계산 기록, 진단 리포트, 추천 결과, 회원 정보, MY 요약 (API-20~25, 28, 38, 51)
// 본문 { success, data }의 data만 꺼내 돌려준다. 204는 본문이 없어 돌려주는 값이 없다.

// API-20 찜 목록 (쪽 나눔: page는 1부터, 기본 30개 = 찜 최대 개수라 인자 없이 부르면 한 번에 다 받음)
export async function getLikes({ page = 1, size = 30 } = {}) {
  const response = await api.get('/api/me/likes', { params: { page, size } })
  return response.data.data
}

// API-20 찜하기 (409 ALREADY_LIKED, LIKE_FULL은 부르는 쪽에서 나눔)
export async function postLike(productId) {
  await api.post(`/api/me/likes/${productId}`)
}

// API-20 찜 취소
export async function deleteLike(productId) {
  await api.delete(`/api/me/likes/${productId}`)
}

// API-21 최근 본 대출 (최근 10개)
export async function getRecentViews() {
  const response = await api.get('/api/me/recent-views')
  return response.data.data
}

// API-21 최근 본 대출 기록 (상품 상세 창을 열 때, 실패해도 안내 안 함)
export async function postRecentView(productId) {
  await api.post('/api/me/recent-views', { productId })
}

// API-21 최근 본 대출 1건 삭제
export async function deleteRecentView(productId) {
  await api.delete(`/api/me/recent-views/${productId}`)
}

// API-21 최근 본 대출 전체 삭제
export async function deleteRecentViews() {
  await api.delete('/api/me/recent-views')
}

// API-22 최근 검색 (최근 10개)
export async function getSearches() {
  const response = await api.get('/api/me/searches')
  return response.data.data
}

// API-22 검색 기록: { type (FILTER, SIMPLE), label, condition } / 맞춤 추천 입력은 보내지 않음 (E6)
export async function postSearch(body) {
  await api.post('/api/me/searches', body)
}

// API-22 최근 검색 1건 삭제
export async function deleteSearch(searchId) {
  await api.delete(`/api/me/searches/${searchId}`)
}

// API-22 최근 검색 전체 삭제
export async function deleteSearches() {
  await api.delete('/api/me/searches')
}

// API-23 비교 내역 (최근 10개)
export async function getCompares() {
  const response = await api.get('/api/me/compares')
  return response.data.data
}

// API-23 비교 저장 (201). 같은 조합은 409 CONFLICT (비교 화면 CHORONG-47이 씀)
export async function postCompare(productAId, productBId) {
  await api.post('/api/me/compares', { productAId, productBId })
}

// API-23 비교 내역 1건 삭제
export async function deleteCompare(compareId) {
  await api.delete(`/api/me/compares/${compareId}`)
}

// API-23 비교 내역 전체 삭제
export async function deleteCompares() {
  await api.delete('/api/me/compares')
}

// API-24 계산 기록
export async function getCalcs() {
  const response = await api.get('/api/me/calcs')
  return response.data.data
}

// API-24 계산 기록 저장: { loanAmount, loanMonths, interestRate, repayMethod, graceMonths, totalInterest, firstPayment }
export async function postCalc(body) {
  await api.post('/api/me/calcs', body)
}

// API-24 계산 기록 1건 삭제
export async function deleteCalc(calcId) {
  await api.delete(`/api/me/calcs/${calcId}`)
}

// API-24 계산 기록 전체 삭제
export async function deleteCalcs() {
  await api.delete('/api/me/calcs')
}

// API-56 갈아타기 계산 기록
export async function getChangeCalcs() {
  const response = await api.get('/api/me/change-calcs')
  return response.data.data
}

// API-56 갈아타기 계산 기록 저장 (201): { currentRepayMethod, currentBalance 원, currentRate, currentMonths, newRepayMethod, newRate, newMonths, feeRate, etcCost 원, savingAmount 원, newFirstPayment 원, newTotalInterest 원 }
export async function postChangeCalc(body) {
  await api.post('/api/me/change-calcs', body)
}

// API-56 갈아타기 계산 기록 1건 삭제
export async function deleteChangeCalc(changeId) {
  await api.delete(`/api/me/change-calcs/${changeId}`)
}

// API-56 갈아타기 계산 기록 전체 삭제
export async function deleteChangeCalcs() {
  await api.delete('/api/me/change-calcs')
}

// API-59 내 집 대출한도 계산 기록
export async function getHomeCalcs() {
  const response = await api.get('/api/me/home-calcs')
  return response.data.data
}

// API-59 내 집 대출한도 계산 기록 저장 (201): { housePrice 원, homeRegion (OTHER, REGULATED), firstHome (Y, N), annualIncome 원, otherInterest 원, interestRate, loanYears, repayMethod (EQUAL_PI, EQUAL_P), maxLoan 원, ltvLimit 원, dtiLimit 원 }
export async function postHomeCalc(body) {
  await api.post('/api/me/home-calcs', body)
}

// API-59 내 집 대출한도 계산 기록 1건 삭제
export async function deleteHomeCalc(homeId) {
  await api.delete(`/api/me/home-calcs/${homeId}`)
}

// API-59 내 집 대출한도 계산 기록 전체 삭제
export async function deleteHomeCalcs() {
  await api.delete('/api/me/home-calcs')
}

// API-58 상환능력 기반 대출 계산 기록
export async function getReverseCalcs() {
  const response = await api.get('/api/me/reverse-calcs')
  return response.data.data
}

// API-58 상환능력 기반 대출 계산 기록 저장 (201): { repayMethod, monthlyPayment 원, interestRate, loanMonths, maxLoan 원 }
export async function postReverseCalc(body) {
  await api.post('/api/me/reverse-calcs', body)
}

// API-58 상환능력 기반 대출 계산 기록 1건 삭제
export async function deleteReverseCalc(reverseId) {
  await api.delete(`/api/me/reverse-calcs/${reverseId}`)
}

// API-58 상환능력 기반 대출 계산 기록 전체 삭제
export async function deleteReverseCalcs() {
  await api.delete('/api/me/reverse-calcs')
}

// API-57 DSR 계산 기록
export async function getDsrCalcs() {
  const response = await api.get('/api/me/dsr-calcs')
  return response.data.data
}

// API-57 DSR 계산 기록 저장 (201): { annualIncome 원, dsrRate %, yearlyPayment 원, loans (1건부터 10건, 입력 순서대로): [{ loanKind (CREDIT, MORTGAGE, OTHER), repayMethod, loanAmount 원, interestRate, loanMonths }] }
export async function postDsrCalc(body) {
  await api.post('/api/me/dsr-calcs', body)
}

// API-57 DSR 계산 기록 1건 삭제
export async function deleteDsrCalc(dsrId) {
  await api.delete(`/api/me/dsr-calcs/${dsrId}`)
}

// API-57 DSR 계산 기록 전체 삭제
export async function deleteDsrCalcs() {
  await api.delete('/api/me/dsr-calcs')
}

// API-25 진단 리포트: { creditBand, createdAt } / 없으면 204 → null
export async function getCreditReport() {
  const response = await api.get('/api/me/reports/credit')
  return response.status === 204 ? null : response.data.data
}

// API-25 진단 리포트 저장 (PUT): 구간만 보냄 (진단 시각은 서버가 정함), 점수와 답은 보내지 않음 (E6), 회원당 1개 덮어씀
export async function putCreditReport(creditBand) {
  const response = await api.put('/api/me/reports/credit', { creditBand })
  return response.data.data
}

// API-25 진단 리포트 삭제
export async function deleteCreditReport() {
  await api.delete('/api/me/reports/credit')
}

// API-28 회원 정보 수정: { nickname, birthYear, birthDay } 중 바꿀 것만 → MemberResponseDTO
export async function patchMe(body) {
  const response = await api.patch('/api/me', body)
  return response.data.data
}

// API-28 회원 탈퇴
export async function deleteMe() {
  await api.delete('/api/me')
}

// API-38 저장한 추천 결과: { saves }
export async function getSavedRecommends() {
  const response = await api.get('/api/me/recommendations')
  return response.data.data
}

// API-38 추천 결과 저장: { purpose, need, months, job, productIds } → { saveId } (소득, 신용, 예상 금리는 보내지 않음 E6)
export async function postSavedRecommend(body) {
  const response = await api.post('/api/me/recommendations', body)
  return response.data.data
}

// API-38 저장한 추천 결과 삭제: saveId가 있으면 그 1건, 없으면 전체
export async function deleteSavedRecommend(saveId = null) {
  await api.delete(saveId === null ? '/api/me/recommendations' : `/api/me/recommendations/${saveId}`)
}

// API-51 MY 요약: { wishCount, recentViewCount, compareCount, calcCount }
export async function getMySummary() {
  const response = await api.get('/api/me/summary')
  return response.data.data
}
