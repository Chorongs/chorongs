// 고정 선택지 모음 (코드 값은 서버 API-06 보내는 값과 같게)
// 칩 글자를 그대로 쓰는 값(지역, 용도)은 한글 문자열 배열, 코드 값이 있는 것은 { value, label }

// 직업 8개
export const JOB_OPTIONS = [
  { value: 'OFFICE', label: '직장인' },
  { value: 'BIZ', label: '사업자' },
  { value: 'FREELANCER', label: '프리랜서' },
  { value: 'STUDENT', label: '학생/취준생' },
  { value: 'PART_TIME', label: '알바/계약직' },
  { value: 'HOMEMAKER', label: '주부' },
  { value: 'NO_INCOME', label: '무직/무소득' },
  { value: 'FARM', label: '농/어업인' },
]

// 나이 2개
export const AGE_GROUP_OPTIONS = [
  { value: 'YOUTH', label: '청년 (만 19~34세)' },
  { value: 'ADULT', label: '만 35세 이상' },
]

// 사는 지역 (시도 17개, '선택 안 함'은 값 null로 화면에서 따로 처리)
export const REGION_OPTIONS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
]

// 자금 용도 8개
export const PURPOSE_OPTIONS = [
  '생활비',
  '전월세',
  '학자금',
  '주택 구입',
  '대환',
  '창업',
  '사업 운영',
  '기타',
]

// 갚을 기간 선택지 (개월). 0 = '잘 모르겠어요'
export const HOUSING_PURPOSES = ['전월세', '주택 구입'] // 이 용도는 기간이 길게 나옴
export const MONTHS_OPTIONS_HOUSING = [60, 120, 180]
export const MONTHS_OPTIONS_DEFAULT = [12, 36, 60]
export const MONTHS_UNKNOWN = 0

// 빠른 금액 칩 (value는 만원 단위)
export const QUICK_AMOUNT_OPTIONS = [
  { value: 300, label: '300만' },
  { value: 500, label: '500만' },
  { value: 1000, label: '1,000만' },
  { value: 3000, label: '3,000만' },
]
