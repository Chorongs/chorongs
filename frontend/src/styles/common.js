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
