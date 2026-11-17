import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card } from '../../styles/common'

// MY-02 프로필, 요약 숫자 (한눈에 보기): 닉네임, 로그인 방법 / 찜, 최근 본, 비교 내역, 계산 기록 개수 (누르면 그 항목)
// 개수 불러오기 실패 → 숫자 자리 '-' (E3)
// 로그아웃 → LY-08과 같은 창을 엶 (openLogout. 창은 Layout이 그리는 LogoutDialog 하나를 같이 씀)
// TODO(API-51, CHORONG-42 BE): MY 요약 API가 아직 서버에 없어 지금은 숫자 자리가 '-' (서버가 올라오면 그대로 동작)
const COUNTS = [
  { key: 'wishCount', label: '찜한 대출', to: '/my/liked' },
  { key: 'recentViewCount', label: '최근 본 대출', to: '/my/recent' },
  { key: 'compareCount', label: '비교 내역', to: '/my/compares' },
  { key: 'calcCount', label: '계산 기록', to: '/my/calcs' },
]

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Profile = styled(Card)`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const Name = styled.p`
  font-size: var(--fs-h4);
  font-weight: 800;
`

const Login = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Tiles = styled.ul`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 899px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const Tile = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  border-radius: var(--r-md);
  background: var(--mist);
  transition: background var(--t-fast);
  &:hover {
    background: var(--mist-2);
  }
`

const TileLabel = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const TileValue = styled.b`
  font-family: var(--f-num);
  font-size: var(--fs-h3);
  font-weight: 900;
`

function MyOverview() {
  const user = useAuthStore((state) => state.user)
  const openLogout = useUiStore((state) => state.openLogout)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let isCancelled = false
    myApi
      .getMySummary()
      .then((data) => {
        if (!isCancelled) setSummary(data)
      })
      .catch(() => {
        // 실패하면 summary가 null 그대로 → 숫자 자리 '-'
      })
    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <Wrap>
      <Profile>
        <div>
          <Name>{user.memberNickname}님</Name>
          <Login>{LOGIN_TYPE_LABEL[user.loginType] ?? user.loginType} 로그인</Login>
        </div>
        <Button $size="sm" $variant="outline" onClick={openLogout}>
          로그아웃
        </Button>
      </Profile>

      <Tiles>
        {COUNTS.map((count) => (
          <li key={count.key}>
            <Tile to={count.to}>
              <TileLabel>{count.label}</TileLabel>
              <TileValue>{typeof summary?.[count.key] === 'number' ? summary[count.key] : '-'}</TileValue>
            </Tile>
          </li>
        ))}
      </Tiles>
    </Wrap>
  )
}

export default MyOverview
