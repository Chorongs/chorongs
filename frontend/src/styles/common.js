import styled, { css } from 'styled-components'

// 여러 곳에서 같이 쓰는 모양 (UI-01, 02, 04, 05, 06, 13, 17, 19)
// 색, 크기는 GlobalStyle :root 변수만 쓴다.

// 잠금(disabled): 투명도 0.4, 마우스 올림 효과 없음
const disabledStyle = css`
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

// UI-01 버튼: $variant (primary 기본 / outline / soft / ghost), $size (base 기본 / sm / rating / lg)
const BUTTON_HEIGHT = { base: '48px', sm: '36px', rating: '30px', lg: '56px' }

const buttonVariant = {
  primary: css`
    background: var(--brand-strong);
    color: var(--on-brand);
    &:hover:not(:disabled) {
      background: var(--brand-hover);
    }
  `,
  outline: css`
    background: var(--paper);
    color: var(--ink);
    border-color: var(--line-2);
    &:hover:not(:disabled) {
      background: var(--mist);
    }
  `,
  soft: css`
    background: var(--mist);
    color: var(--ink);
    &:hover:not(:disabled) {
      background: var(--mist-2);
    }
  `,
  ghost: css`
    background: transparent;
    color: var(--ink-2);
    &:hover:not(:disabled) {
      background: var(--mist);
    }
  `,
  // 소셜 로그인 버튼 (CHORONG-43): 글자 앞에 공식 심볼 <img alt="" />, 글자 --fs-lg (fe_design 카카오/네이버 버튼)
  // 가이드가 정한 색 밖으로 바꾸지 않게 마우스 올림 색 변화 없음 / 모서리는 기본 --r-sm(12px) = 카카오 가이드 radius 12
  // 심볼 파일은 둥근 바탕이 버튼과 같은 색이라 바탕은 안 보이고 말풍선, N만 보임
  // 둥근 바탕의 안 보이는 여백만큼 음수 margin으로 당겨, 보이는 심볼 + 글자 묶음이 버튼 가운데에 오고 심볼과 글자 사이가 8px이 되게 함
  // 기본 높이(48) 버튼 전용 (심볼 크기를 px로 정함)
  // 카카오: kakao_symbol.svg 30px → 말풍선 약 14px (공식 medium 버튼과 같은 비율), 양옆 안 보이는 여백 약 8px
  kakao: css`
    gap: 0;
    background: var(--kakao);
    color: var(--on-kakao);
    font-size: var(--fs-lg);
    font-weight: 600;
    & > img {
      height: 30px;
      margin-left: -8px;
    }
  `,
  // 네이버 로그인 버튼 사용 가이드: 배경 #03A94D, 로고, 레이블 #FFFFFF / 완성형 N 로고 16px 이상 / 가운데 정렬 때 로고와 레이블 간격 8px
  //   / 레이블은 로고 높이보다 작게 (글자 16px의 실제 글자 높이는 16px보다 작음)
  // naver_symbol.png 44px → N 16.5px (아이콘의 37.5%), 양옆 안 보이는 여백 13.75px → 왼쪽 -13.75px, 오른쪽 -5.75px(간격 8px)
  naver: css`
    gap: 0;
    background: var(--naver);
    color: var(--on-naver);
    font-size: var(--fs-lg);
    font-weight: 600;
    & > img {
      height: 44px;
      margin: 0 -5.75px 0 -13.75px;
    }
  `,
}

// 글자: 주 버튼 --fs-lg 800 / 나머지 --fs-base 700 (크기와 상관없이)
const isPrimary = ({ $variant }) => !$variant || $variant === 'primary'

export const Button = styled.button.attrs((props) => ({
  type: props.type || 'button',
}))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: ${({ $size }) => BUTTON_HEIGHT[$size] || BUTTON_HEIGHT.base};
  padding: 0 ${({ $size }) => ($size === 'sm' || $size === 'rating' ? '13px' : '20px')};
  border: 1px solid transparent;
  border-radius: ${({ $size }) => ($size === 'rating' ? 'var(--r-xs)' : 'var(--r-sm)')};
  font-size: ${(props) => (isPrimary(props) ? 'var(--fs-lg)' : 'var(--fs-base)')};
  font-weight: ${(props) => (isPrimary(props) ? 800 : 700)};
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), transform .1s;
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
  /* 다른 화면으로 가는 버튼: 글자 뒤 <Icon name="arrow" size={13} />을 -45도 돌려 ↗ 모양으로 */
  & [data-icon='arrow'] {
    transform: rotate(-45deg);
  }
  ${({ $variant }) => buttonVariant[$variant] || buttonVariant.primary}
  ${disabledStyle}
`

// UI-02 아이콘 버튼: 칸 36 x 36. aria-label 필수 (쓰는 곳에서 꼭 넣는다)
export const IconButton = styled.button.attrs((props) => ({
  type: props.type || 'button',
}))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition: background var(--t-fast);
  &:hover:not(:disabled) {
    background: var(--mist);
    color: var(--ink);
  }
  ${disabledStyle}
