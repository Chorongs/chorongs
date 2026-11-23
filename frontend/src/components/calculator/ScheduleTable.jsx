import { useState } from 'react'
import styled from 'styled-components'
import { Button } from '../../styles/common'
import { formatNumber } from '../../utils/format'
import SectionHeader from '../common/SectionHeader'

// CA-05 회차별 납입 표: 회차 / 납입금 / 원금 / 이자 / 중도상환 / 남은 원금 (금액은 원)
// 회차가 많으면 처음 12줄만 그리고 [더 보기]로 12줄씩 더 (그리기 부담 줄임). 그래프보다 위
// rows: getSchedule 결과의 rows
const PAGE_SIZE = 12

const Scroll = styled.div`
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
`

const Table = styled.table`
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: var(--fs-md);
  th,
  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
    font-family: var(--f-num);
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }
  th {
    background: var(--mist);
    color: var(--ink-2);
    font-family: var(--f-ui);
    font-size: var(--fs-sm);
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

const More = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 16px;
`

function ScheduleTable({ rows }) {
  const [shownCount, setShownCount] = useState(PAGE_SIZE)
  const shownRows = rows.slice(0, shownCount)
  const leftCount = rows.length - shownRows.length

  return (
    <section>
      <SectionHeader title="회차별 납입 금액" description="금액은 모두 원 단위예요." />
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
            {shownRows.map((row) => (
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
      {leftCount > 0 && (
        <More>
          <Button $variant="outline" onClick={() => setShownCount((count) => count + PAGE_SIZE)}>
            더 보기 (남은 {leftCount}회차)
          </Button>
        </More>
      )}
    </section>
  )
}

export default ScheduleTable
