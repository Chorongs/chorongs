// 입력 검사 함수 모음 (E2): 서버로 보내기 전에 먼저 검사

// 빈 값: null, undefined, 공백만 있는 글자
export const isBlank = (value) =>
  value === null || value === undefined || String(value).trim() === ''

// 숫자 범위: min 이상 max 이하인 숫자
export const isNumberInRange = (value, min, max) => {
  if (isBlank(value)) return false
  const num = Number(value)
  return Number.isFinite(num) && num >= min && num <= max
}

// 글자 수: 앞뒤 공백을 뺀 글자 수가 min 이상 max 이하
export const isLengthInRange = (text, min, max) => {
  const length = String(text ?? '').trim().length
  return length >= min && length <= max
}

// 닉네임: 앞뒤 공백을 뺀 2~12자
export const isValidNickname = (nickname) => isLengthInRange(nickname, 2, 12)

// 생년월일: 'YYYY-MM-DD' 형식, 실제 있는 날짜, 1900년 이후, 오늘보다 미래가 아님 (AU-03, MY-11)
// today: 기준 날짜 (테스트에서 고정할 때만 넘김)
export const isValidBirthDate = (text, today = new Date()) => {
  const matched = typeof text === 'string' ? text.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null
  if (!matched) return false
  const year = Number(matched[1])
  const month = Number(matched[2])
  const day = Number(matched[3])
  const date = new Date(year, month - 1, day)
  // 2월 30일처럼 없는 날짜는 다음 달로 넘어가므로 다시 맞춰 봄
  const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return isRealDate && year >= 1900 && date <= todayStart
}

// 로그인 뒤 돌아갈 주소: '/'로 시작하는 사이트 안 주소만 (E12). '//다른사이트', '/\다른사이트'는 외부로 나가므로 막음
export const isSafeReturnPath = (path) =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
