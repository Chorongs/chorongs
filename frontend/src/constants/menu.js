// 메뉴 목록 한 곳 관리: 상단 메뉴(LY-05), 모바일 탭바(LY-14), 모바일 전체 메뉴(LY-15)가 같이 씀
// end: true → 하위 주소는 현재 메뉴로 안 치고 그 주소일 때만 현재 메뉴로 표시

// 상단 메뉴 7개 (하위 주소도 현재 메뉴로 표시: /search/simple → 상품 찾기, /calc/* → 계산기)
export const NAV_MENU = [
  { label: '맞춤 추천', to: '/', end: true },
  { label: '상품 찾기', to: '/search' },
  { label: '대출 비교', to: '/compare' },
  { label: '대출 랭킹', to: '/ranking' },
  { label: '계산기', to: '/calc' },
  { label: '금융 진단', to: '/diagnosis' },
  { label: '도움말', to: '/help' },
]

// 모바일 하단 탭바 (마지막 '전체' 버튼은 전체 메뉴를 여는 버튼이라 목록에 없음)
export const TAB_MENU = [
  { label: '추천', to: '/', end: true },
  { label: '상품 찾기', to: '/search' },
  { label: '비교', to: '/compare' },
  { label: '계산기', to: '/calc' },
]

// 도움말 메뉴
export const HELP_MENU = [
  { label: '자주 묻는 질문', to: '/help/faq' },
  { label: '대출 용어 사전', to: '/help/terms' },
  { label: '필요 서류 체크리스트', to: '/help/docs' },
  { label: '불법 금융 대응', to: '/help/illegal' },
  { label: '금융 TIP', to: '/help/tips' },
]

// 모바일 전체 메뉴 (묶음별)
export const FULL_MENU = [
  {
    title: '대출 찾기',
    items: [
      { label: '맞춤 추천', to: '/', end: true },
      { label: '상세 검색', to: '/search', end: true },
      { label: '간편 검색', to: '/search/simple' },
      { label: '대출 랭킹', to: '/ranking' },
    ],
  },
  {
    title: '비교, 계산',
    items: [
      { label: '대출 비교', to: '/compare' },
      { label: '대출 이자 계산기', to: '/calc', end: true },
      { label: '대출 갈아타기 계산기', to: '/calc/change' },
      { label: 'DSR 계산기', to: '/calc/dsr' },
      { label: '상환능력 기반 대출 계산기', to: '/calc/reverse' },
      { label: '내 집 대출한도 계산기', to: '/calc/home' },
    ],
  },
  {
    title: '금융 진단',
    items: [
      { label: '신용 셀프 진단', to: '/diagnosis/credit' },
      { label: '소비 습관 분석', to: '/diagnosis/habit' },
    ],
  },
  { title: '도움말', items: HELP_MENU },
]
