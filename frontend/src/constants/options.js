// 선택지, 코드 → 화면 글자 표 (코드는 서버 API 시트와 같게)
// 지금은 CM-04, CM-07이 쓰는 값만 있다. 나머지(직업, 지역, 자금 용도 등)는 쓰는 이슈에서 추가한다.

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
