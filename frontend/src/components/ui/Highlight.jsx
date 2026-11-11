import styled from 'styled-components'

// UI-20 검색어 강조: 글자를 검색어 기준으로 나눠 검색어 부분만 <mark>로 감쌈 (연노랑 --hl)
// HTML을 그대로 넣지 않고 글자로만 그린다 (E1). 검색어 속 특수문자는 글자 그대로 비교한다.
const Mark = styled.mark`
  border-radius: 2px;
  background: var(--hl);
  color: inherit;
`

// 검색어 속 ( ) [ ] * + ? 같은 정규식 기호를 글자로 바꿈
const escapeRegExp = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Highlight({ text, keyword }) {
  const source = String(text ?? '')
  const word = String(keyword ?? '').trim()
  if (!word) return source

  // 괄호로 감싸면 split 결과의 홀수 번째가 검색어와 같은 부분
  const parts = source.split(new RegExp(`(${escapeRegExp(word)})`, 'gi'))
  return parts.map((part, index) =>
    index % 2 === 1 ? <Mark key={index}>{part}</Mark> : part,
  )
}

export default Highlight
