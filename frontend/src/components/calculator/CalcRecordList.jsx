import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useAuthStore from '../../store/useAuthStore'
import { Button } from '../../styles/common'
import { formatDate } from '../../utils/format'
import MySection, { RecordRow } from '../my/MySection'

// 계산 기록 목록 공통 틀: 대출 이자(CA-07 CalcHistoryList)와 MY 계산 기록 칩 4종
//   (ChangeHistoryList, DsrHistoryList, ReverseHistoryList, HomeLimitHistoryList)이 같이 씀. 각 파일은 API와 줄 글만 정함
// 목록 틀(제목, 삭제 확인 창, 불러오는 중, 실패, 빈 상태)과 기록 한 줄(RecordRow)은 MySection (MY-03, 삭제는 확인 창 뒤에, E3, E11)
// - 비회원: API를 부르지 않고 '로그인하면 저장 가능' 문구만 (확인 중에는 아무것도 안 그림)
// - 기록 줄: 위 굵은 글 getMain(item) / 아래 작은 글 getSubs(item) (빈 값은 빼고 쉼표로 이음) + 저장 시각 / [불러오기]
// - [불러오기]: onLoad(item)이 있으면 그 화면이 입력칸을 채움 (계산기 안)
//   없으면 calcPath로 이동하며 값을 넘김 (MY): stateKeys가 있으면 그 칸만 (입력값만, 결과는 계산기가 다시 계산, CA-01), 없으면 기록 한 줄 그대로
// - getItemLabel: 삭제 확인 창에 보일 기록 이름 (안 넘기면 '{위 굵은 글}, {저장 시각} 저장')
// - api: { getAll, removeOne(기록 번호), removeAll } (파일 맨 위 상수로 둠, 그릴 때마다 새로 만들면 목록을 계속 다시 받음)
// - getId(item): 기록 번호 / refreshKey: 바뀌면 목록을 다시 받음 (계산기에서 [결과 저장] 뒤)
const Guest = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const GuestTitle = styled.h2`
  font-size: var(--fs-h4);
  font-weight: 800;
`

const GuestText = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-md);
`

function CalcRecordList({
  title = '계산 기록',
  api,
  getId,
  getItemLabel,
  getMain,
  getSubs,
  calcPath,
  stateKeys = null,
  onLoad,
  refreshKey = 0,
}) {
  const navigate = useNavigate()
  const authStatus = useAuthStore((state) => state.status)
  const isMember = authStatus === 'member'
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    if (!isMember) return undefined
    let isCancelled = false
    api
      .getAll()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [] })
      })
      .catch(() => {
        if (!isCancelled) setResult({ status: 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [api, isMember, attempt, refreshKey])

  const handleRetry = () => {
    setResult({ status: 'loading', items: [] })
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    await api.removeOne(getId(item))
    setResult((prev) => ({ ...prev, items: prev.items.filter((one) => getId(one) !== getId(item)) }))
  }

  const handleClearAll = async () => {
    await api.removeAll()
    setResult({ status: 'done', items: [] })
  }

  const handleLoad = (item) => {
    if (onLoad) {
      onLoad(item)
      return
    }
    const state = stateKeys ? Object.fromEntries(stateKeys.map((key) => [key, item[key]])) : item
    navigate(calcPath, { state })
  }

  if (authStatus === 'checking') return null

  if (!isMember) {
    return (
      <Guest>
        <GuestTitle>{title}</GuestTitle>
        <GuestText>로그인하면 저장 가능</GuestText>
      </Guest>
    )
  }

  return (
    <MySection
      title={title}
      description="[결과 저장]을 누른 기록이에요."
      status={result.status}
      onRetry={handleRetry}
      items={result.items}
      getKey={getId}
      getItemLabel={getItemLabel ?? ((item) => `${getMain(item)}, ${formatDate(item.calcAt)} 저장`)}
      renderItem={(item) => (
        <RecordRow
          main={getMain(item)}
          sub={[...getSubs(item).filter(Boolean), formatDate(item.calcAt)].join(', ')}
          action={
            <Button $size="sm" $variant="outline" onClick={() => handleLoad(item)}>
              불러오기
            </Button>
          }
        />
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="저장한 계산 기록이 없어요"
    />
  )
}

export default CalcRecordList
