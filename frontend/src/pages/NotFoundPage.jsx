import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import Icon from '../components/ui/Icon'
import { Button } from '../styles/common'

// LY-16 없는 주소 화면: 안내 문구 + [홈으로]
const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  text-align: center;
`

const Title = styled.h1`
  margin: 0;
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Desc = styled.p`
  margin: 0 0 8px;
  color: var(--cocoa);
`

function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Wrap>
      <Title>찾을 수 없는 주소예요</Title>
      <Desc>주소가 잘못되었거나 없어진 화면이에요.</Desc>
      <Button onClick={() => navigate('/')}>
        홈으로
        <Icon name="arrow" size={13} />
      </Button>
    </Wrap>
  )
}

export default NotFoundPage
