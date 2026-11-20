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

// 중도상환수수료: 0 → '없음', 숫자 → '최대 n%', 값 없음 → '기관 문의'
export function formatPrepayFee(prepayFeeMax) {
  const number = toNumber(prepayFeeMax)
  if (number === null) return '기관 문의'
  return number === 0 ? '없음' : `최대 ${formatRate(number)}%`
}

// 범위 글: 둘 다 있으면 'a ~ b', 한쪽만 있으면 '이상', '이하', 둘 다 없으면 '정보 없음' (prefix 예: '만 ', suffix 예: '세')
export function formatRange(min, max, prefix = '', suffix = '') {
  const low = toNumber(min)
  const high = toNumber(max)
  if (low !== null && high !== null) return `${prefix}${low}${suffix} ~ ${prefix}${high}${suffix}`
  if (low !== null) return `${prefix}${low}${suffix} 이상`
  if (high !== null) return `${prefix}${high}${suffix} 이하`
  return '정보 없음'
}

// 금리 범위 글: 둘 다 없으면 '금리는 기관 문의', 같으면 'a%', 다르면 'a ~ b%' (한쪽만 있으면 그 값 하나) (비교 카드, 비교할 상품 고르기)
export function formatRateRange(rateMin, rateMax) {
  if (rateMin == null && rateMax == null) return '금리는 기관 문의'
  const low = formatRate(rateMin ?? rateMax)
  const high = formatRate(rateMax ?? rateMin)
  return low === high ? `${low}%` : `${low} ~ ${high}%`
}

// 상품 태그 글: 그 종류(tagType, 예: REPAY, TARGET) 태그 값을 쉼표로 이음, 없으면 '정보 없음' (비교 카드, 비교표)
export function formatTagValues(product, tagType) {
  const values = (product.tags ?? []).filter((tag) => tag.tagType === tagType).map((tag) => tag.tagValue)
  return values.length > 0 ? values.join(', ') : '정보 없음'
}

// 오늘 날짜 'YYYY-MM-DD' (달력에서 미래 날짜를 못 고르게, 가입 단계와 MY 회원 정보) / today: 테스트에서 고정할 때만 넘김
export function getTodayText(today = new Date()) {
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}
