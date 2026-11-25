import * as myApi from '../../api/myApi'
import { formatMoney, formatRate } from '../../utils/format'
import CalcRecordList from './CalcRecordList'

// MY-10 대출 갈아타기 계산 기록 (API-56): 목록, 삭제, 불러오기는 CalcRecordList / 이 파일은 API와 줄 글만 정함
// 줄: '갈아타면 {아끼는 돈} 아껴요' (더 내면 '{금액} 더 내요') / '지금 {지금 금리}%에서 {새 금리}%'
// [불러오기] → /calc/change로 입력값만 넘김 (CA-01, 결과는 계산기가 다시 계산)
const API = { getAll: myApi.getChangeCalcs, removeOne: myApi.deleteChangeCalc, removeAll: myApi.deleteChangeCalcs }

const STATE_KEYS = [
  'currentRepayMethod',
  'currentBalance',
  'currentRate',
  'currentMonths',
  'newRepayMethod',
  'newRate',
  'newMonths',
  'feeRate',
  'etcCost',
]

const getId = (item) => item.changeId

// savingAmount: 더 내면 음수
const getMain = (item) =>
  item.savingAmount >= 0
    ? `갈아타면 ${formatMoney(item.savingAmount, '원')} 아껴요`
    : `${formatMoney(-item.savingAmount, '원')} 더 내요`

const getSubs = (item) => [`지금 ${formatRate(item.currentRate)}%에서 ${formatRate(item.newRate)}%`]

function ChangeHistoryList({ title }) {
  return (
    <CalcRecordList
      title={title}
      api={API}
      getId={getId}
      getMain={getMain}
      getSubs={getSubs}
      calcPath="/calc/change"
      stateKeys={STATE_KEYS}
    />
  )
}

export default ChangeHistoryList
