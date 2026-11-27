import { createGlobalStyle } from 'styled-components'

// 기본 초기화 + :root 디자인 변수 + 다크 모드 (fe_design.md '공통 디자인' 값 그대로)
const GlobalStyle = createGlobalStyle`
  :root {
    /* 글꼴 */
    --f-ui: Pretendard, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    --f-num: Nunito, Pretendard, 'Malgun Gothic', sans-serif;
    --f-system: system-ui, -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;

    /* 글자 크기 */
    --fs-d1: 48px;
    --fs-d2: 40px;
    --fs-h1: 32px;
    --fs-h2: 28px;
    --fs-h3: 24px;
    --fs-h4: 20px;
    --fs-xl: 18px;
    --fs-lg: 16px;
    --fs-base: 15px;
    --fs-md: 14px;
    --fs-sm: 13px;
    --fs-xs: 12px;
    --fs-2xs: 11px;

    /* 바탕, 선, 글자 */
    --paper: #FFFFFF;
    --mist: #F6F4F2;
    --mist-2: #EEEAE6;
    --line: #EAE5E0;
    --line-2: #D8D0C9;
    --ink: #211C18;
    --ink-2: #4F453E;
    --cocoa: #75685F;
    --muted: #8C8178;

    /* 주황 */
    --brand: #FF7417;
    --brand-strong: #EC5E0C;
    --brand-hover: #D95409;
    --brand-text: #C24A06;
    --brand-soft: #FFF0E5;
    --on-brand: #FFFFFF;
    --sun: #FFAE2B;

    /* 상태 */
    --good: #12805A;
    --good-soft: #E6F4EC;
    --warn: #9A6400;
    --warn-soft: #FFF3D6;
    --bad: #D23B3B;
    --bad-soft: #FDECEC;
    --on-bad: #FFFFFF;

    /* 그래프 */
    --viz-1: #3B78C2;
    --viz-2: #EC5E0C;
    --viz-track: #EEEAE6;
    --viz-other: #D8D0C9;

    /* 메달, 강조, 막 */
    --gold: #E9A115;
    --silver: #A3ABB6;
    --bronze: #C47A3F;
    --hl: #FFEC99;
    --scrim: rgba(24, 19, 15, .42);
    /* 바탕(--paper) 위에 막(--scrim)을 덮은 색 한 가지: 창이 열려 뒤 화면을 잠근 동안 비워 둔 스크롤바 자리를 칠함 (막이 그 자리는 못 덮어서) */
    --scrim-on-paper: color-mix(in srgb, rgb(24, 19, 15) 42%, var(--paper));

    /* 그림자 */
    --shadow-1: 0 1px 2px rgba(33, 28, 24, .07), 0 0 0 1px rgba(33, 28, 24, .05);
    --shadow-pop: 0 18px 50px rgba(33, 28, 24, .18), 0 2px 6px rgba(33, 28, 24, .08);

    /* 모서리 */
    --r-xs: 8px;
    --r-sm: 12px;
    --r-md: 16px;
    --r-lg: 22px;
    --r-pill: 999px;

    /* 소셜 로그인 버튼 (각 회사 가이드 색 그대로. 다크 모드에서도 같은 색) */
    /* 카카오: 카카오 로그인 디자인 가이드 (컨테이너 #FEE500, 레이블 #000000 85%) */
    /* 네이버: 네이버 로그인 버튼 사용 가이드 지정 컬러 (배경 #03A94D, 로고, 레이블 #FFFFFF) */
    --kakao: #FEE500;
    --on-kakao: rgba(0, 0, 0, .85);
    --naver: #03A94D;
    --on-naver: #FFFFFF;

    /* 전환 시간 (색, 바탕 0.15s / 창, 패널 0.2s) */
    --t-fast: .15s;
    --t-pop: .2s;

    color-scheme: light dark;
  }

  @media (max-width: 899px) {
    :root {
      --fs-h1: 28px;
      --fs-h3: 20px;
    }
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #161311;
      --mist: #1F1B18;
      --mist-2: #29231F;
      --line: #2E2824;
      --line-2: #463D36;
      --ink: #F3EEE9;
      --ink-2: #D6CCC4;
      --cocoa: #B5A79C;
      --muted: #948880;

      --brand: #FF8636;
      --brand-strong: #FF7A2A;
      --brand-hover: #FF9550;
      --brand-text: #FF9F5E;
      --brand-soft: #35210F;
      --on-brand: #1A0F07;
      --sun: #FFBE4D;

      --good: #4CC38F;
      --good-soft: #12271D;
      --warn: #E9B54A;
      --warn-soft: #2B2210;
      --bad: #FF6F6F;
      --bad-soft: #311818;

      --viz-1: #3E8FD6;
      --viz-2: #E8661F;
      --viz-track: #29231F;
      --viz-other: #4A413A;

      --hl: #5C4A0E;
      --scrim: rgba(0, 0, 0, .62);
      --scrim-on-paper: color-mix(in srgb, rgb(0, 0, 0) 62%, var(--paper));

      --shadow-1: 0 0 0 1px #2E2824;
      --shadow-pop: 0 20px 60px rgba(0, 0, 0, .55), 0 0 0 1px #2E2824;
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
    /* 화면 스크롤바 자리를 늘 비워 둠 (스크롤이 필요 없는 쪽에서는 틀을 그리지 않고 자리만): 쪽을 옮기거나 창이 열려 뒤 화면을 잠가도(utils/scrollLock.js) 화면이 옆으로 밀리지 않게 */
    /* overflow-y를 auto로 따로 적어 둠: 비워 두면 잠글 때 body의 overflow가 화면 전체로 옮겨 가 잠금 방식이 달라짐 */
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  /* 비워 둔 스크롤바 자리 색: 평소에는 body 바탕(--paper)이 그대로 칠해짐 (다크 모드도 같음)
     창이 열려 잠긴 동안(scrollLock.js가 data-scroll-locked를 붙임)은 뒤 화면처럼 막을 덮은 색으로 */
  html[data-scroll-locked] {
    background-color: var(--scrim-on-paper);
  }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--f-ui);
    font-size: var(--fs-base);
    line-height: 1.6;
    letter-spacing: -.01em;
    word-break: keep-all;
    overflow-wrap: break-word;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* 시안 기본 초기화: 제목, 문단, 목록, 링크, 버튼 */
  h1,
  h2,
  h3,
  h4 {
    margin: 0;
    line-height: 1.3;
    letter-spacing: -.035em;
    text-wrap: balance;
  }

  p {
    margin: 0;
  }

  ul,
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  dl,
  dd {
    margin: 0;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    text-align: inherit;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
  }

  /* 키보드로 옮긴 곳 표시 (접근성: outline 지우기 금지) */
  :focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }

  /* 움직임 */
  @media (prefers-reduced-motion: reduce) {
    :root {
      --t-fast: 0s;
      --t-pop: 0s;
    }
  }
`

export default GlobalStyle
