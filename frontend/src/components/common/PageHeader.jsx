import { Link } from 'react-router-dom'
import styled from 'styled-components'
import Icon from '../ui/Icon'

// CM-01 페이지 제목: 왼쪽에 제목(32) + 한 줄 설명, 오른쪽 끝에 현재 위치(홈 > 메뉴)
// crumbs: '홈' 다음에 오는 이름들 (예: ['대출 비교']). 마지막 이름이 현재 화면(주황 굵게)
const Wrap = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 20px;
  margin-bottom: 28px;
`

const Title = styled.h1`
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Description = styled.p`
  max-width: 60ch;
  margin-top: 8px;
  color: var(--cocoa);
  font-size: var(--fs-lg);
`

const Crumbs = styled.nav`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
  color: var(--muted);
  font-size: var(--fs-sm);
  white-space: nowrap;
`

const CrumbLink = styled(Link)`
  &:hover {
    color: var(--ink);
  }
`

const Current = styled.b`
  color: var(--brand-text);
  font-weight: 700;
`

function PageHeader({ crumbs = [], title, description }) {
  return (
    <Wrap>
      <div>
        <Title>{title}</Title>
        {description && <Description>{description}</Description>}
      </div>
      <Crumbs aria-label="현재 위치">
        <CrumbLink to="/">홈</CrumbLink>
        {crumbs.map((name, index) => (
          <span key={name}>
            <Icon name="chevron_right" size={13} />
            {index === crumbs.length - 1 ? <Current> {name}</Current> : ` ${name}`}
          </span>
        ))}
      </Crumbs>
    </Wrap>
  )
}

export default PageHeader
