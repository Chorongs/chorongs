import styled from 'styled-components'

// CM-02 구역 제목줄: 제목(24) / 설명 / 오른쪽 링크, 버튼 (children). 제목과 내용 간격 20
// size: 'md'면 제목 20 (MY 구역처럼 한 화면에 구역이 하나인 곳)
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 20px;
`

const Title = styled.h2`
  font-size: ${({ $size }) => ($size === 'md' ? 'var(--fs-h4)' : 'var(--fs-h3)')};
  font-weight: 800;
`

const Description = styled.p`
  margin-top: 6px;
  color: var(--cocoa);
  font-size: var(--fs-md);
`

function SectionHeader({ title, description, size, children }) {
  return (
    <Wrap>
      <div>
        <Title $size={size}>{title}</Title>
        {description && <Description>{description}</Description>}
      </div>
      {children}
    </Wrap>
  )
}

export default SectionHeader
