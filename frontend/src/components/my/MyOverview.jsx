import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { getMyMenuPath } from '../../constants/menu'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'

// MY-02 프로필, 요약 숫자 (한눈에 보기): 닉네임, 로그인 방법 / 찜, 최근 본, 비교 내역, 계산 기록 개수 (누르면 그 항목)
// onLogin을 넘기면 비회원 모양: 같은 회색 판에 로그인 안내 + [로그인] (요약 숫자는 안 그림, MY-01 비회원)
// 개수 불러오기 실패 → 숫자 자리 '-' (E3) / 불러오는 동안은 빈 자리 (실패 표시 '-'가 먼저 보였다 바뀌지 않게)
// 로그아웃 → LY-08과 같은 창을 엶 (openLogout. 창은 Layout이 그리는 LogoutDialog 하나를 같이 씀)
// keys: 더해서 보여 줄 응답 칸. 계산 기록은 서버가 계산기 5종 개수를 따로 주므로 합계
const COUNTS = [
  { keys: ['wishCount'], label: '찜한 대출', to: getMyMenuPath('liked') },
  { keys: ['recentViewCount'], label: '최근 본 대출', to: getMyMenuPath('recent') },
  { keys: ['compareCount'], label: '비교 내역', to: getMyMenuPath('compares') },
  {
    keys: ['calcCount', 'changeCount', 'dsrCount', 'homeLimitCount', 'reversCalcCount'],
    label: '계산 기록',
    to: getMyMenuPath('calcs'),
  },
]

// 칸이 하나라도 숫자가 아니면(불러오기 실패, 응답에 없음) '-'
const getCountText = (summary, keys) => {
  const values = keys.map((key) => summary?.[key])
  return values.every((value) => typeof value === 'number') ? values.reduce((sum, value) => sum + value, 0) : '-'
}

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

// 프로필 판: 회색 바탕, 왼쪽 글 / 오른쪽 버튼
const Profile = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 24px 28px;
  border-radius: var(--r-lg);
  background: var(--mist);
  @media (max-width: 899px) {
    padding: 20px;
  }
`

const ProfileText = styled.div`
  flex: 1;
  min-width: 180px;
  b {
    font-size: var(--fs-xl);
    font-weight: 800;
  }
  p {
    color: var(--cocoa);
    font-size: var(--fs-md);
  }
`

const Tiles = styled.ul`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 899px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

// 숫자 칸: 테두리만, 마우스를 올리면 회색 바탕
const Tile = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  transition: background var(--t-fast);
  &:hover {
    background: var(--mist);
  }
`

const TileLabel = styled.small`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const TileValue = styled.b`
  font-family: var(--f-num);
  font-size: var(--fs-h2);
  font-weight: 900;
`

function MyOverview({ onLogin }) {
  const user = useAuthStore((state) => state.user)
  const openLogout = useUiStore((state) => state.openLogout)
  const [summary, setSummary] = useState(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const isGuest = Boolean(onLogin)

  useEffect(() => {
    if (isGuest) return undefined
    let isCancelled = false
    myApi
      .getMySummary()
      .then((data) => {
        if (!isCancelled) setSummary(data)
      })
      .catch(() => {
        // 실패하면 summary가 null 그대로 → 숫자 자리 '-'
      })
      .finally(() => {
        if (!isCancelled) setIsSummaryLoading(false)
      })
    return () => {
      isCancelled = true
    }
  }, [isGuest])

  if (isGuest) {
    return (
      <Profile>
        <ProfileText>
          <b>로그인하면 찜과 기록을 MY에서 볼 수 있어요</b>
        </ProfileText>
        <Button $size="sm" onClick={onLogin}>
          로그인
        </Button>
      </Profile>
    )
  }

  return (
    <Wrap>
      <Profile>
        <ProfileText>
          <b>{user.memberNickname}님</b>
          <p>{LOGIN_TYPE_LABEL[user.loginType] ?? '소셜'} 계정으로 로그인했어요</p>
        </ProfileText>
        <Button $size="sm" $variant="outline" onClick={openLogout}>
          로그아웃
        </Button>
      </Profile>

      <Tiles aria-busy={isSummaryLoading}>
        {COUNTS.map((count) => (
          <li key={count.to}>
            <Tile to={count.to}>
              <TileLabel>{count.label}</TileLabel>
              {/* 불러오는 동안 줄 높이가 변하지 않게 빈 칸 하나 */}
              <TileValue>{isSummaryLoading ? '\u00a0' : getCountText(summary, count.keys)}</TileValue>
            </Tile>
          </li>
        ))}
      </Tiles>
    </Wrap>
  )
}

export default MyOverview