`

// UI-04 카드: 안쪽 여백 22 (모바일 18), 모서리 16
export const Card = styled.div`
  padding: 22px;
  border-radius: var(--r-md);
  background: var(--paper);
  box-shadow: var(--shadow-1);
  @media (max-width: 899px) {
    padding: 18px;
  }
`

// UI-05 큰 회색 판: 안쪽 여백 28 (모바일 20), 모서리 22
export const Panel = styled.div`
  padding: 28px;
  border-radius: var(--r-lg);
  background: var(--mist);
  @media (max-width: 899px) {
    padding: 20px;
  }
`

// UI-06 칩: 높이 38 / 작은 32 ($size="sm"), 선택 상태는 aria-pressed
export const Chip = styled.button.attrs((props) => ({
  type: props.type || 'button',
}))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: ${({ $size }) => ($size === 'sm' ? '32px' : '38px')};
  padding: 0 ${({ $size }) => ($size === 'sm' ? '12px' : '15px')};
  border: 1px solid var(--line-2);
  border-radius: var(--r-pill);
  background: var(--paper);
  color: var(--ink-2);
  font-size: ${({ $size }) => ($size === 'sm' ? 'var(--fs-sm)' : 'var(--fs-md)')};
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
  &:hover:not(:disabled) {
    border-color: var(--cocoa);
    color: var(--ink);
  }
  &[aria-pressed='true'] {
    border-color: var(--brand);
    background: var(--brand-soft);
    color: var(--brand-text);
    font-weight: 800;
  }
  ${disabledStyle}
`

// UI-13 작은 딱지: $variant (default 회색 / acc 주황 강조 / good 충족 / warn 주의 / bad 위험)
const tagVariant = {
  acc: css`
    background: var(--brand-soft);
    color: var(--brand-text);
  `,
  good: css`
    background: var(--good-soft);
    color: var(--good);
  `,
  warn: css`
    background: var(--warn-soft);
    color: var(--warn);
  `,
  bad: css`
    background: var(--bad-soft);
    color: var(--bad);
  `,
  default: css`
    background: var(--mist);
    color: var(--ink-2);
  `,
}

export const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border-radius: var(--r-xs);
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
  text-align: center;
  ${({ $variant }) => tagVariant[$variant] || tagVariant.default}
`

// 입력 단계 화면(맞춤 추천 1~3단계, CHORONG-45)이 같이 쓰는 칸 모양 (명세서 UI 번호는 변경 요청 중)
// FormStack: 칸들을 세로로 쌓음 / FormField: 칸 하나 (이름 + 입력 + 오류) / FormLabel: 칸 이름
// FormLabelNote: 칸 이름 옆 작은 안내 (예: '청년 상품 확인에만 써요')
export const FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

export const FormField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const FormLabel = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

export const FormLabelNote = styled.small`
  margin-left: 4px;
  color: var(--muted);
  font-size: var(--fs-xs);
  font-weight: 500;
`

// 계산기 5종(CA-02, 08–11)이 같이 쓰는 모양 (가안 .calc-grid, .calc-form)
// CalcLayout: 왼쪽 입력 판 + 오른쪽 결과 (좁으면 세로) / CalcPanel: 입력 판 / CalcFormStack: 입력칸을 세로로 (간격 16)
// 크기는 화면 폭이 아니라 계산기 칸(CalculatorPage의 container 'calcarea') 폭으로 정함: 오른쪽에 계산 기록 칸(300 + 간격 48)이 생기면
// 그만큼 좁아진 폭에 맞춰 바뀌어 결과(회차별 표)에 가로 스크롤이 생기지 않게 함
// 칸 폭 1037 이상: 왼쪽 392, 간격 28 / 900-1036: 왼쪽 356, 간격 20 (결과 열 524 이상) / 900 미만: 세로 한 줄
export const CalcLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 392px) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  @container calcarea (max-width: 1036px) {
    grid-template-columns: minmax(0, 356px) minmax(0, 1fr);
    gap: 20px;
  }
  @container calcarea (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

export const CalcPanel = styled(Panel)`
  @container calcarea (max-width: 1036px) {
    padding: 22px;
  }
  @container calcarea (max-width: 899px) {
    padding: 20px;
  }
`

export const CalcFormStack = styled(FormStack)`
  gap: 16px;
