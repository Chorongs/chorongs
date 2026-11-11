import styled from 'styled-components'

// UI-03 아이콘: src/assets/icons/ 의 SVG를 name 으로 불러 쓴다. (name="close" → close.svg)
// 글자 색(currentColor)을 따라가도록 SVG를 마스크로 깔아 그린다.
const ICON_URLS = import.meta.glob('../../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const Mark = styled.span`
  display: inline-block;
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  background: currentColor;
  ${({ $src }) =>
    $src &&
    `
    -webkit-mask: url("${$src}") center / contain no-repeat;
    mask: url("${$src}") center / contain no-repeat;
  `}
`

// size: 기본 18 / 작은 16 / 글자 옆 13
function Icon({ name, size = 18 }) {
  const src = ICON_URLS[`../../assets/icons/${name}.svg`]
  // 없는 이름이면 오류 없이 빈 칸
  return <Mark $src={src} $size={size} aria-hidden="true" />
}

export default Icon
