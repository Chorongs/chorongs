import * as myApi from '../../api/myApi'
import { formatMoney, formatRate } from '../../utils/format'
import CalcRecordList from './CalcRecordList'

// MY-10 상환능력 기반 대출 계산 기록 (API-58): 목록, 지우기, 불러오기는 CalcRecordList / 이 파일은 API와 줄 글만 정함
// 줄: '매달 {매달 갚을 돈}' / '연 {금리}%' · '{기간}개월' · '최대 {최대 대출 금액}'
// [불러오기] → /calc/reverse로 입력값만 넘김 (CA-01, 결과는 계산기가 다시 계산)
const API = { getAll: myApi.getReverseCalcs, removeOne: myApi.deleteReverseCalc, removeAll: myApi.deleteReverseCalcs }

const STATE_KEYS = ['repayMethod', 'monthlyPayment', 'interestRate', 'loanMonths']

const getId = (item) => item.reverseId

const getMain = (item) => `매달 ${formatMoney(item.monthlyPayment, '원')}`

const getSubs = (item) => [
  `연 ${formatRate(item.interestRate)}%`,
  `${item.loanMonths}개월`,
  `최대 ${formatMoney(item.maxLoan, '원')}`,
]

function ReverseHistoryList({ title }) {
  return (
    <CalcRecordList
      title={title}
      api={API}
      getId={getId}
      getItemLabel={getMain}
      getMain={getMain}
      getSubs={getSubs}
      calcPath="/calc/reverse"
      stateKeys={STATE_KEYS}
    />
  )
}

export default ReverseHistoryList
