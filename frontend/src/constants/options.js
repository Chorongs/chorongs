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
