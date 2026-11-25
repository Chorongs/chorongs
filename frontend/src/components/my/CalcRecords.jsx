import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { CALC_RECORD_KINDS } from '../../constants/menu'
import { Chip } from '../../styles/common'
import CalcHistoryList from '../calculator/CalcHistoryList'
import ChangeHistoryList from '../calculator/ChangeHistoryList'
import DsrHistoryList from '../calculator/DsrHistoryList'
import HomeLimitHistoryList from '../calculator/HomeLimitHistoryList'
import ReverseHistoryList from '../calculator/ReverseHistoryList'

// MY-10 계산 기록: 맨 위 계산기 종류 칩 5개 (CALC_RECORD_KINDS, 처음은 대출 이자) / 칩을 누르면 그 종류 목록만
// 고른 종류는 주소 /my/calcs?kind={key}에 둠 (MY 왼쪽 메뉴 '계산 기록' 아래 하위 메뉴로 바로 열고, 새로고침해도 유지). 없거나 틀린 값이면 대출 이자
// 목록: 대출 이자 CalcHistoryList(API-24), 나머지는 ChangeHistoryList, DsrHistoryList, HomeLimitHistoryList, ReverseHistoryList (API-56부터 59까지)
//   다섯 목록 모두 CalcRecordList 한 틀을 씀. [불러오기]는 그 계산기 탭으로 이동하며 값을 넘김
const LISTS = {
  interest: CalcHistoryList,
  change: ChangeHistoryList,
  dsr: DsrHistoryList,
  home: HomeLimitHistoryList,
  reverse: ReverseHistoryList,
}
const KINDS = CALC_RECORD_KINDS.map((kind) => ({ ...kind, list: LISTS[kind.key] }))

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
`

function CalcRecords() {
  const [searchParams, setSearchParams] = useSearchParams()
  const kind = KINDS.find((item) => item.key === searchParams.get('kind')) ?? KINDS[0]
  const List = kind.list
  // 구역 이름 '{칩 이름} 계산 기록' (MY-03): 삭제 확인 창, 알림 글에도 그대로 쓰임
  const title = `${kind.label} 계산 기록`

  // 칩을 누르면 주소의 kind만 바꿈 (칩마다 방문 기록을 쌓지 않게 replace)
  const handleKind = (key) => setSearchParams({ kind: key }, { replace: true })

  return (
    <section>
      <Chips role="group" aria-label="계산기 종류">
        {KINDS.map((item) => (
          <Chip key={item.key} $size="sm" aria-pressed={item.key === kind.key} onClick={() => handleKind(item.key)}>
            {item.label}
          </Chip>
        ))}
      </Chips>
      <List title={title} />
    </section>
  )
}

export default CalcRecords
