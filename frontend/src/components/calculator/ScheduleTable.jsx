import styled from 'styled-components'
import { formatNumber } from '../../utils/format'
import SectionHeader from '../common/SectionHeader'

// CA-05 회차별 납입 표: 회차 / 납입금 / 원금 / 이자 / 중도상환 / 남은 원금 (금액은 원)
// 모든 회차를 높이 560px 상자 안에 넣고 상자 안에서 스크롤로 내려 봄, 머리글 줄은 위에 붙어 있음 (2026-11-25 사용자 결정, 명세서 CA-05 '[더 보기]'와 다름, 가안 .table-box는 420px). 560px은 12회차가 한 번에 보이는 높이 (머리글 약 43px + 12줄 x 약 41px), 그 아래 13회차가 살짝 보여 스크롤할 수 있음을 알림. 그래프보다 위
// rows: getSchedule 결과의 rows
const Scroll = styled.div`
  max-height: 560px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
`

const Table = styled.table`
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  th,
  td {
    border-bottom: 1px solid var(--line);
    text-align: right;
    white-space: nowrap;
  }
  th {
    position: sticky;
    top: 0;
    padding: 11px 14px;
    box-shadow: inset 0 -1px 0 var(--line);
    background: var(--mist);
    color: var(--ink-2);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
  td {
    padding: 10px 14px;
    font-family: var(--f-num);
    font-weight: 700;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  th:first-child,
  td:first-child {
    text-align: center;
  }
`

const Muted = styled.span`
  color: var(--muted);
`

function ScheduleTable({ rows }) {
  return (
    <section>
      <SectionHeader title="회차별 납입 금액" description={`금액은 모두 원 단위예요. 총 ${rows.length}회차`} />
      <Scroll>
        <Table>
          <thead>
            <tr>
              <th scope="col">회차</th>
              <th scope="col">납입금</th>
              <th scope="col">원금</th>
              <th scope="col">이자</th>
              <th scope="col">중도상환</th>
              <th scope="col">남은 원금</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.round}>
                <td>{row.round}</td>
                <td>{formatNumber(row.payment)}</td>
                <td>{formatNumber(row.principal)}</td>
                <td>{formatNumber(row.interest)}</td>
                <td>{row.prepay > 0 ? formatNumber(row.prepay) : <Muted>-</Muted>}</td>
                <td>{formatNumber(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Scroll>
    </section>
  )
}

export default ScheduleTable
