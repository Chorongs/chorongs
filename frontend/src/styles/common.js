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
const BUTTON_FONT = {
  base: 'var(--fs-base)',
  sm: 'var(--fs-sm)',
  rating: 'var(--fs-sm)',
  lg: 'var(--fs-lg)',
}

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
    background: var(--mist-2);
    color: var(--ink);
    &:hover:not(:disabled) {
      background: var(--line);
    }
  `,
  ghost: css`
    background: transparent;
    color: var(--ink-2);
    &:hover:not(:disabled) {
      background: var(--mist);
    }
  `,
}

export const Button = styled.button.attrs((props) => ({
  type: props.type || 'button',
}))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: ${({ $size }) => BUTTON_HEIGHT[$size] || BUTTON_HEIGHT.base};
  padding: 0 ${({ $size }) => ($size === 'sm' || $size === 'rating' ? '12px' : '20px')};
  border: 1px solid transparent;
  border-radius: ${({ $size }) => ($size === 'rating' ? 'var(--r-xs)' : 'var(--r-sm)')};
  font-size: ${({ $size }) => BUTTON_FONT[$size] || BUTTON_FONT.base};
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
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
    background: var(--mist-2);
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
  height: ${({ $size }) => ($size === 'sm' ? '32px' : '38px')};
  padding: 0 16px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-pill);
  background: var(--paper);
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
  &:hover:not(:disabled) {
    background: var(--mist);
  }
  &[aria-pressed='true'] {
    border-color: var(--brand);
    background: var(--brand-soft);
    color: var(--brand-text);
    font-weight: 700;
  }
  ${disabledStyle}
`

// UI-13 작은 딱지: $variant (default 회색 / good 충족 / warn 주의 / bad 위험)
const tagVariant = {
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
    background: var(--mist-2);
    color: var(--ink-2);
  `,
}

export const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--r-xs);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-align: center;
  ${({ $variant }) => tagVariant[$variant] || tagVariant.default}
`

// UI-17 입력 오류 문구: 비어 있으면 자리 차지 안 함
export const InlineError = styled.p.attrs({ role: 'alert' })`
  margin: 0;
  color: var(--bad);
  font-size: var(--fs-sm);
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
