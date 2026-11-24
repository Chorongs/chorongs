import { useState } from 'react'
import styled from 'styled-components'
import { Chip } from '../../styles/common'
import CalcHistoryList from '../calculator/CalcHistoryList'
import MySection from './MySection'

// MY-10 계산 기록: 맨 위 계산기 종류 칩 5개 (계산기 탭 순서, 처음은 대출 이자) / 칩을 누르면 그 종류 목록만
// 대출 이자는 CalcHistoryList(API-24)를 다시 씀. [불러오기]는 계산기(/calc)로 이동하며 값을 넘김
// 목록 부품이 없는 종류는 MySection의 준비 중 안내 (구역 이름 '{칩 이름} 계산 기록', MY-03)
// TODO(MY-10): 나머지 4종 목록 부품(ChangeHistoryList, DsrHistoryList, HomeLimitHistoryList,
//   ReverseHistoryList, API-56부터 59까지)이 올라오면 KINDS의 list에 연결
const KINDS = [
  { key: 'interest', label: '대출 이자', list: CalcHistoryList },
  { key: 'change', label: '대출 갈아타기', list: null },
  { key: 'dsr', label: 'DSR', list: null },
  { key: 'home', label: '내 집 대출한도', list: null },
  { key: 'reverse', label: '상환능력 기반 대출', list: null },
]

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
`

function CalcRecords() {
  const [kindKey, setKindKey] = useState(KINDS[0].key)
  const kind = KINDS.find((item) => item.key === kindKey)
  const List = kind.list

  return (
    <section>
      <Chips role="group" aria-label="계산기 종류">
        {KINDS.map((item) => (
          <Chip key={item.key} $size="sm" aria-pressed={item.key === kindKey} onClick={() => setKindKey(item.key)}>
            {item.label}
          </Chip>
        ))}
      </Chips>
      {List ? (
        <List />
      ) : (
        <MySection title={`${kind.label} 계산 기록`} description="[결과 저장]을 누른 기록이에요." status="preparing" />
      )}
    </section>
  )
}

export default CalcRecords
