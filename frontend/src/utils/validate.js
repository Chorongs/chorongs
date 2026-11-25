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

// 가입, 회원 정보 수정에 쓸 수 있는 나이: 만 19세 이상 (서버 가입, 회원 정보 수정 검사와 같음)
const BIRTH_MIN_AGE = 19

// 생년월일: isValidBirthDate를 통과하고 만 19세 이상 (AU-03, MY-11)
// 만 나이: 올해 생일이 아직 안 지났으면 1살 뺌. 2월 29일생은 평년에는 2월 28일을 생일로 봄 (서버 계산과 같게)
export const isAdultBirthDate = (text, today = new Date()) => {
  if (!isValidBirthDate(text, today)) return false
  const [year, month, day] = text.split('-').map(Number)
  const lastDayThisYear = new Date(today.getFullYear(), month, 0).getDate()
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, Math.min(day, lastDayThisYear))
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const age = today.getFullYear() - year - (todayStart < birthdayThisYear ? 1 : 0)
  return age >= BIRTH_MIN_AGE
}

// 생년월일 오류 문구 (가입 단계 AU-03, MY 회원 정보 MY-11 같이 씀, 기획서 문구 6-2)
export const BIRTH_ERROR = '입력한 생년월일을 확인해주세요'

// 생년월일 칸 안내 (가입 단계 AU-03, MY 회원 정보 MY-11 같이 씀, 비었거나 치는 중이고 틀린 곳이 없을 때 회색)
export const BIRTH_GUIDE = "생년월일을 '-' 없이 다음과 같이 입력해 주세요 (예: 19900101)"

// 생년월일 칸을 치는 동안의 상태 (숫자만 봄): 'empty' 안 침 / 'typing' 치는 중, 아직 틀린 곳 없음 / 'bad' 틀림 / 'ok' 맞는 날짜
// 다 치기 전이라도 이미 틀린 것이 보이면 'bad': 연도가 1900년 전이나 만 19세가 안 되는 해 ((올해 - 19)년보다 뒤), 월 13 이상,
// 만 19세가 되는 해(올해 - 19)의 아직 안 온 달, 일 첫 자리 4 이상
// 8자리를 다 치면 isAdultBirthDate와 같은 검사 (없는 날짜, 미래 날짜, 만 19세 미만)
// today: 기준 날짜 (테스트에서 고정할 때만 넘김)
export const getBirthInputState = (text, today = new Date()) => {
  const digits = String(text ?? '').replace(/\D/g, '')
  if (digits === '') return 'empty'
  if (digits.length >= 8) {
    const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
    return isAdultBirthDate(date, today) ? 'ok' : 'bad'
  }
  // 연도: 친 자리까지로 될 수 있는 가장 작은 해, 가장 큰 해가 1900년부터 (올해 - 19)년 사이에 걸치는지
  const lastAdultYear = today.getFullYear() - BIRTH_MIN_AGE
  const yearPart = digits.slice(0, 4)
  const rest = 10 ** (4 - yearPart.length)
  const minYear = Number(yearPart) * rest
  const maxYear = minYear + rest - 1
  if (maxYear < 1900 || minYear > lastAdultYear) return 'bad'
  // 월: 첫 자리는 0, 1만 / 두 자리면 1부터 12, (올해 - 19)년생이면 이번 달까지 (다음 달부터는 아직 만 19세 전)
  if (digits.length === 5 && digits[4] > '1') return 'bad'
  if (digits.length >= 6) {
    const month = Number(digits.slice(4, 6))
    if (month < 1 || month > 12) return 'bad'
    if (Number(yearPart) === lastAdultYear && month > today.getMonth() + 1) return 'bad'
  }
  // 일: 첫 자리는 0부터 3
  if (digits.length === 7 && digits[6] > '3') return 'bad'
  return 'typing'
}

// 로그인 뒤 돌아갈 주소: '/'로 시작하는 사이트 안 주소만 (E12). '//다른사이트', '/\다른사이트'는 외부로 나가므로 막음
export const isSafeReturnPath = (path) =>
  typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')

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

// 관리자 이름 (AD-12 화면에 보일 이름): 앞뒤 공백을 뺀 2~20자
export const isValidAdminName = (name) => isLengthInRange(name, 2, 20)
