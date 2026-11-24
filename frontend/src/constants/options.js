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
// 문항 5(이용 금융권)는 여러 개 고르는 필수 문항. '없음' 보기는 CreditCheck가 화면에서만 붙임 (서버에는 빈 목록)
export const CREDIT_QUESTIONS = [
  { no: 1, label: '1년 내 연체', title: '최근 1년 안에 30일 이상 연체한 적이 있나요?', options: ['없음', '1회', '2회 이상'] },
  { no: 2, label: '3개월 내 연체', title: '최근 3개월 안에 가장 길었던 연체 기간은 얼마인가요?', options: ['없음', '10일 미만', '10~29일', '30일 이상'] },
  { no: 3, label: '채무조정 이력', title: '최근 5년 안에 신용회복, 채무조정, 연체 등록 이력이 있나요?', options: ['없음', '있음'] },
  { no: 4, label: '대출 건수', title: '지금 갚고 있는 대출은 몇 건인가요?', options: ['0건', '1건', '2~3건', '4건 이상'] },
  {
    no: 5,
    label: '이용 금융권',
    title: '이용 중인 금융권을 모두 골라 주세요.',
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
// 장기 용도와 기간 값은 아래 추천 입력 선택지의 HOUSING_PURPOSES, MONTHS_OPTIONS_HOUSING, MONTHS_OPTIONS_DEFAULT를 같이 씀 (같은 값을 두 벌 두지 않으려고)

// 용도 목록(두 상품이 겹치는 용도)이 전부 장기 용도일 때만 장기 선택지
export function getTermOptions(purposes) {
  const list = purposes ?? []
  const isLong = list.length > 0 && list.every((purpose) => HOUSING_PURPOSES.includes(purpose))
  return isLong ? MONTHS_OPTIONS_HOUSING : MONTHS_OPTIONS_DEFAULT
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

// ===== 상품 찾기 (SR-02~09, CHORONG-64) =====

// 상세 검색 필터 8줄 (SR-03 줄 순서). key = 주소 값 이름 = API-01 보내는 값 이름
export const SEARCH_FILTERS = [
  { key: 'target', label: '지원 대상' },
  { key: 'purpose', label: '자금 용도' },
  { key: 'amount', label: '필요 금액' },
  { key: 'repay', label: '상환 방법' },
  { key: 'fin', label: '금융권' },
  { key: 'inst', label: '취급기관' },
  { key: 'region', label: '지원 지역' },
  { key: 'credit', label: '신용점수 구간' },
]

// 금융권 대분류 칩 아래 작은 글씨 (정책금융은 없음)
export const FIN_GROUP_NOTE = { 은행권: '1금융권', 비은행권: '2금융권' }

export const SEARCH_QUERY_MAX = 50 // 검색어 글자 수
export const SEARCH_FILTER_MAX = 20 // 한 필터에서 고를 수 있는 칩 수 (서버 B19)
export const SEARCH_PAGE_SIZE = 20 // [더 보기] 한 번에 받는 상품 수 (서버 최대 50)

// 금리 탭 (rt): 주소 값은 코드, 화면 글은 명세서 이름
export const RATE_TAB_OPTIONS = [
  { value: 'NUM', label: '금리 표시 상품' },
  { value: 'MEMO', label: '금리 기관 문의 상품' },
]

// 정렬 (sort). 금리 기관 문의 탭에서는 금리 낮은 순을 끔
export const SEARCH_SORT_OPTIONS = [
  { value: 'base', label: '기본 순' },
  { value: 'rate', label: '금리 낮은 순' },
  { value: 'limit', label: '한도 높은 순' },
  { value: 'views', label: '많이 본 순' },
]

// 간편 검색 키워드 14개 (그룹별, 서버 API-07 보내는 값과 같은 글). 최대 5개 고름
export const KEYWORD_GROUPS = [
  { key: 'who', label: '나는', keywords: ['사회초년생', '대학생', '프리랜서', '자영업자', '신용점수 낮음'] },
  { key: 'want', label: '원하는 건', keywords: ['낮은 금리', '큰 한도', '긴 상환기간', '중도상환수수료 없음', '비대면'] },
  { key: 'now', label: '지금 상황', keywords: ['생활비 급함', '갈아타기', '전월세', '창업 준비'] },
]
export const KEYWORD_ALL = KEYWORD_GROUPS.flatMap((group) => group.keywords)
export const KEYWORD_MAX = 5

// 키워드 값 → 화면 글 (시안 모양. 서버로는 값을 보냄). 없으면 값 그대로
export const KEYWORD_LABEL = {
  대학생: '대학생/취준생',
  '신용점수 낮음': '신용점수가 낮아요',
  비대면: '비대면/모바일',
  '생활비 급함': '생활비가 급해요',
  갈아타기: '기존 대출 갈아타기',
  전월세: '전월세 보증금',
}
export const getKeywordLabel = (keyword) => KEYWORD_LABEL[keyword] ?? keyword

// 자주 쓰는 조합 5개 (SR-08): 키워드는 위 14개 안에서만
export const KEYWORD_PRESETS = [
  { name: '사회초년생 첫 대출', summary: '낮은 금리 / 수수료 없음', keywords: ['사회초년생', '낮은 금리', '중도상환수수료 없음'] },
  { name: '급한 생활비', summary: '생활비 / 비대면', keywords: ['생활비 급함', '비대면'] },
  { name: '고금리 대출 갈아타기', summary: '낮은 금리 / 긴 기간', keywords: ['갈아타기', '낮은 금리', '긴 상환기간'] },
  { name: '프리랜서 자금 공백', summary: '프리랜서 / 비대면', keywords: ['프리랜서', '비대면'] },
  { name: '청년 전월세', summary: '보증금 / 낮은 금리', keywords: ['사회초년생', '전월세', '낮은 금리'] },
]

// 관리자 화면 글자표 (AD-03~06, 09~11). 코드 값은 서버 API 시트 그대로 (API-46, 48)
export const ADMIN_ROLE_LABEL = {
  APPROVER: '승인권자',
  MANAGER: '관리자',
}

export const ADMIN_STATUS_LABEL = {
  PENDING: '승인 대기',
  ACTIVE: '정상',
}

// 갱신 출처 (API-32 sources)
export const IMPORT_SOURCE_OPTIONS = [
  { value: 'KINFA', label: '서민금융진흥원' },
  { value: 'FSS', label: '금융감독원' },
]
// 출처 코드 → 이름 (관리자 바뀐 상품 표, 반영 이력)
export const IMPORT_SOURCE_LABEL = Object.fromEntries(IMPORT_SOURCE_OPTIONS.map((option) => [option.value, option.label]))

// 바뀐 상품 구분 (API-33 items[].diffType, FastAPI 값 그대로)
export const IMPORT_CHANGE_TYPE_LABEL = {
  NEW: '신규',
  CHANGE: '변경',
  REMOVE: '판매 중단',
  REOPEN: '다시 게시',
  CHECK: '확인 필요',
}

// 확인 필요 사유 (API-33 items[].checkReasons)
export const CHECK_REASON_LABEL = {
  NO_NAME: '상품명이나 기관 정보가 비어 있어요',
  RATE_REVERSED: '최저 금리가 최고 금리보다 높아요',
  RATE_OVER_20: '최고 금리가 연 20%를 넘어요',
  NEW_PHRASE: '칩에 넣지 못한 새 문구가 있어요',
}

// 반영 이력 종류 (API-35 actionType)
export const HISTORY_ACTION_TYPE_LABEL = {
  INIT: '초기 적재',
  PUBLISH: '반영',
  AUTO_CLOSE: '자동 내림',
  HIDE: '숨기기',
  SHOW: '다시 보이기',
  ROLLBACK: '되돌리기',
}

// 자동 내림 상태 (API-48 filter와 같은 코드)
export const AUTO_CLOSED_STATUS_LABEL = {
  UNCHECKED: '확인 전',
  KEEP: '확인함',
  REOPEN: '다시 게시함',
}
