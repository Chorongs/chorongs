// 공통 코드 → 화면 글자 표 (CM-04, CM-07)
// 신용점수 구간 (BAND1~5, 화면 글 = CREDIT 칩 글자)
export const CREDIT_BAND_LABEL = {
  BAND1: '900 초과',
  BAND2: '801~900',
  BAND3: '701~800',
  BAND4: '601~700',
  BAND5: '600 이하',
}

// 상품 특징 코드 → 화면 글 (features 값)
export const FEATURE_LABEL = {
  ONLINE: '비대면 신청',
  NO_PREPAY_FEE: '중도상환수수료 없음',
  POLICY: '정부/서민 지원',
  FIXED: '고정금리',
  VARIABLE: '변동금리',
}

// 상환 방식 글 → 계산기로 넘기는 코드 (그 밖은 EQUAL_PI)
export const REPAY_METHOD_CODE = {
  원리금균등: 'EQUAL_PI',
  원금균등: 'EQUAL_P',
  만기일시: 'BULLET',
}

// 로그인 방법 코드 → 화면 글 (MemberResponseDTO loginType)
export const LOGIN_TYPE_LABEL = {
  KAKAO: '카카오',
  NAVER: '네이버',
}

// 신용 셀프 진단 문항 10개 (CR-02). 보기 번호 = 보기 순서 1, 2, ... / 0은 '잘 모르겠어요' (hasUnknown인 문항만)
// 보기 순서와 허용 문항은 ml/app/credit.py OPTIONS, API-09와 같게. label은 결과 카드 항목 이름.
// 문항 5(이용 금융권)는 여러 개 고르는 선택 문항 (대출이 있을 때만)
export const CREDIT_QUESTIONS = [
  { no: 1, label: '1년 내 연체', title: '최근 1년 안에 30일 이상 연체한 적이 있나요?', options: ['없음', '1회', '2회 이상'] },
  { no: 2, label: '3개월 내 연체', title: '최근 3개월 안에 가장 길었던 연체 기간은 얼마인가요?', options: ['없음', '10일 미만', '10~29일', '30일 이상'] },
  { no: 3, label: '채무조정 이력', title: '최근 5년 안에 신용회복, 채무조정, 연체 등록 이력이 있나요?', options: ['없음', '있음'] },
  { no: 4, label: '대출 건수', title: '지금 갚고 있는 대출은 몇 건인가요?', options: ['0건', '1건', '2~3건', '4건 이상'] },
  {
    no: 5,
    label: '이용 금융권',
    title: '이용 중인 금융권을 모두 골라 주세요.',
    hint: '대출이 있을 때만 골라 주세요.',
    options: ['은행', '카드/캐피탈', '저축은행(상호금융 포함)', '대부업'],
    isMultiple: true,
  },
  {
    no: 6,
    label: '대출 잔액',
    title: '총 대출 잔액은 얼마인가요?',
    options: ['없음', '1천만원 미만', '1천~3천만원', '3천~5천만원', '5천만원~1억원', '1억원 이상'],
    hasUnknown: true,
  },
  {
    no: 7,
    label: '카드 사용 비율',
    title: '카드 한도 대비 평균 사용 비율은 얼마인가요?',
    options: ['카드 없음', '30% 미만', '30~60%', '60~90%', '90% 이상'],
    hasUnknown: true,
  },
  {
    no: 8,
    label: '현금서비스',
    title: '최근 6개월 중 현금서비스(단기카드대출)를 쓴 달은 몇 개월인가요?',
    options: ['없음', '1~2개월', '3개월 이상'],
    hasUnknown: true,
  },
  {
    no: 9,
    label: '새 대출, 카드',
    title: '최근 6개월 안에 새로 만든 대출, 카드는 몇 개인가요?',
    options: ['0개', '1~2개', '3개 이상'],
    hasUnknown: true,
  },
  {
    no: 10,
    label: '금융거래 기간',
    title: '금융거래를 한 지 얼마나 됐나요?',
    options: ['1년 미만', '1~3년', '3~5년', '5~10년', '10년 이상'],
    hasUnknown: true,
  },
]

// 상환 기간 선택지 (개월): 전월세, 주택 구입은 60/120/180, 그 밖 용도는 12/36/60
export const LONG_TERM_PURPOSES = ['전월세', '주택 구입']
export const SHORT_TERM_MONTHS = [12, 36, 60]
export const LONG_TERM_MONTHS = [60, 120, 180]

// 용도 목록(두 상품이 겹치는 용도)이 전부 장기 용도일 때만 장기 선택지
export function getTermOptions(purposes) {
  const list = purposes ?? []
  const isLong = list.length > 0 && list.every((purpose) => LONG_TERM_PURPOSES.includes(purpose))
  return isLong ? LONG_TERM_MONTHS : SHORT_TERM_MONTHS
}

// 추천 입력 선택지 (RC-03~06)
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
// 처음 골라 두는 기간(개월, 가안 기준): 전월세, 주택 구입은 120, 그 밖은 36
export const MONTHS_DEFAULT = 36
export const MONTHS_DEFAULT_HOUSING = 120

// 빠른 금액 칩 (value는 만원 단위)
export const QUICK_AMOUNT_OPTIONS = [
  { value: 300, label: '300만' },
  { value: 500, label: '500만' },
  { value: 1000, label: '1,000만' },
  { value: 3000, label: '3,000만' },
]

// 신용점수 구간 5개 (NICE 점수 기준, 화면 글 = CREDIT 칩 글자)
export const CREDIT_BAND_OPTIONS = Object.entries(CREDIT_BAND_LABEL).map(([value, label]) => ({
  value,
  label,
}))

// 최근 1년 연체 (값은 true, false)
export const OVERDUE_OPTIONS = [
  { value: false, label: '없어요' },
  { value: true, label: '있어요' },
]

// 가장 중요한 것 6개 (1~3개 고름)
export const PRIORITY_OPTIONS = [
  { value: 'LOW_RATE', label: '낮은 금리' },
  { value: 'HIGH_LIMIT', label: '넉넉한 한도' },
  { value: 'LOW_PAYMENT', label: '적은 월 부담' },
  { value: 'ONLINE', label: '비대면 신청' },
  { value: 'POLICY', label: '정부/서민 지원' },
  { value: 'NO_PREPAY_FEE', label: '중도상환수수료 없음' },
]
export const PRIORITY_MAX = 3
