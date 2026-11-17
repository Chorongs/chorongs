import styled from 'styled-components'
import { PREPARING_TEXT } from '../../api/axiosInstance'
import { EmptyBox } from '../../styles/common'

// MY-10 계산 기록: 계산 기록 전체 (CalcHistoryList 다시 사용, API-24는 CalcHistoryList가 부름)
// TODO(CA-07, CHORONG-49 김진석): CalcHistoryList(components/calculator/CalcHistoryList.jsx)가 올라오면 제목 아래에 그린다.
// TODO(API-24, CHORONG-48 BE): 계산 기록 API가 올라오면 CalcHistoryList가 그대로 씀
const Head = styled.h2`
  margin-bottom: 20px;
  font-size: var(--fs-h4);
  font-weight: 800;
`

function CalcRecords() {
  return (
    <section>
      <Head>계산 기록</Head>
      {/* CalcHistoryList, API-24가 올라오기 전까지 준비 중 안내 (Q5). 올라오면 이 줄을 CalcHistoryList로 바꿈 */}
      <EmptyBox>{PREPARING_TEXT}</EmptyBox>
    </section>
  )
}

export default CalcRecords
