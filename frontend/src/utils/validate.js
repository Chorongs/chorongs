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
