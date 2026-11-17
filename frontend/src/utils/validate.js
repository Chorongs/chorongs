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

// 단계별 입력 검사: 첫 번째로 걸린 칸을 { field, message }로 돌려주고, 통과하면 null
// field는 화면 칸 이름 (실패하면 그 칸에 커서를 옮기고 문구를 보여 줌)

// 1단계 나에 대해: 직업, 나이, 연소득, 기존 대출 (지역은 고르지 않아도 됨)
export const getAboutMeError = (input) => {
  if (isBlank(input.job)) return { field: 'job', message: '직업을 골라 주세요' }
  if (isBlank(input.ageGroup)) return { field: 'ageGroup', message: '나이를 골라 주세요' }
  if (!isValidIncome(input.income)) {
    return { field: 'income', message: '연소득을 0~99,999만원 사이로 입력해 주세요' }
  }
  // 기존 대출: '잘 모르겠어요'(debtUnknown)이거나 월 상환액 입력 ('대출 없어요' = 0)
  if (!input.debtUnknown && !isNumberInRange(input.debtMonthly, 0, 99999)) {
    return { field: 'debt', message: '매달 갚는 대출을 입력하거나 골라 주세요' }
  }
  return null
}

// 2단계 필요한 돈: 용도, 필요 금액, 갚을 기간
export const getMoneyError = (input) => {
  if (isBlank(input.purpose)) return { field: 'purpose', message: '자금 용도를 골라 주세요' }
  if (!isValidNeed(input.need)) {
    return { field: 'need', message: '필요 금액을 10만원~10억원 사이로 입력해 주세요' }
  }
  if (!isValidMonths(input.purpose, input.months)) {
    return { field: 'months', message: '갚을 기간을 골라 주세요' }
  }
  return null
}

// 3단계 신용, 우선순위: 신용 구간(필수), 최근 1년 연체, 가장 중요한 것 1~3개
export const getCreditError = (input) => {
  if (isBlank(input.creditBand)) return { field: 'creditBand', message: '신용점수 구간을 골라 주세요' }
  if (typeof input.overdue !== 'boolean') {
    return { field: 'overdue', message: '최근 1년 연체 여부를 골라 주세요' }
  }
  if (input.priorities.length < 1 || input.priorities.length > 3) {
    return { field: 'priorities', message: '가장 중요한 것을 1~3개 골라 주세요' }
  }
  return null
}

// 갚을 기간 선택지 (개월): 전월세, 주택 구입은 60/120/180, 그 밖의 용도는 12/36/60
export const getMonthsOptions = (purpose) =>
  HOUSING_PURPOSES.includes(purpose) ? MONTHS_OPTIONS_HOUSING : MONTHS_OPTIONS_DEFAULT

// 갚을 기간 검사: '잘 모르겠어요'(0)이거나 그 용도의 선택지 안에 있는 값
export const isValidMonths = (purpose, months) =>
  months === MONTHS_UNKNOWN || getMonthsOptions(purpose).includes(months)
