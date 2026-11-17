// 메뉴 목록 한 곳 관리: 상단 메뉴(LY-05), 모바일 탭바(LY-14), 모바일 전체 메뉴(LY-15)가 같이 씀
// end: true → 하위 주소는 현재 메뉴로 안 치고 그 주소일 때만 현재 메뉴로 표시
// icon: assets/icons/ 의 아이콘 이름 (전체 메뉴에서 글자 앞에 보임)
// match: 이 주소와 그 하위 주소도 현재 메뉴로 표시 (to와 다를 때만 씀)
// isRecommend: '캐링 추천' 메뉴. 추천받기 전이면 주소 이동 대신 추천 창을 열고, 받은 뒤면 to(/recommend)로 이동

// 도움말 메뉴 (시안 순서)
export const HELP_MENU = [
  { label: '자주 묻는 질문', to: '/help/faq', icon: 'help' },
  { label: '필요 서류 체크리스트', to: '/help/docs', icon: 'doc' },
  { label: '대출 용어 사전', to: '/help/terms', icon: 'book' },
  { label: '금융 TIP', to: '/help/tips', icon: 'bulb' },
  { label: '불법 금융 대응', to: '/help/illegal', icon: 'shield' },
]

// 상단 메뉴 7개 (하위 주소도 현재 메뉴로 표시: /search/simple → 상품 찾기, /calc/* → 계산기)
// children: 메뉴에 마우스를 올리면 한꺼번에 펼쳐지는 하위 메뉴
export const NAV_MENU = [
  { label: '캐링 추천', to: '/recommend', isRecommend: true },
  {
    label: '상품 찾기',
    to: '/search/simple',
    match: '/search',
    children: [
      { label: '간편 검색', to: '/search/simple' },
      { label: '상세 검색', to: '/search', end: true },
    ],
  },
  { label: '대출 비교', to: '/compare' },
  {
    label: '대출 랭킹',
    to: '/ranking',
    children: [
      { label: '금리순', to: '/ranking?metric=rate' },
      { label: '한도순', to: '/ranking?metric=limit' },
      { label: '기간순', to: '/ranking?metric=term' },
      { label: '인기순', to: '/ranking?metric=views' },
    ],
  },
  {
    label: '계산기',
    to: '/calc',
    children: [
      { label: '대출 이자', to: '/calc', end: true },
      { label: '대출 갈아타기', to: '/calc/change' },
      { label: 'DSR', to: '/calc/dsr' },
      { label: '내 집 대출한도', to: '/calc/home' },
      { label: '상환능력 기반 대출', to: '/calc/reverse' },
    ],
  },
  {
    label: '금융 진단',
    to: '/diagnosis',
    children: [
      { label: '신용 셀프 진단', to: '/diagnosis/credit' },
      { label: '소비 습관 분석', to: '/diagnosis/habit' },
    ],
  },
  { label: '도움말', to: '/help', children: HELP_MENU },
]

// 모바일 하단 탭바 (마지막 '전체' 버튼은 전체 메뉴를 여는 버튼이라 목록에 없음)
export const TAB_MENU = [
  { label: '추천', to: '/recommend', isRecommend: true, icon: 'home' },
  { label: '상품 찾기', to: '/search/simple', match: '/search', icon: 'search' },
  { label: '비교', to: '/compare', icon: 'compare' },
  { label: '계산기', to: '/calc', icon: 'calc' },
]

// 모바일 전체 메뉴 (묶음별)
export const FULL_MENU = [
  {
    title: '대출 찾기',
    items: [
      { label: '캐링 추천', to: '/recommend', isRecommend: true, icon: 'home' },
      { label: '간편 검색', to: '/search/simple', icon: 'spark' },
      { label: '상세 검색', to: '/search', end: true, icon: 'search' },
      { label: '대출 비교', to: '/compare', icon: 'compare' },
      { label: '대출 랭킹', to: '/ranking', icon: 'trophy' },
    ],
  },
  {
    title: '계산기',
    items: [
      { label: '대출 이자 계산기', to: '/calc', end: true, icon: 'calc' },
      { label: '대출 갈아타기 계산기', to: '/calc/change', icon: 'refresh' },
      { label: 'DSR 계산기', to: '/calc/dsr', icon: 'chart' },
      { label: '내 집 대출한도 계산기', to: '/calc/home', icon: 'home' },
      { label: '상환능력 기반 대출 계산기', to: '/calc/reverse', icon: 'coin' },
    ],
  },
  {
    title: '금융 진단',
    items: [
      { label: '신용 셀프 진단', to: '/diagnosis/credit', icon: 'gauge' },
      { label: '소비 습관 분석', to: '/diagnosis/habit', icon: 'wallet' },
    ],
  },
  { title: '도움말', items: HELP_MENU },
]
