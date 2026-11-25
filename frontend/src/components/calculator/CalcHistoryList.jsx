import * as myApi from '../../api/myApi'
import { formatMoney, formatRate } from '../../utils/format'
import { CALC_METHODS } from '../../utils/loanMath'
import CalcRecordList from './CalcRecordList'

// CA-07 계산 기록 목록: 저장한 기록 줄 / [불러오기] / 줄마다 지우기 / 전체 지우기 (API-24)
// 목록, 비회원 문구, 지우기, 불러오기는 CalcRecordList가 함 (MY 계산 기록 칩 4종과 같은 틀). 이 파일은 API와 줄 글만 정함
// - [불러오기]: onLoad(item)이 있으면 그 화면이 입력칸을 채움 (계산기). 없으면 계산기(/calc)로 이동하며 기록 한 줄을 넘김 (MY 계산 기록)
// - refreshKey: 바뀌면 목록을 다시 받음 (계산기에서 [결과 저장] 뒤)
// - title: 구역 이름 (기본 '계산 기록'. MY 계산 기록 칩 안에서는 '대출 이자 계산 기록', MY-03)
const METHOD_LABEL = Object.fromEntries(CALC_METHODS.map((method) => [method.code, method.label]))

const API = { getAll: myApi.getCalcs, removeOne: myApi.deleteCalc, removeAll: myApi.deleteCalcs }

const getId = (item) => item.calcId

function getItemLabel(item) {
  return `${formatMoney(item.loanAmount, '원')}, ${item.loanMonths}개월, ${METHOD_LABEL[item.repayMethod] ?? ''}`
}

// 금액, 기간, 연 금리 / 상환 방식, 거치 (있을 때만), 총이자
const getMain = (item) =>
  `${formatMoney(item.loanAmount, '원')}, ${item.loanMonths}개월, 연 ${formatRate(item.interestRate)}%`

const getSubs = (item) => [
  METHOD_LABEL[item.repayMethod],
  item.graceMonths > 0 && `거치 ${item.graceMonths}개월`,
  `총이자 ${formatMoney(item.totalInterest, '원')}`,
]

function CalcHistoryList({ onLoad, refreshKey = 0, title = '계산 기록' }) {
  return (
    <CalcRecordList
      title={title}
      api={API}
      getId={getId}
      getItemLabel={getItemLabel}
      getMain={getMain}
      getSubs={getSubs}
      calcPath="/calc"
      onLoad={onLoad}
      refreshKey={refreshKey}
    />
  )
}

export default CalcHistoryList
