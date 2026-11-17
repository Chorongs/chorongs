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
