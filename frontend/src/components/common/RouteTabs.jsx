import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

// CM-03 주소 연결 탭: 누르면 주소도 바뀌는 밑줄 탭 (상품 찾기, 계산기, 금융 진단)
// 현재 탭은 진한 글자 + 검정 3px 밑줄 (시안과 같게)
// tabs: [{ label, to, end }] (end: true면 그 주소일 때만 현재 탭)
const Bar = styled.nav`
  display: flex;
  gap: 28px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`

const Tab = styled(NavLink)`
  position: relative;
  flex-shrink: 0;
  padding: 4px 0 14px;
  color: var(--muted);
  font-size: var(--fs-xl);
  font-weight: 700;
  white-space: nowrap;
  &:hover {
    color: var(--ink);
  }
  &.active {
    color: var(--ink);
    font-weight: 800;
  }
  &.active::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 3px;
    border-radius: 3px;
    background: var(--ink);
  }
`

function RouteTabs({ tabs, label = '화면 탭' }) {
  return (
    <Bar aria-label={label}>
      {tabs.map((tab) => (
        <Tab key={tab.to} to={tab.to} end={tab.end}>
          {tab.label}
        </Tab>
      ))}
    </Bar>
  )
}

export default RouteTabs
