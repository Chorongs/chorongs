import { useId, useState } from 'react'
import styled from 'styled-components'
import Icon from './Icon'

// UI-14 펼치기/접기: 제목 줄을 누르면 내용이 펼쳐지고, 다시 누르면 접힘
// title: 글자 또는 요소 (검색어 강조 Highlight 등) / defaultOpen: 처음부터 펼침
const Wrap = styled.div`
  border-bottom: 1px solid var(--line);
`

const Head = styled.button.attrs({ type: 'button' })`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 16px 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--fs-xl);
  font-weight: 800;
  text-align: left;
  cursor: pointer;
`

const Arrow = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  color: var(--cocoa);
  transition: transform var(--t-pop);
  transform: rotate(${({ $isOpen }) => ($isOpen ? '180deg' : '0deg')});
`

const Body = styled.div`
  padding: 0 0 20px;
  color: var(--ink-2);
  font-size: var(--fs-base);
  text-align: left;
`

function Accordion({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <Wrap>
      <Head
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{title}</span>
        <Arrow $isOpen={isOpen}>
          <Icon name="chevron_down" />
        </Arrow>
      </Head>
      <Body id={bodyId} hidden={!isOpen}>
        {children}
      </Body>
    </Wrap>
  )
}

export default Accordion
