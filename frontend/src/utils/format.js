// 금액, 금리, 날짜 표시 함수 (화면 없는 계산). 값이 없거나 숫자가 아니면 '-'
const EMPTY = '-'

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

// 천 단위 쉼표: 1234567 → '1,234,567'
export function formatNumber(value) {
  const number = toNumber(value)
  if (number === null) return EMPTY
  return number.toLocaleString('ko-KR')
}

// 금액 글: unit '만원'(기본)이면 만원 단위 값, '원'이면 원 단위 값을 받는다.
// 10,000만원 이상은 억으로 묶음: 12000(만원) → '1억 2,000만원', 10000 → '1억원'
// 원 단위 값이 만원 단위로 딱 떨어지지 않으면 '12,345,678원'처럼 그대로 쓴다.
export function formatMoney(value, unit = '만원') {
  const number = toNumber(value)
  if (number === null) return EMPTY

  if (unit === '원') {
    if (number % 10000 !== 0) return `${formatNumber(number)}원`
    return formatMoney(number / 10000, '만원')
  }

  if (number >= 10000) {
    const eok = Math.floor(number / 10000)
    const rest = number % 10000
    return rest === 0 ? `${formatNumber(eok)}억원` : `${formatNumber(eok)}억 ${formatNumber(rest)}만원`
  }
  return `${formatNumber(number)}만원`
}

// 금리 숫자 (연 %): 소수 둘째 자리로 맞춤. 5.5 → '5.50', 2 → '2.00' (% 기호는 붙이지 않음)
export function formatRate(value) {
  const number = toNumber(value)
  if (number === null) return EMPTY
  return number.toFixed(2)
}

// 날짜: '2026-10-18' 또는 '2026-10-18T09:00:00' → '2026.10.18'
export function formatDate(value) {
  const matched = typeof value === 'string' ? value.match(/^(\d{4})-(\d{2})-(\d{2})/) : null
  if (!matched) return EMPTY
  return `${matched[1]}.${matched[2]}.${matched[3]}`
}
