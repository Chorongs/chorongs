import {
  HOUSING_PURPOSES,
  MONTHS_OPTIONS_DEFAULT,
  MONTHS_OPTIONS_HOUSING,
  MONTHS_UNKNOWN,
} from '../constants/options'

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

// 맞춤 추천 입력 (RC-03~05): 연소득 0~99,999만원
export const isValidIncome = (income) => isNumberInRange(income, 0, 99999)

// 맞춤 추천 입력 (RC-03~05): 필요 금액 10만원~10억원 (만원 단위로 10~100,000)
export const isValidNeed = (need) => isNumberInRange(need, 10, 100000)

// 갚을 기간 선택지 (개월): 전월세, 주택 구입은 60/120/180, 그 밖의 용도는 12/36/60
export const getMonthsOptions = (purpose) =>
  HOUSING_PURPOSES.includes(purpose) ? MONTHS_OPTIONS_HOUSING : MONTHS_OPTIONS_DEFAULT

// 갚을 기간 검사: '잘 모르겠어요'(0)이거나 그 용도의 선택지 안에 있는 값
export const isValidMonths = (purpose, months) =>
  months === MONTHS_UNKNOWN || getMonthsOptions(purpose).includes(months)