`

// CalcLinkButton: 글자만 있는 주황 링크 모양 버튼 (가안 .link): 대출 줄의 [삭제]
export const CalcLinkButton = styled.button.attrs((props) => ({
  type: props.type || 'button',
}))`
  flex: none;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--brand-text);
  font-size: var(--fs-md);
  font-weight: 700;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`

// CalcKv: 결과 상세 목록 (가안 .kv): <CalcKv><dt>제목</dt><dd>값</dd> ... </CalcKv>, 줄마다 아래 선
export const CalcKv = styled.dl`
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  margin: 0;
  & > dt,
  & > dd {
    margin: 0;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-md);
  }
  & > dt {
    color: var(--cocoa);
    font-weight: 600;
  }
  & > dd {
    color: var(--ink);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
`

// ChipGrid: 칩 묶음(ChipGroup)을 격자로 (기본 3칸, $columns로 바꿈), 칩 글자는 작게
export const ChipGrid = styled.div`
  & > [role='group'] {
    display: grid;
    grid-template-columns: repeat(${({ $columns }) => $columns ?? 3}, minmax(0, 1fr));
    gap: 6px;
  }

  & button {
    min-width: 0;
    padding: 0 6px;
    overflow: hidden;
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    text-overflow: ellipsis;
  }

  /* 고른 칩도 바탕은 흰색, 주황은 테두리와 글자만 (가안 .st-pane .chip) */
  & button[aria-pressed='true'] {
    background: var(--paper);
  }

  @media (min-width: 900px) {
    & button {
      padding: 0 13px;
    }
  }
`

// SegmentedFull: 선택 버튼 묶음(Segmented)을 가로 가득 반반으로
export const SegmentedFull = styled.div`
  & > [role='group'] {
    display: flex;
    width: 100%;
  }

  & button {
    flex: 1;
    padding: 0 4px;
    font-size: var(--fs-sm);
  }
`

// UI-17 입력 오류 문구: 비어 있으면 자리 차지 안 함
export const InlineError = styled.p.attrs({ role: 'alert' })`
  margin: 0;
  color: var(--bad);
  font-size: var(--fs-sm);
  font-weight: 600;
  &:empty {
    display: none;
  }
`

// UI-19 빈 상태 상자: 점선 상자, 안쪽 여백 36px 20px, 글자 14 가운데
export const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 36px 20px;
  border: 1px dashed var(--line-2);
  border-radius: var(--r-md);
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
`

// 비교 A/B 칸 딱지 (비교함, 비교 화면, 사이드바 공통): $slot 'A'(주황) / 'B'(파랑), $size 크기 px (기본 30, 작으면 모서리 8)
const slotFontSize = (size) => (size >= 30 ? 'var(--fs-base)' : size >= 22 ? 'var(--fs-xs)' : 'var(--fs-2xs)')

export const SlotBadge = styled.span`
  display: grid;
  flex: none;
  place-items: center;
  width: ${({ $size = 30 }) => $size}px;
  height: ${({ $size = 30 }) => $size}px;
  border-radius: ${({ $size = 30 }) => ($size >= 30 ? 'var(--r-sm)' : 'var(--r-xs)')};
  background: ${({ $slot }) => ($slot === 'B' ? 'var(--viz-1)' : 'var(--viz-2)')};
  color: #fff;
  font-family: var(--f-num);
  font-size: ${({ $size = 30 }) => slotFontSize($size)};
  font-weight: 900;
`

// [+ 비교] 버튼 (상품 한 줄, 상품 상세 창 공통): $state 'in' 담김(연주황 바탕 + 주황 테두리) / 'no' 비교 불가(흐린 글자 + 점선)
export const CompareButton = styled(Button)`
  ${({ $state }) =>
    $state === 'in' &&
    css`
      border-color: var(--brand);
      background: var(--brand-soft);
      color: var(--brand-text);
      &:hover:not(:disabled) {
        background: var(--brand-soft);
      }
    `}
  ${({ $state }) =>
    $state === 'no' &&
    css`
      border-style: dashed;
      color: var(--muted);
    `}
`

// 숫자 + 작은 단위 글자 모양 (CM-12 MoneyText, RateText 공통): Num 숫자 / Unit 작은 단위
// $weight: 숫자 굵기 / $size: 단위 크기 'xs' | 'sm' | 'base' / $tone: 단위 색 'inherit'(숫자와 같은 색) | 'muted'(설명 글자색) | 'soft'(숫자색을 옅게)
const UNIT_SIZE = { xs: 'var(--fs-xs)', sm: 'var(--fs-sm)', base: 'var(--fs-base)' }
const UNIT_WEIGHT = { xs: 800, sm: 700, base: 800 }

export const Num = styled.span`
  font-family: var(--f-num);
  font-variant-numeric: tabular-nums;
  font-weight: ${({ $weight }) => $weight};
`

export const Unit = styled.small`
  margin-left: 2px;
  color: ${({ $tone }) => ($tone === 'muted' ? 'var(--cocoa)' : 'inherit')};
  font-family: var(--f-ui);
  font-size: ${({ $size }) => UNIT_SIZE[$size]};
  font-weight: ${({ $size }) => UNIT_WEIGHT[$size]};
  opacity: ${({ $tone }) => ($tone === 'soft' ? 0.8 : 1)};
`

// 바로가기 판 (RC-10 도구 바로가기, RC-11 도움말 바로가기): 연회색 큰 판, 위 글과 아래 버튼을 위아래 끝으로 벌림
// 공통 Panel(UI-05)보다 여백이 넓어 따로 둠
export const ShortcutPanel = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  padding: 44px 40px;
  border-radius: var(--r-lg);
  background: var(--mist);

  @media (max-width: 899px) {
    padding: 28px 20px 20px;
  }
`
