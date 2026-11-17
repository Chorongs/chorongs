import styled from 'styled-components'

// CM-14 안내, 고지 문구: 화면 아래 작은 회색 글 13px (글은 children)
const Text = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.65;
`

function Disclaimer({ children }) {
  return <Text>{children}</Text>
}

export default Disclaimer
