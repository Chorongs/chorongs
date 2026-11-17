import styled from 'styled-components'

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
    </section>
  )
}

export default CalcRecords
