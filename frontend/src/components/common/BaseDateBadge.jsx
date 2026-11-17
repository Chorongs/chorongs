import styled from 'styled-components'
import { formatDate } from '../../utils/format'

// CM-13 기준일 딱지: 주황 점 + '2026.10.18 기준' 회색 작은 글. 기준일은 API 응답의 baseDate
// 날짜가 없거나 날짜 모양이 아니면 그리지 않는다. (시안의 '예시 데이터'는 실제 데이터 연결 후 뺌)
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  white-space: nowrap;
  &::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--sun);
  }
`

function BaseDateBadge({ date }) {
  const text = formatDate(date)
  if (text === '-') return null
  return <Badge>{text} 기준</Badge>
}

export default BaseDateBadge
