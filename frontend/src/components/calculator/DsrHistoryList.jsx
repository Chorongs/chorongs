import * as myApi from '../../api/myApi'
import { formatMoney, formatRate } from '../../utils/format'
import CalcRecordList from './CalcRecordList'

// MY-10 DSR 계산 기록 (API-57): 목록, 지우기, 불러오기는 CalcRecordList / 이 파일은 API와 줄 글만 정함
// 줄: 'DSR {dsrRate}%' / '대출 {건수}건' · '연소득 {연소득}'
// [불러오기] → /calc/dsr로 입력값만 넘김 (연소득, 대출 목록. CA-01, 결과는 계산기가 다시 계산)
const API = { getAll: myApi.getDsrCalcs, removeOne: myApi.deleteDsrCalc, removeAll: myApi.deleteDsrCalcs }

const STATE_KEYS = ['annualIncome', 'loans']

const getId = (item) => item.dsrId

const getMain = (item) => `DSR ${formatRate(item.dsrRate)}%`

const getSubs = (item) => [`대출 ${item.loans?.length ?? 0}건`, `연소득 ${formatMoney(item.annualIncome, '원')}`]

function DsrHistoryList({ title }) {
  return (
    <CalcRecordList
      title={title}
      api={API}
      getId={getId}
      getMain={getMain}
      getSubs={getSubs}
      calcPath="/calc/dsr"
      stateKeys={STATE_KEYS}
    />
  )
}

export default DsrHistoryList
