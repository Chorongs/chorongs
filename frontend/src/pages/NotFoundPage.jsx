import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { PREPARING_TEXT } from '../api/axiosInstance'
import Icon from '../components/ui/Icon'
import { Button } from '../styles/common'

// LY-16 없는 주소 화면: 안내 문구 + [홈으로]
// 아직 화면이 올라오지 않은 주소면 '찾을 수 없음' 대신 준비 중 안내
//   그 화면 Route가 App.jsx(LY-01)에 생기면 목록에서 그 줄을 지움 (LY-16)
const PREPARING_PATHS = [
  '/diagnosis/habit', // 소비 습관 분석
  '/help', // 도움말
]

const isPreparingPath = (pathname) =>
  PREPARING_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
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
  const isPreparing = isPreparingPath(useLocation().pathname)

  return (
    <Wrap>
      <Title>{isPreparing ? PREPARING_TEXT : '찾을 수 없는 주소예요'}</Title>
      <Desc>{isPreparing ? '곧 열릴 화면이에요.' : '주소가 잘못되었거나 없어진 화면이에요.'}</Desc>
      <Button onClick={() => navigate('/')}>
        홈으로
        <Icon name="arrow" size={13} />
      </Button>
    </Wrap>
  )
}

export default NotFoundPage
