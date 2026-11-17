import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import { Button, Card } from '../../styles/common'
import Modal from '../ui/Modal'

// MY-02 프로필, 요약 숫자 (한눈에 보기): 닉네임, 로그인 방법 / 찜, 최근 본, 비교 내역, 계산 기록 개수 (누르면 그 항목)
// 개수 불러오기 실패 → 숫자 자리 '-' (E3)
// 로그아웃 → LY-08과 같은 확인 창, 처리 (확인 → API-16 + sessionStorage 비우기 → 안내 창 → 닫으면 새로고침하며 메인)
// TODO(API-51, CHORONG-42 BE): MY 요약 API는 오늘 서버 범위 밖이라 지금은 숫자 자리가 '-'
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

const DialogText = styled.p`
  margin-bottom: 20px;
  font-size: var(--fs-lg);
  font-weight: 700;
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

function MyOverview() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const [summary, setSummary] = useState(null)
  const [logoutStep, setLogoutStep] = useState(null)
  const [isPending, setIsPending] = useState(false)

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

  const handleLogout = async () => {
    setIsPending(true)
    await logout()
    setIsPending(false)
    setLogoutStep('done')
  }

  const handleDoneClose = () => window.location.replace('/')

  return (
    <Wrap>
      <Profile>
        <div>
          <Name>{user.memberNickname}님</Name>
          <Login>{LOGIN_TYPE_LABEL[user.loginType] ?? user.loginType} 로그인</Login>
        </div>
        <Button $size="sm" $variant="outline" onClick={() => setLogoutStep('confirm')}>
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

      <Modal isOpen={logoutStep === 'confirm'} onClose={() => setLogoutStep(null)} label="로그아웃 확인" width={380} showClose={false}>
        <DialogText>로그아웃할까요?</DialogText>
        <DialogActions>
          <Button $variant="outline" onClick={() => setLogoutStep(null)}>
            취소
          </Button>
          <Button onClick={handleLogout} disabled={isPending}>
            로그아웃
          </Button>
        </DialogActions>
      </Modal>

      <Modal isOpen={logoutStep === 'done'} onClose={handleDoneClose} label="로그아웃 완료" width={380} showClose={false}>
        <DialogText>로그아웃했어요. 메인 페이지로 이동할게요</DialogText>
        <DialogActions>
          <Button onClick={handleDoneClose}>확인</Button>
        </DialogActions>
      </Modal>
    </Wrap>
  )
}

export default MyOverview
