import styled from 'styled-components'

// CM-02 구역 제목줄: 제목(24) / 설명 / 오른쪽 링크, 버튼 (children). 제목과 내용 간격 20
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 20px;
`

const Title = styled.h2`
  font-size: var(--fs-h3);
  font-weight: 800;
`

const Description = styled.p`
  margin-top: 6px;
  color: var(--cocoa);
  font-size: var(--fs-md);
`

function SectionHeader({ title, description, children }) {
  return (
    <Wrap>
      <div>
        <Title>{title}</Title>
        {description && <Description>{description}</Description>}
      </div>
      {children}
    </Wrap>
  )
}

export default SectionHeader
