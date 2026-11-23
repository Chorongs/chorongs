import StackedBarChart from '../chart/StackedBarChart'
import SectionHeader from '../common/SectionHeader'

// CA-06 납입액 그래프: 회차별 원금과 이자를 쌓은 막대 (CH-01 StackedBarChart). 회차가 많으면 차트가 12회씩 묶어 그림
// rows: getSchedule 결과의 rows
function PaymentChart({ rows }) {
  const data = rows.map((row) => ({ label: `${row.round}회`, first: row.principal, second: row.interest }))

  return (
    <section>
      <SectionHeader title="납입 그래프" description="막대 하나가 한 회차의 납입금이고, 원금과 이자로 나눠 보여 줘요." />
      <StackedBarChart data={data} firstLabel="원금" secondLabel="이자" />
    </section>
  )
}

export default PaymentChart
