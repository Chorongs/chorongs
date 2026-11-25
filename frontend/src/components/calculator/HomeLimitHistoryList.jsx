import * as myApi from '../../api/myApi'
import { formatMoney } from '../../utils/format'
import CalcRecordList from './CalcRecordList'

// MY-10 내 집 대출한도 계산 기록 (API-59): 목록, 삭제, 불러오기는 CalcRecordList / 이 파일은 API와 줄 글만 정함
// 줄: '집값 {집값}' / 지역 글, '최대 한도 {최대 대출 한도}'
// [불러오기] → /calc/home으로 입력값만 넘김 (CA-01, 결과는 계산기가 다시 계산)
const API = { getAll: myApi.getHomeCalcs, removeOne: myApi.deleteHomeCalc, removeAll: myApi.deleteHomeCalcs }

const STATE_KEYS = [
  'housePrice',
  'homeRegion',
  'firstHome',
  'annualIncome',
  'otherInterest',
  'interestRate',
  'loanYears',
  'repayMethod',
]

// 집이 있는 곳 글 (API-59 homeRegion)
// TODO(MY-10): 내 집 대출한도 계산기가 develop에 들어오면 utils/finance.js의 HOME_REGIONS를 가져다 쓰고 이 표는 지움
const REGION_LABEL = { OTHER: '그 외 지역', REGULATED: '규제 지역' }

const getId = (item) => item.homeId

const getMain = (item) => `집값 ${formatMoney(item.housePrice, '원')}`

const getSubs = (item) => [REGION_LABEL[item.homeRegion], `최대 한도 ${formatMoney(item.maxLoan, '원')}`]

function HomeLimitHistoryList({ title }) {
  return (
    <CalcRecordList
      title={title}
      api={API}
      getId={getId}
      getMain={getMain}
      getSubs={getSubs}
      calcPath="/calc/home"
      stateKeys={STATE_KEYS}
    />
  )
}

export default HomeLimitHistoryList
