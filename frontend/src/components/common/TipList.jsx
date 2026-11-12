import styled from 'styled-components'
import Icon from '../ui/Icon'

// CM-15 팁 목록: 전구 아이콘 + 팁 한 줄씩 (신용 개선 팁, 실천 포인트)
// items: 글자 목록
const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Item = styled.li`
  display: flex;
  gap: 8px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  line-height: 1.55;
`

const Bulb = styled.span`
  display: inline-flex;
  flex: none;
  margin-top: 2px;
  color: var(--brand-text);
`

function TipList({ items = [] }) {
  if (items.length === 0) return null

  return (
    <List>
      {items.map((tip) => (
        <Item key={tip}>
          <Bulb>
            <Icon name="bulb" size={18} />
          </Bulb>
          <span>{tip}</span>
        </Item>
      ))}
    </List>
  )
}

export default TipList
