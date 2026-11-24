import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { PREPARING_TEXT } from '../api/axiosInstance'
import Icon from '../components/ui/Icon'
import { Button } from '../styles/common'

// LY-16 없는 주소 화면: 안내 문구 + [홈으로]
// 아직 화면이 올라오지 않은 주소면 '찾을 수 없음' 대신 준비 중 안내
//   각 화면이 올라와 App.jsx에 Route가 생기면 그 화면이 먼저 잡히므로 여기 목록은 그대로 둬도 됨 (화면이 다 올라오면 지움)
const PREPARING_PATHS = [
  '/calc', // 계산기 하위 화면 (대출 갈아타기, DSR, 내 집 대출한도, 상환능력 기반 대출. /calc는 있음)
  '/ranking', // 대출 랭킹
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
