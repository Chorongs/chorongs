import { describe, expect, it } from 'vitest'
import {
  CHANGE_DEFAULTS,
  DSR_DEFAULTS,
  DSR_LOAN_DEFAULT,
  DSR_MAX_LOANS,
  HOME_DEFAULTS,
  REVERSE_DEFAULTS,
  REVERSE_TERMS,
  calcMaxLoan,
  getChangeErrors,
  getChangeResult,
  getDsrErrors,
  getDsrResult,
  getHomeErrors,
  getHomeResult,
  getInitialChange,
  getInitialDsr,
  getInitialHome,
  getInitialReverse,
  getReverseErrors,
  getReverseResult,
  toChangeRecord,
  toDsrRecord,
  toHomeRecord,
  toLoanCalcState,
  toReverseRecord,
} from './finance'
import { calcPayment } from './loanMath'

// 손으로 계산하기 쉬운 값: 만기일시 1,000만원 12개월 → 총이자 = 원금 x 연 금리 (지금 6% 600,000원, 새 5% 500,000원)
const makeForm = (patch = {}) => ({
  currentMethod: 'BULLET',
  balance: 10000000,
  currentRate: 6,
  currentMonths: 12,
  newMethod: 'BULLET',
  newRate: 5,
  newMonths: 12,
  feeRate: 0,
  etcCost: 0,
  ...patch,
})

describe('getChangeResult (갈아타기 계산)', () => {
  it('아끼는 돈은 지금 총이자 - 새 총이자 - 수수료 - 기타 비용이다', () => {
    // Given 이자 차이 100,000원, 수수료 0.5% (50,000원), 기타 비용 3만원 (30,000원)
    const form = makeForm({ feeRate: 0.5, etcCost: 30000 })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result.savingAmount).toBe(20000)
  })

  it('수수료는 남은 대출금 x 수수료율이다', () => {
    // Given 남은 대출금 1,000만원, 수수료 1%
    const form = makeForm({ feeRate: 1 })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result.prepayFee).toBe(100000)
  })

  it('기타 비용은 원 단위 그대로 계산한다', () => {
    // Given
    const form = makeForm({ etcCost: 50000 })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result.etcCost).toBe(50000)
  })

  it('두 대출의 총이자를 각각 돌려준다', () => {
    // Given
    const form = makeForm()
    // When
    const result = getChangeResult(form)
    // Then
    expect([result.currentInterest, result.newInterest]).toEqual([600000, 500000])
  })

  it('원금균등은 원금균등 방식으로 총이자를 계산한다', () => {
    // Given 1,200만원 12% 12개월 원금균등: 12,000,000 x 0.01 x 13 / 2 = 780,000
    const form = makeForm({ currentMethod: 'EQUAL_P', balance: 12000000, currentRate: 12 })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result.currentInterest).toBe(780000)
  })

  it('첫 달 납입액은 새 대출 기준으로 돌려준다', () => {
    // Given 만기일시 1,000만원 5%: 매달 이자 41,666.67원
    const form = makeForm()
    // When
    const result = getChangeResult(form)
    // Then
    expect(result.newFirstPayment).toBe(41667)
  })

  it('아끼는 돈이 0원이면 갈아타는 게 이득으로 본다', () => {
    // Given 이자 차이 100,000원 = 수수료 1% (100,000원)
    const form = makeForm({ feeRate: 1 })
    // When
    const result = getChangeResult(form)
    // Then
    expect([result.savingAmount, result.isGain]).toEqual([0, true])
  })

  it('아끼는 돈이 음수이면 지금 대출 유지가 이득이고 값은 음수로 돌려준다', () => {
    // Given 이자 차이 100,000원 - 수수료 100,000원 - 기타 비용 5만원
    const form = makeForm({ feeRate: 1, etcCost: 50000 })
    // When
    const result = getChangeResult(form)
    // Then
    expect([result.savingAmount, result.isGain]).toEqual([-50000, false])
  })

  it('수수료, 기타 비용 빈 칸은 0으로 본다', () => {
    // Given
    const form = makeForm({ feeRate: '', etcCost: '' })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result.savingAmount).toBe(100000)
  })

  it('남은 대출금이 0이면 계산하지 않고 null이다', () => {
    // Given
    const form = makeForm({ balance: 0 })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result).toBeNull()
  })

  it('기간이 소수이면 계산하지 않고 null이다', () => {
    // Given
    const form = makeForm({ newMonths: 12.5 })
    // When
    const result = getChangeResult(form)
    // Then
    expect(result).toBeNull()
  })
})

describe('getChangeErrors (갈아타기 입력 검사)', () => {
  it('처음 값은 남은 대출금이 빈칸이라 입력 안내가 난다', () => {
    // Given 숫자 칸은 빈칸으로 열림
    const form = getInitialChange()
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.balance).toBe('남은 대출금을 입력해 주세요')
  })

  it('남은 대출금이 비어 있으면 입력 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ balance: '' })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.balance).toBe('남은 대출금을 입력해 주세요')
  })

  it('남은 대출금이 1만원 미만이면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ balance: 0 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.balance).toBe('남은 대출금은 1만원 이상 10억원 이하로 입력해 주세요')
  })

  it('남은 대출금이 10억원을 넘으면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ balance: 1000000001 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.balance).toBe('남은 대출금은 1만원 이상 10억원 이하로 입력해 주세요')
  })

  it('지금 금리가 20%를 넘으면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ currentRate: 20.5 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.currentRate).toBe('지금 금리는 0% 이상 20% 이하로 입력해 주세요')
  })

  it('새 금리가 비어 있으면 입력 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ newRate: '' })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.newRate).toBe('새 금리를 입력해 주세요')
  })

  it('금리 0%는 오류가 아니다', () => {
    // Given
    const form = makeForm({ newRate: 0 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.newRate).toBeUndefined()
  })

  it('남은 기간이 600개월을 넘으면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ currentMonths: 601 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.currentMonths).toBe('남은 기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('새 대출 기간이 0개월이면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ newMonths: 0 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.newMonths).toBe('새 대출 기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('기간이 소수이면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ newMonths: 12.5 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.newMonths).toBe('새 대출 기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('수수료가 5%를 넘으면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ feeRate: 5.5 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.feeRate).toBe('수수료는 0% 이상 5% 이하로 입력해 주세요')
  })

  it('수수료를 비워 두면 오류가 아니다', () => {
    // Given
    const form = makeForm({ feeRate: '' })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.feeRate).toBeUndefined()
  })

  it('기타 비용이 10억원을 넘으면 범위 안내를 돌려준다', () => {
    // Given
    const form = makeForm({ etcCost: 1000000001 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.etcCost).toBe('기타 비용은 0원 이상 10억원 이하로 입력해 주세요')
  })
})

describe('getInitialChange (넘어온 값 → 입력칸 처음 값)', () => {
  it('넘어온 값이 없으면 기본값이다', () => {
    // Given
    const state = undefined
    // When
    const form = getInitialChange(state)
    // Then
    expect(form).toEqual(CHANGE_DEFAULTS)
  })

  it('금액은 원 그대로 받는다', () => {
    // Given 남은 대출금 3,000만원, 기타 비용 50만원 (원 단위)
    const state = { currentBalance: 30000000, etcCost: 500000 }
    // When
    const form = getInitialChange(state)
    // Then
    expect([form.balance, form.etcCost]).toEqual([30000000, 500000])
  })

  it('범위 밖인 칸만 무시하고 기본값을 쓴다', () => {
    // Given 지금 금리 25%는 범위 밖, 새 금리 3%는 맞음
    const state = { currentRate: 25, newRate: 3 }
    // When
    const form = getInitialChange(state)
    // Then
    expect([form.currentRate, form.newRate]).toEqual([CHANGE_DEFAULTS.currentRate, 3])
  })

  it('체증식처럼 갈아타기에 없는 상환 방식은 무시한다', () => {
    // Given
    const state = { currentRepayMethod: 'GRADUATED', newRepayMethod: 'EQUAL_P' }
    // When
    const form = getInitialChange(state)
    // Then
    expect([form.currentMethod, form.newMethod]).toEqual([CHANGE_DEFAULTS.currentMethod, 'EQUAL_P'])
  })

  it('소수 개월이나 600개월 초과 기간은 무시한다', () => {
    // Given
    const state = { currentMonths: 12.5, newMonths: 601 }
    // When
    const form = getInitialChange(state)
    // Then
    expect([form.currentMonths, form.newMonths]).toEqual([CHANGE_DEFAULTS.currentMonths, CHANGE_DEFAULTS.newMonths])
  })

  it('숫자가 아닌 값은 무시한다', () => {
    // Given
    const state = { currentBalance: '30000000', feeRate: null }
    // When
    const form = getInitialChange(state)
    // Then
    expect([form.balance, form.feeRate]).toEqual([CHANGE_DEFAULTS.balance, CHANGE_DEFAULTS.feeRate])
  })
})

describe('toChangeRecord (결과 저장 본문)', () => {
  it('입력 금액은 원 단위 그대로 보낸다', () => {
    // Given
    const form = makeForm({ balance: 10000000, etcCost: 50000 })
    const result = getChangeResult(form)
    // When
    const record = toChangeRecord(form, result)
    // Then
    expect([record.currentBalance, record.etcCost]).toEqual([10000000, 50000])
  })

  it('결과 값(아끼는 돈, 새 대출 첫 달 납입액, 새 대출 총이자)을 원 단위로 담는다', () => {
    // Given
    const form = makeForm({ feeRate: 1, etcCost: 50000 })
    const result = getChangeResult(form)
    // When
    const record = toChangeRecord(form, result)
    // Then
    expect([record.savingAmount, record.newFirstPayment, record.newTotalInterest]).toEqual([-50000, 41667, 500000])
  })

  it('수수료율 빈 칸은 0으로 보낸다', () => {
    // Given
    const form = makeForm({ feeRate: '' })
    const result = getChangeResult(form)
    // When
    const record = toChangeRecord(form, result)
    // Then
    expect(record.feeRate).toBe(0)
  })

  it('서버 요청 값 이름 12개로 보낸다', () => {
    // Given
    const form = makeForm()
    const result = getChangeResult(form)
    // When
    const record = toChangeRecord(form, result)
    // Then
    expect(Object.keys(record).sort()).toEqual(
      [
        'currentRepayMethod',
        'currentBalance',
        'currentRate',
        'currentMonths',
        'newRepayMethod',
        'newRate',
        'newMonths',
        'feeRate',
        'etcCost',
        'savingAmount',
        'newFirstPayment',
        'newTotalInterest',
      ].sort(),
    )
  })

  it('저장한 기록을 그대로 넘기면 같은 입력칸이 복원된다', () => {
    // Given 저장 본문(원 단위)을 MY [불러오기]가 그대로 넘기는 상황
    const form = makeForm({ balance: 30000000, feeRate: 1.5, etcCost: 200000, newMethod: 'EQUAL_PI' })
    const record = toChangeRecord(form, getChangeResult(form))
    // When
    const loaded = getInitialChange(record)
    // Then
    expect(loaded).toEqual(form)
  })
})

// 손으로 계산하기 쉬운 값: 집값 5억, 그 외 지역 (LTV 70% = 3.5억), 연소득 6,000만원 x DSR 40% = 연 2,400만원 → 매달 200만원, 금리 0%, 10년 → 소득 기준 2.4억
// 다른 대출은 없음 (한 건, 신용대출 원리금균등, 잔액 0, 금리 5%, 남은 기간 60개월), 금리 유형은 스트레스 금리가 없는 고정형 (계산을 손으로 맞추기 쉽게)
const makeOther = (patch = {}) => ({ kind: 'CREDIT', method: 'EQUAL_PI', balance: 0, rate: 5, months: 60, ...patch })

const makeHome = (patch = {}) => ({
  housePrice: 500000000,
  region: 'OTHER',
  isFirstHome: false,
  annualIncome: 60000000,
  isOtherLoan: true,
  otherLoans: [makeOther()],
  rate: 0,
  rateType: 'FIXED',
  years: 10,
  ...patch,
})

describe('calcMaxLoan (매달 갚을 돈 → 최대 대출금)', () => {
  it('금리 0%이면 원리금균등은 매달 갚을 돈 x 개월이다', () => {
    // Given 매달 100만원, 금리 0%, 12개월
    // When
    const principal = calcMaxLoan('EQUAL_PI', 1000000, 0, 12)
    // Then
    expect(principal).toBe(12000000)
  })

  it('원금균등은 첫 달 상환액(원금/기간 + 원금 x 월 금리)으로 거꾸로 계산한다', () => {
    // Given 첫 달 300만원, 연 12% (월 1%), 120개월 → 300만 / (1/120 + 0.01)
    // When
    const principal = calcMaxLoan('EQUAL_P', 3000000, 12, 120)
    // Then
    expect(principal).toBe(163636364)
  })

  it('원리금균등은 구한 대출금의 월 상환액이 처음 갚을 돈과 같다', () => {
    // Given 매달 150만원, 연 5%, 360개월로 구한 최대 대출금
    const principal = calcMaxLoan('EQUAL_PI', 1500000, 5, 360)
    // When
    const payment = calcPayment('EQUAL_PI', principal, 5, 360)
    // Then
    expect(payment.monthly).toBe(1500000)
  })

  it('매달 갚을 돈이 0 이하이면 null이다', () => {
    // Given 매달 갚을 돈 0원
    // When
    const principal = calcMaxLoan('EQUAL_PI', 0, 5, 120)
    // Then
    expect(principal).toBeNull()
  })

  it('음수 금리는 null이다', () => {
    // Given 연 -1%
    // When
    const principal = calcMaxLoan('EQUAL_PI', 1000000, -1, 120)
    // Then
    expect(principal).toBeNull()
  })

  it('소수 개월은 null이다', () => {
    // Given 12.5개월
    // When
    const principal = calcMaxLoan('EQUAL_PI', 1000000, 5, 12.5)
    // Then
    expect(principal).toBeNull()
  })
})

describe('getHomeResult (집 살 때 대출한도 계산)', () => {
  it('그 외 지역 집값 기준(LTV) 한도는 집값의 70%이다', () => {
    // Given 집값 5억, 그 외 지역
    // When
    const result = getHomeResult(makeHome())
    // Then
    expect(result.ltvLimit).toBe(350000000)
  })

  it('규제 지역 집값 기준(LTV) 한도는 집값의 40%이다', () => {
    // Given 집값 5억, 규제 지역
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED' }))
    // Then
    expect(result.ltvLimit).toBe(200000000)
  })

  it('규제 지역 생애 첫 집은 집값 기준(LTV) 한도가 집값의 70%이다', () => {
    // Given 집값 5억, 규제 지역, 생애 첫 집
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED', isFirstHome: true }))
    // Then
    expect(result.ltvLimit).toBe(350000000)
  })

  it('그 외 지역 생애 첫 집은 집값 기준(LTV) 한도가 집값의 80%이다', () => {
    // Given 집값 5억, 그 외 지역, 생애 첫 집
    // When
    const result = getHomeResult(makeHome({ isFirstHome: true }))
    // Then
    expect(result.ltvLimit).toBe(400000000)
  })

  it('그 외 지역은 생애 첫 집이어도 6억원 상한이 없다', () => {
    // Given 집값 10억 x 80% = 8억
    // When
    const result = getHomeResult(makeHome({ housePrice: 1000000000, isFirstHome: true }))
    // Then
    expect(result.ltvLimit).toBe(800000000)
  })

  it('생애 첫 집이 아니면 6억원 상한이 없다', () => {
    // Given 집값 10억, 그 외 지역 → 7억
    // When
    const result = getHomeResult(makeHome({ housePrice: 1000000000 }))
    // Then
    expect(result.ltvLimit).toBe(700000000)
  })

  it('소득 기준(DSR) 한도는 (연소득 x 40%) / 12를 매달 갚을 돈으로 보고 거꾸로 계산한다', () => {
    // Given 연소득 6,000만원 x 40% = 2,400만원 → 매달 200만원, 금리 0%, 120개월
    // When
    const result = getHomeResult(makeHome())
    // Then
    expect(result.dsrLimit).toBe(240000000)
  })

  it('소득 기준(DSR) 40%는 지역과 관계없이 같다', () => {
    // Given 규제 지역
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED' }))
    // Then
    expect(result.dsrLimit).toBe(240000000)
  })

  it('다른 대출은 5년 원리금균등으로 갚는다고 보고 1년 상환액을 연소득 x 40%에서 뺀다', () => {
    // Given 다른 대출 3,000만원, 금리 0% → 60개월 월 50만원 = 연 600만원 → 연 2,400만원 - 600만원 = 1,800만원 → 매달 150만원
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 30000000, rate: 0 })] }))
    // Then
    expect(result.dsrLimit).toBe(180000000)
  })

  it('다른 대출 남은 기간이 짧을수록 1년 상환액이 커서 소득 기준 한도가 줄어든다', () => {
    // Given 다른 대출 3,600만원, 금리 0%, 남은 기간 36개월 → 월 100만원 = 연 1,200만원 → 연 2,400만원 - 1,200만원 = 1,200만원 → 매달 100만원
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 36000000, rate: 0, months: 36 })] }))
    // Then
    expect(result.dsrLimit).toBe(120000000)
  })

  it('다른 대출 남은 기간을 비우면 5년으로 본다', () => {
    // Given 다른 대출 3,600만원, 금리 0%, 남은 기간 빈 칸 → 60개월 월 60만원 = 연 720만원 → 연 1,680만원 → 매달 140만원
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 36000000, rate: 0, months: '' })] }))
    // Then
    expect(result.dsrLimit).toBe(168000000)
  })

  it('다른 대출 금리가 있으면 이자까지 넣어 1년 상환액을 계산한다', () => {
    // Given 다른 대출 3,000만원, 금리 6%, 60개월
    const other = calcPayment('EQUAL_PI', 30000000, 6, 60)
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 30000000, rate: 6 })] }))
    // Then
    expect(result.dsrLimit).toBe(Math.round(((24000000 - other.monthly * 12) / 12) * 120))
  })

  it('다른 대출 상환액이 갚을 수 있는 돈 이상이면 소득 기준 한도는 0이다', () => {
    // Given 다른 대출 1.2억, 금리 0% → 연 2,400만원 = 갚을 수 있는 돈
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 120000000, rate: 0 })] }))
    // Then
    expect(result.dsrLimit).toBe(0)
  })

  it('소득 기준 한도가 0이면 최대 대출 한도도 0이다', () => {
    // Given 다른 대출 상환액이 갚을 수 있는 돈과 같음
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 120000000, rate: 0 })] }))
    // Then
    expect(result.maxLoan).toBe(0)
  })

  it('다른 대출이 있어요를 체크하지 않으면 입력한 다른 대출 잔액은 무시한다', () => {
    // Given 다른 대출 1.2억이 적혀 있지만 체크 안 함
    // When
    const result = getHomeResult(makeHome({ isOtherLoan: false, otherLoans: [makeOther({ balance: 120000000, rate: 0 })] }))
    // Then
    expect(result.dsrLimit).toBe(240000000)
  })

  it('다른 대출이 여러 건이면 건마다 1년 상환액을 구해 더한다', () => {
    // Given 3,000만원 금리 0% 60개월 (연 600만원) + 3,600만원 금리 0% 36개월 (연 1,200만원) → 연 2,400만원 - 1,800만원 = 600만원 → 매달 50만원
    // When
    const result = getHomeResult(
      makeHome({ otherLoans: [makeOther({ balance: 30000000, rate: 0 }), makeOther({ balance: 36000000, rate: 0, months: 36 })] }),
    )
    // Then
    expect(result.dsrLimit).toBe(60000000)
  })

  it('원금균등 다른 대출은 첫 1년의 원금과 이자를 더한다 (DSR 계산기와 같음)', () => {
    // Given 1,200만원 연 12% 12개월 원금균등 → 원금 1,200만원 + 이자 78만원 = 연 1,278만원 → 연 2,400만원 - 1,278만원 = 1,122만원 → 10년
    // When
    const result = getHomeResult(
      makeHome({ otherLoans: [makeOther({ method: 'EQUAL_P', balance: 12000000, rate: 12, months: 12 })] }),
    )
    // Then
    expect(result.dsrLimit).toBe(112200000)
  })

  it('만기일시 신용대출은 남은 기간과 관계없이 원금을 5년에 나눠 갚는다고 본다', () => {
    // Given 신용대출 6,000만원 금리 0% 남은 12개월 만기일시 → 연 1,200만원 → 연 2,400만원 - 1,200만원 = 1,200만원 → 10년
    // When
    const result = getHomeResult(
      makeHome({ otherLoans: [makeOther({ method: 'BULLET', balance: 60000000, rate: 0, months: 12 })] }),
    )
    // Then
    expect(result.dsrLimit).toBe(120000000)
  })

  it('만기일시 신용대출이 아니면 원금을 남은 기간에 나눠 갚는다고 본다', () => {
    // Given 기타 대출 3,600만원 금리 0% 남은 36개월 만기일시 → 연 1,200만원 → 연 2,400만원 - 1,200만원 = 1,200만원 → 10년
    // When
    const result = getHomeResult(
      makeHome({ otherLoans: [makeOther({ kind: 'OTHER', method: 'BULLET', balance: 36000000, rate: 0, months: 36 })] }),
    )
    // Then
    expect(result.dsrLimit).toBe(120000000)
  })

  it('남은 기간이 12개월보다 짧은 다른 대출은 남은 개월 수만큼만 더한다', () => {
    // Given 600만원 금리 0% 남은 6개월 원리금균등 → 연 600만원 → 연 2,400만원 - 600만원 = 1,800만원 → 10년
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 6000000, rate: 0, months: 6 })] }))
    // Then
    expect(result.dsrLimit).toBe(180000000)
  })

  it('잔액이 없는 다른 대출 건은 건너뛴다', () => {
    // Given 잔액이 있는 건 하나와 잔액 빈 건 하나
    // When
    const result = getHomeResult(
      makeHome({ otherLoans: [makeOther({ balance: 30000000, rate: 0 }), makeOther({ balance: '' })] }),
    )
    // Then
    expect(result.dsrLimit).toBe(180000000)
  })

  it('다른 대출 잔액을 비워 두면 0으로 본다', () => {
    // Given 다른 대출 잔액 빈 칸
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: '' })] }))
    // Then
    expect(result.dsrLimit).toBe(240000000)
  })

  it('최대 대출 한도는 집값 기준과 소득 기준 중 작은 쪽이다 (소득 기준이 작을 때)', () => {
    // Given 집값 기준 3.5억, 소득 기준 2.4억
    // When
    const result = getHomeResult(makeHome())
    // Then
    expect(result.maxLoan).toBe(240000000)
  })

  it('최대 대출 한도는 집값 기준과 소득 기준 중 작은 쪽이다 (집값 기준이 작을 때)', () => {
    // Given 연소득 1억원 → 소득 기준 4억, 집값 기준 3.5억
    // When
    const result = getHomeResult(makeHome({ annualIncome: 100000000 }))
    // Then
    expect(result.maxLoan).toBe(350000000)
  })

  it('첫 달 납입액은 최대 대출 한도를 빌렸을 때의 첫 달 금액이다', () => {
    // Given 최대 한도 2.4억, 금리 0%, 120개월 원리금균등 → 240,000,000 / 120
    // When
    const result = getHomeResult(makeHome())
    // Then
    expect(result.firstPayment).toBe(2000000)
  })

  it('내 돈으로 낼 금액은 집값에서 최대 대출 한도를 뺀 금액이다', () => {
    // Given 집값 5억, 최대 한도 2.4억
    // When
    const result = getHomeResult(makeHome())
    // Then
    expect(result.ownMoney).toBe(260000000)
  })

  it('최대 대출 한도가 0이면 첫 달 납입액은 0이고 내 돈은 집값 전체이다', () => {
    // Given 소득 기준 한도 0
    // When
    const result = getHomeResult(makeHome({ otherLoans: [makeOther({ balance: 120000000, rate: 0 })] }))
    // Then
    expect([result.firstPayment, result.ownMoney]).toEqual([0, 500000000])
  })

  it('집값 기준이 더 작으면 isLtvLower는 true이다', () => {
    // Given 집값 기준 3.5억, 소득 기준 4억
    // When
    const result = getHomeResult(makeHome({ annualIncome: 100000000 }))
    // Then
    expect(result.isLtvLower).toBe(true)
  })

  it('소득 기준이 더 작으면 isLtvLower는 false이다', () => {
    // Given 집값 기준 3.5억, 소득 기준 2.4억
    // When
    const result = getHomeResult(makeHome())
    // Then
    expect(result.isLtvLower).toBe(false)
  })

  it('금리가 있으면 소득 기준 한도의 월 상환액이 매달 갚을 돈과 같다', () => {
    // Given 연소득 6,000만원 x 40% / 12 = 매달 200만원, 연 6%, 10년
    const result = getHomeResult(makeHome({ rate: 6 }))
    // When
    const payment = calcPayment('EQUAL_PI', result.dsrLimit, 6, 120)
    // Then
    expect(payment.monthly).toBe(2000000)
  })

  it('수도권·규제 지역은 집값 15억 이하이면 대출 상한이 6억이다', () => {
    // Given 규제 지역, 집값 15억, 생애 첫 집 (LTV 70% = 10.5억)
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED', housePrice: 1500000000, isFirstHome: true }))
    // Then
    expect([result.priceCap, result.ltvLimit, result.isPriceCapped]).toEqual([600000000, 600000000, true])
  })

  it('수도권·규제 지역은 집값 15억 초과 25억 이하이면 대출 상한이 4억이다', () => {
    // Given 규제 지역, 집값 20억 (LTV 40% = 8억)
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED', housePrice: 2000000000 }))
    // Then
    expect([result.priceCap, result.ltvLimit]).toEqual([400000000, 400000000])
  })

  it('수도권·규제 지역은 집값 25억 초과이면 대출 상한이 2억이다', () => {
    // Given 규제 지역, 집값 30억
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED', housePrice: 3000000000 }))
    // Then
    expect([result.priceCap, result.ltvLimit]).toEqual([200000000, 200000000])
  })

  it('집값 구간 상한보다 집값 기준 한도가 작으면 상한은 적용되지 않은 것으로 본다', () => {
    // Given 규제 지역, 집값 5억 (LTV 40% = 2억, 상한 6억)
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED' }))
    // Then
    expect([result.priceCap, result.ltvLimit, result.isPriceCapped]).toEqual([600000000, 200000000, false])
  })

  it('그 외 지역은 집값 구간 상한이 없다', () => {
    // Given 그 외 지역, 집값 20억 (LTV 70% = 14억)
    // When
    const result = getHomeResult(makeHome({ housePrice: 2000000000 }))
    // Then
    expect([result.priceCap, result.ltvLimit, result.isPriceCapped]).toEqual([null, 1400000000, false])
  })

  it('생애 첫 집도 집값 구간 상한을 넘지 않는다', () => {
    // Given 규제 지역, 집값 20억, 생애 첫 집 (LTV 70% = 14억 → 구간 상한 4억)
    // When
    const result = getHomeResult(makeHome({ region: 'REGULATED', housePrice: 2000000000, isFirstHome: true }))
    // Then
    expect(result.ltvLimit).toBe(400000000)
  })

  it('고정형은 스트레스 금리를 더하지 않는다', () => {
    // Given 금리 0%, 고정형
    // When
    const result = getHomeResult(makeHome({ rateType: 'FIXED' }))
    // Then
    expect([result.stressRate, result.limitRate, result.dsrLimit]).toEqual([0, 0, 240000000])
  })

  it('변동형은 스트레스 금리 1.5%p를 더한 금리로 소득 기준 한도를 계산한다', () => {
    // Given 금리 4.5%, 변동형 → 6%
    // When
    const result = getHomeResult(makeHome({ rate: 4.5, rateType: 'VARIABLE' }))
    // Then
    expect([result.limitRate, result.dsrLimit]).toEqual([6, calcMaxLoan('EQUAL_PI', 2000000, 6, 120)])
  })

  it('혼합형은 스트레스 금리 1.05%p를 더한 금리로 소득 기준 한도를 계산한다', () => {
    // Given 금리 4%, 혼합형 → 5.05%
    // When
    const result = getHomeResult(makeHome({ rate: 4, rateType: 'MIXED' }))
    // Then
    expect([result.limitRate, result.dsrLimit]).toEqual([5.05, calcMaxLoan('EQUAL_PI', 2000000, 5.05, 120)])
  })

  it('첫 달 납입액은 스트레스 금리가 아니라 입력한 금리로 계산한다', () => {
    // Given 금리 6%, 변동형
    const result = getHomeResult(makeHome({ rate: 6, rateType: 'VARIABLE' }))
    // When
    const payment = calcPayment('EQUAL_PI', result.maxLoan, 6, 120)
    // Then
    expect(result.firstPayment).toBe(payment.monthly)
  })

  it('모르는 금리 유형은 null이다', () => {
    // Given 금리 유형 ETC
    // When
    const result = getHomeResult(makeHome({ rateType: 'ETC' }))
    // Then
    expect(result).toBeNull()
  })

  it('모르는 지역 코드는 null이다', () => {
    // Given 지역 코드 ETC
    // When
    const result = getHomeResult(makeHome({ region: 'ETC' }))
    // Then
    expect(result).toBeNull()
  })
})

describe('getHomeErrors (내 집 입력 검사)', () => {
  it('처음 값은 집값이 빈칸이라 입력 안내가 난다', () => {
    // Given 숫자 칸은 빈칸으로 열림
    // When
    const errors = getHomeErrors(HOME_DEFAULTS)
    // Then
    expect(errors.housePrice).toBe('집값을 입력해 주세요')
  })

  it('집값이 비면 입력 안내를 보인다', () => {
    // Given 집값 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ housePrice: '' }))
    // Then
    expect(errors.housePrice).toBe('집값을 입력해 주세요')
  })

  it('집값이 1만원 미만이면 범위 안내를 보인다', () => {
    // Given 집값 0
    // When
    const errors = getHomeErrors(makeHome({ housePrice: 0 }))
    // Then
    expect(errors.housePrice).toBe('집값은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('집값이 서버 한도(99억 9,999만원)를 넘으면 오류이다', () => {
    // Given 집값 99억 9,999만원보다 1원 많음
    // When
    const errors = getHomeErrors(makeHome({ housePrice: 9999990001 }))
    // Then
    expect(errors.housePrice).toBeDefined()
  })

  it('연소득이 비면 입력 안내를 보인다', () => {
    // Given 연소득 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ annualIncome: '' }))
    // Then
    expect(errors.annualIncome).toBe('연소득을 입력해 주세요')
  })

  it('연소득이 1만원 미만이면 오류이다', () => {
    // Given 연소득 0
    // When
    const errors = getHomeErrors(makeHome({ annualIncome: 0 }))
    // Then
    expect(errors.annualIncome).toBeDefined()
  })

  it('다른 대출이 있어요를 체크하지 않으면 다른 대출 칸은 검사하지 않는다', () => {
    // Given 체크 안 함, 숨은 칸에 잘못된 값
    // When
    const errors = getHomeErrors(makeHome({ isOtherLoan: false, otherLoans: [makeOther({ balance: -1, rate: 21, months: 601 })] }))
    // Then
    expect(errors.otherLoans).toBeUndefined()
  })

  it('다른 대출이 여러 건이면 오류는 해당 줄 번호에만 표시한다', () => {
    // Given 첫 줄은 정상, 둘째 줄은 잔액이 있는데 금리가 빔
    // When
    const errors = getHomeErrors(
      makeHome({ otherLoans: [makeOther({ balance: 30000000 }), makeOther({ balance: 10000000, rate: '' })] }),
    )
    // Then
    expect([errors.otherLoans[0], errors.otherLoans[1].rate]).toEqual([{}, '다른 대출 금리를 입력해 주세요'])
  })

  it('다른 대출 1년 이자 합계가 한도를 넘으면 오류 문구를 보인다', () => {
    // Given 99억 9,999만원 금리 20% 6건 → 이자 합계 약 120억원
    const loan = makeOther({ balance: 9999990000, rate: 20 })
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [loan, loan, loan, loan, loan, loan] }))
    // Then
    expect(errors.otherInterestTotal).toBe('다른 대출의 1년 이자 합계가 너무 커요. 잔액과 금리를 확인해 주세요.')
  })

  it('다른 대출 1년 이자 합계가 한도와 같으면 오류가 아니다', () => {
    // Given 99억 9,999만원 금리 20% 5건 → 이자 합계 9,999,990,000원
    const loan = makeOther({ balance: 9999990000, rate: 20 })
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [loan, loan, loan, loan, loan] }))
    // Then
    expect(errors.otherInterestTotal).toBeUndefined()
  })

  it('다른 대출이 있어요를 체크하지 않으면 이자 합계는 검사하지 않는다', () => {
    // Given 체크 안 함, 합계가 넘는 값이 숨어 있음
    const loan = makeOther({ balance: 9999990000, rate: 20 })
    // When
    const errors = getHomeErrors(makeHome({ isOtherLoan: false, otherLoans: [loan, loan, loan, loan, loan, loan] }))
    // Then
    expect(errors.otherInterestTotal).toBeUndefined()
  })

  it('다른 대출 잔액은 비워 둬도 오류가 아니다', () => {
    // Given 다른 대출 잔액 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ balance: '' })] }))
    // Then
    expect(errors.otherLoans?.[0]?.balance).toBeUndefined()
  })

  it('다른 대출 잔액이 음수이면 오류이다', () => {
    // Given 다른 대출 잔액 -1
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ balance: -1 })] }))
    // Then
    expect(errors.otherLoans[0].balance).toBeDefined()
  })

  it('다른 대출 잔액이 있는데 금리가 비면 입력 안내를 보인다', () => {
    // Given 잔액 3,000만원, 금리 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ balance: 30000000, rate: '' })] }))
    // Then
    expect(errors.otherLoans[0].rate).toBe('다른 대출 금리를 입력해 주세요')
  })

  it('다른 대출 잔액이 없으면 다른 대출 금리는 비워 둬도 된다', () => {
    // Given 잔액 0원, 금리 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ balance: 0, rate: '' })] }))
    // Then
    expect(errors.otherLoans?.[0]?.rate).toBeUndefined()
  })

  it('다른 대출 남은 기간은 비워 둬도 오류가 아니다', () => {
    // Given 남은 기간 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ months: '' })] }))
    // Then
    expect(errors.otherLoans?.[0]?.months).toBeUndefined()
  })

  it('다른 대출 남은 기간이 600개월을 넘으면 범위 안내를 보인다', () => {
    // Given 남은 기간 601개월
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ months: 601 })] }))
    // Then
    expect(errors.otherLoans[0].months).toBe('다른 대출 남은 기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('다른 대출 남은 기간이 소수이면 오류이다', () => {
    // Given 남은 기간 2.5개월
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ months: 2.5 })] }))
    // Then
    expect(errors.otherLoans[0].months).toBeDefined()
  })

  it('다른 대출 금리가 20%를 넘으면 범위 안내를 보인다', () => {
    // Given 다른 대출 금리 21%
    // When
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ balance: 30000000, rate: 21 })] }))
    // Then
    expect(errors.otherLoans[0].rate).toBe('다른 대출 금리는 0% 이상 20% 이하로 입력해 주세요')
  })

  it('금리가 비면 입력 안내를 보인다', () => {
    // Given 금리 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ rate: '' }))
    // Then
    expect(errors.rate).toBe('대출 금리를 입력해 주세요')
  })

  it('금리가 20%를 넘으면 범위 안내를 보인다', () => {
    // Given 금리 21%
    // When
    const errors = getHomeErrors(makeHome({ rate: 21 }))
    // Then
    expect(errors.rate).toBe('금리는 0% 이상 20% 이하로 입력해 주세요')
  })

  it('금리 0%는 오류가 아니다', () => {
    // Given 금리 0%
    // When
    const errors = getHomeErrors(makeHome({ rate: 0 }))
    // Then
    expect(errors.rate).toBeUndefined()
  })

  it('대출 기간이 비면 입력 안내를 보인다', () => {
    // Given 기간 빈 칸
    // When
    const errors = getHomeErrors(makeHome({ years: '' }))
    // Then
    expect(errors.years).toBe('대출 기간을 입력해 주세요')
  })

  it('대출 기간이 0년이면 범위 안내를 보인다', () => {
    // Given 기간 0년
    // When
    const errors = getHomeErrors(makeHome({ years: 0 }))
    // Then
    expect(errors.years).toBe('대출 기간은 1년 이상 50년 이하로 입력해 주세요')
  })

  it('대출 기간이 51년이면 오류이다', () => {
    // Given 기간 51년
    // When
    const errors = getHomeErrors(makeHome({ years: 51 }))
    // Then
    expect(errors.years).toBeDefined()
  })

  it('대출 기간 50년은 오류가 아니다', () => {
    // Given 기간 50년
    // When
    const errors = getHomeErrors(makeHome({ years: 50 }))
    // Then
    expect(errors.years).toBeUndefined()
  })

  it('대출 기간이 소수이면 오류이다', () => {
    // Given 기간 2.5년
    // When
    const errors = getHomeErrors(makeHome({ years: 2.5 }))
    // Then
    expect(errors.years).toBeDefined()
  })
})

describe('getInitialHome (넘어온 값 → 내 집 입력칸 처음 값)', () => {
  it('넘어온 값이 없으면 기본값이다', () => {
    // Given 넘어온 값 없음
    // When
    const form = getInitialHome(undefined)
    // Then
    expect(form).toEqual(HOME_DEFAULTS)
  })

  it('원 단위 금액을 그대로 받는다', () => {
    // Given 집값 8억원 (원 단위)
    // When
    const form = getInitialHome({ housePrice: 800000000 })
    // Then
    expect(form.housePrice).toBe(800000000)
  })

  it('범위 밖 집값은 그 칸만 기본값이다', () => {
    // Given 집값 0원, 연소득은 정상 (7,000만원)
    // When
    const form = getInitialHome({ housePrice: 0, annualIncome: 70000000 })
    // Then
    expect(form.housePrice).toBe(HOME_DEFAULTS.housePrice)
  })

  it('한 칸이 범위 밖이어도 다른 칸은 받는다', () => {
    // Given 집값 0원, 연소득 7,000만원
    // When
    const form = getInitialHome({ housePrice: 0, annualIncome: 70000000 })
    // Then
    expect(form.annualIncome).toBe(70000000)
  })

  it('규제 지역 코드를 받는다', () => {
    // Given 규제 지역
    // When
    const form = getInitialHome({ homeRegion: 'REGULATED' })
    // Then
    expect(form.region).toBe('REGULATED')
  })

  it('모르는 지역 코드는 기본값이다', () => {
    // Given 지역 코드 ETC
    // When
    const form = getInitialHome({ homeRegion: 'ETC' })
    // Then
    expect(form.region).toBe(HOME_DEFAULTS.region)
  })

  it('생애 첫 집 Y는 체크로 받는다', () => {
    // Given firstHome Y
    // When
    const form = getInitialHome({ firstHome: 'Y' })
    // Then
    expect(form.isFirstHome).toBe(true)
  })

  it('다른 대출 1년 이자 0원은 잔액 0원으로 받는다', () => {
    // Given 다른 대출 1년 이자 0원
    // When
    const form = getInitialHome({ otherInterest: 0 })
    // Then
    expect(form.otherLoans[0].balance).toBe(0)
  })

  it('저장한 다른 대출 건별 값이 있으면 그대로 채우고 체크한다', () => {
    // Given 건별 2건과 1년 이자 합계
    const state = {
      otherInterest: 4200000,
      otherLoans: [
        { loanKind: 'MORTGAGE', repayMethod: 'EQUAL_P', loanAmount: 60000000, interestRate: 5, loanMonths: 60 },
        { loanKind: 'CREDIT', repayMethod: 'BULLET', loanAmount: 40000000, interestRate: 3, loanMonths: 36 },
      ],
    }
    // When
    const form = getInitialHome(state)
    // Then
    expect([form.isOtherLoan, form.otherLoans]).toEqual([
      true,
      [
        { kind: 'MORTGAGE', method: 'EQUAL_P', balance: 60000000, rate: 5, months: 60 },
        { kind: 'CREDIT', method: 'BULLET', balance: 40000000, rate: 3, months: 36 },
      ],
    ])
  })

  it('저장한 다른 대출 건의 종류, 상환 방식이 없거나 이상하면 그 칸만 신용대출, 원리금균등으로 채운다', () => {
    // Given 종류 ETC, 상환 방식 없음
    const state = { otherLoans: [{ loanKind: 'ETC', loanAmount: 60000000, interestRate: 5, loanMonths: 60 }] }
    // When
    const form = getInitialHome(state)
    // Then
    expect(form.otherLoans).toEqual([{ kind: 'CREDIT', method: 'EQUAL_PI', balance: 60000000, rate: 5, months: 60 }])
  })

  it('저장한 다른 대출 건 중 범위 밖 값이 있으면 건별 값은 쓰지 않고 1년 이자로 맞춘다', () => {
    // Given 둘째 건 금리 21%, 1년 이자 300만원
    const state = {
      otherInterest: 3000000,
      otherLoans: [
        { loanAmount: 60000000, interestRate: 5, loanMonths: 60 },
        { loanAmount: 40000000, interestRate: 21, loanMonths: 36 },
      ],
    }
    // When
    const form = getInitialHome(state)
    // Then
    expect(form.otherLoans).toEqual([{ kind: 'CREDIT', method: 'EQUAL_PI', balance: 60000000, rate: 5, months: 60 }])
  })

  it('저장한 다른 대출 건이 빈 목록이면 체크하지 않는다', () => {
    // Given 빈 목록, 이자 0원
    // When
    const form = getInitialHome({ otherInterest: 0, otherLoans: [] })
    // Then
    expect(form.isOtherLoan).toBe(false)
  })

  it('저장한 금리 유형을 받는다', () => {
    // Given 혼합형
    // When
    const form = getInitialHome({ rateType: 'MIXED' })
    // Then
    expect(form.rateType).toBe('MIXED')
  })

  it('모르는 금리 유형은 기본값이다', () => {
    // Given 금리 유형 ETC
    // When
    const form = getInitialHome({ rateType: 'ETC' })
    // Then
    expect(form.rateType).toBe(HOME_DEFAULTS.rateType)
  })

  it('다른 대출 1년 이자가 있으면 다른 대출이 있어요가 체크된다', () => {
    // Given 1년 이자 300만원
    // When
    const form = getInitialHome({ otherInterest: 3000000 })
    // Then
    expect(form.isOtherLoan).toBe(true)
  })

  it('다른 대출 1년 이자가 0원이면 다른 대출이 있어요가 체크되지 않는다', () => {
    // Given 1년 이자 0원
    // When
    const form = getInitialHome({ otherInterest: 0 })
    // Then
    expect(form.isOtherLoan).toBe(false)
  })

  it('다른 대출 1년 이자는 기본 금리 5%로 잔액을 거꾸로 맞춰 받는다', () => {
    // Given 1년 이자 300만원 → 잔액 300만원 / 5% = 6,000만원
    // When
    const form = getInitialHome({ otherInterest: 3000000 })
    // Then
    expect([form.otherLoans[0].balance, form.otherLoans[0].rate]).toEqual([60000000, 5])
  })

  it('소수 대출 기간은 기본값이다', () => {
    // Given 기간 2.5년
    // When
    const form = getInitialHome({ loanYears: 2.5 })
    // Then
    expect(form.years).toBe(HOME_DEFAULTS.years)
  })
})

describe('toHomeRecord (내 집 저장 본문, API-59)', () => {
  it('서버가 받는 13개 칸만 보낸다', () => {
    // Given 계산한 결과
    const form = makeHome()
    const result = getHomeResult(form)
    // When
    const record = toHomeRecord(form, result)
    // Then
    expect(Object.keys(record).sort()).toEqual(
      [
        'housePrice',
        'homeRegion',
        'firstHome',
        'annualIncome',
        'otherInterest',
        'interestRate',
        'loanYears',
        'repayMethod',
        'maxLoan',
        'ltvLimit',
        'dtiLimit',
        'rateType',
        'otherLoans',
      ].sort(),
    )
  })

  it('금리 유형을 같이 보낸다', () => {
    // Given 변동형
    const form = makeHome({ rateType: 'VARIABLE' })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.rateType).toBe('VARIABLE')
  })

  it('다른 대출을 건별로 종류, 상환 방식과 함께 입력 순서대로 보낸다', () => {
    // Given 신용대출 원리금균등 6,000만원 5% 60개월, 주택담보대출 원금균등 4,000만원 3% 36개월
    const form = makeHome({
      otherLoans: [
        makeOther({ balance: 60000000, rate: 5 }),
        makeOther({ kind: 'MORTGAGE', method: 'EQUAL_P', balance: 40000000, rate: 3, months: 36 }),
      ],
    })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherLoans).toEqual([
      { loanKind: 'CREDIT', repayMethod: 'EQUAL_PI', loanAmount: 60000000, interestRate: 5, loanMonths: 60 },
      { loanKind: 'MORTGAGE', repayMethod: 'EQUAL_P', loanAmount: 40000000, interestRate: 3, loanMonths: 36 },
    ])
  })

  it('잔액이 없는 다른 대출 건은 보내지 않는다', () => {
    // Given 잔액이 있는 건 하나와 잔액 빈 건 하나
    const form = makeHome({ otherLoans: [makeOther({ balance: 30000000 }), makeOther({ balance: '' })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherLoans).toHaveLength(1)
  })

  it('남은 기간을 비운 다른 대출 건은 5년(60개월)으로 보낸다', () => {
    // Given 남은 기간 빈 칸
    const form = makeHome({ otherLoans: [makeOther({ balance: 30000000, months: '' })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherLoans[0].loanMonths).toBe(60)
  })

  it('다른 대출이 있어요를 체크하지 않으면 다른 대출 건은 빈 목록으로 보낸다', () => {
    // Given 체크 안 함
    const form = makeHome({ isOtherLoan: false, otherLoans: [makeOther({ balance: 30000000 })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherLoans).toEqual([])
  })

  it('원 단위 입력을 그대로 보낸다', () => {
    // Given 집값 5억원
    const form = makeHome()
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.housePrice).toBe(500000000)
  })

  it('생애 첫 집은 Y, 아니면 N으로 보낸다', () => {
    // Given 생애 첫 집 체크
    const form = makeHome({ isFirstHome: true })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.firstHome).toBe('Y')
  })

  it('비운 다른 대출 잔액은 1년 이자 0원으로 보낸다', () => {
    // Given 다른 대출 잔액 빈 칸
    const form = makeHome({ otherLoans: [makeOther({ balance: '' })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherInterest).toBe(0)
  })

  it('다른 대출이 있어요를 체크하지 않으면 다른 대출 1년 이자는 0원으로 보낸다', () => {
    // Given 잔액 6,000만원, 금리 5%가 적혀 있지만 체크 안 함
    const form = makeHome({ isOtherLoan: false, otherLoans: [makeOther({ balance: 60000000, rate: 5 })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherInterest).toBe(0)
  })

  it('다른 대출이 여러 건이면 1년 이자를 모두 더해 보낸다', () => {
    // Given 6,000만원 5% (300만원) + 4,000만원 3% (120만원)
    const form = makeHome({ otherLoans: [makeOther({ balance: 60000000, rate: 5 }), makeOther({ balance: 40000000, rate: 3 })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherInterest).toBe(4200000)
  })

  it('다른 대출 1년 이자는 잔액 x 금리로 계산해 보낸다', () => {
    // Given 잔액 6,000만원, 금리 5%
    const form = makeHome({ otherLoans: [makeOther({ balance: 60000000, rate: 5 })] })
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.otherInterest).toBe(3000000)
  })

  it('상환 방식은 원리금균등으로 보낸다', () => {
    // Given
    const form = makeHome()
    // When
    const record = toHomeRecord(form, getHomeResult(form))
    // Then
    expect(record.repayMethod).toBe('EQUAL_PI')
  })

  it('서버 칸 dtiLimit에는 소득 기준(DSR) 한도를 보낸다', () => {
    // Given
    const form = makeHome()
    const result = getHomeResult(form)
    // When
    const record = toHomeRecord(form, result)
    // Then
    expect(record.dtiLimit).toBe(result.dsrLimit)
  })

  it('저장한 기록을 그대로 넘기면 같은 입력칸이 복원된다', () => {
    // Given 저장 본문(원 단위)을 MY [불러오기]가 그대로 넘기는 상황
    const form = makeHome({
      region: 'REGULATED',
      isFirstHome: true,
      rate: 4.25,
      rateType: HOME_DEFAULTS.rateType,
      years: 25,
      otherLoans: [makeOther({ balance: 60000000, rate: 5 })],
    })
    const record = toHomeRecord(form, getHomeResult(form))
    // When
    const loaded = getInitialHome(record)
    // Then
    expect(loaded).toEqual(form)
  })
})

describe('calcMaxLoan 만기일시 (CA-10)', () => {
  it('만기일시는 매달 이자 / 월 금리로 거꾸로 계산한다', () => {
    // Given 매달 이자 100만원, 연 12% (월 1%)
    // When
    const principal = calcMaxLoan('BULLET', 1000000, 12, 12)
    // Then
    expect(principal).toBe(100000000)
  })

  it('만기일시는 금리가 0%이면 null이다', () => {
    // Given 연 0%
    // When
    const principal = calcMaxLoan('BULLET', 1000000, 0, 12)
    // Then
    expect(principal).toBeNull()
  })
})

// 손으로 계산하기 쉬운 값: 매달 100만원, 금리 0%, 12개월 → 최대 1,200만원
const makeReverse = (patch = {}) => ({ method: 'EQUAL_PI', monthly: 1000000, rate: 0, months: 12, ...patch })

describe('getReverseResult (상환능력 기반 대출 계산)', () => {
  it('금리 0% 원리금균등의 최대 대출 금액은 매달 갚을 돈 x 개월이다', () => {
    // Given 매달 100만원, 금리 0%, 12개월
    // When
    const result = getReverseResult(makeReverse())
    // Then
    expect(result.maxLoan).toBe(12000000)
  })

  it('원금균등은 첫 달 상환액으로 거꾸로 계산한다', () => {
    // Given 첫 달 100만원, 연 12% (월 1%), 12개월 → 100만 / (1/12 + 0.01)
    // When
    const result = getReverseResult(makeReverse({ method: 'EQUAL_P', rate: 12 }))
    // Then
    expect(result.maxLoan).toBe(10714286)
  })

  it('만기일시는 상환 방식에서 빼서 계산하지 않고 null이다', () => {
    // Given 만기일시, 연 12% (상환능력 계산기는 원리금균등, 원금균등만)
    // When
    const result = getReverseResult(makeReverse({ method: 'BULLET', rate: 12 }))
    // Then
    expect(result).toBeNull()
  })

  it('금리 0%이면 총 이자는 0원이다', () => {
    // Given 원리금균등, 연 0%
    // When
    const result = getReverseResult(makeReverse())
    // Then
    expect(result.totalInterest).toBe(0)
  })

  it('총 갚는 돈은 최대 대출 금액 + 총 이자이다', () => {
    // Given 원리금균등, 연 12%
    // When
    const result = getReverseResult(makeReverse({ rate: 12 }))
    // Then
    expect(result.totalPayment).toBe(result.maxLoan + result.totalInterest)
  })

  it('총 이자는 대출 이자 계산기와 같은 상환 계산(calcPayment)으로 구한다', () => {
    // Given 매달 100만원, 연 6%, 36개월 원리금균등
    const result = getReverseResult(makeReverse({ rate: 6, months: 36 }))
    // When
    const plan = calcPayment('EQUAL_PI', result.maxLoan, 6, 36)
    // Then
    expect(result.totalInterest).toBe(plan.totalInterest)
  })

  it('기간별 금액은 기간 선택지마다 하나씩이다', () => {
    // Given 기간 선택지 전체
    // When
    const result = getReverseResult(makeReverse())
    // Then
    expect(result.byTerm.map((term) => term.months)).toEqual(REVERSE_TERMS)
  })

  it('입력한 기간이 기간 선택지에 없으면 기간별 금액에 끼워 넣는다', () => {
    // Given 24개월
    // When
    const result = getReverseResult(makeReverse({ months: 24 }))
    // Then
    expect(result.byTerm.map((term) => term.months)).toEqual([12, 24, 36, 60, 120, 180])
  })

  it('기간별 금액은 그 기간으로 계산한 최대 대출 금액이다', () => {
    // Given 금리 0%, 매달 100만원 → 36개월은 3,600만원
    // When
    const result = getReverseResult(makeReverse())
    // Then
    expect(result.byTerm.find((term) => term.months === 36).maxLoan).toBe(36000000)
  })

  it('이자가 있으면 기간이 길수록 더 빌릴 수 있다', () => {
    // Given 연 5%
    // When
    const { byTerm } = getReverseResult(makeReverse({ rate: 5 }))
    // Then
    expect(byTerm[byTerm.length - 1].maxLoan > byTerm[0].maxLoan).toBe(true)
  })

  it('원금균등은 기간이 길수록 더 빌릴 수 있다', () => {
    // Given 원금균등, 연 12%
    // When
    const { byTerm } = getReverseResult(makeReverse({ method: 'EQUAL_P', rate: 12 }))
    // Then
    expect(byTerm[byTerm.length - 1].maxLoan > byTerm[0].maxLoan).toBe(true)
  })

  it('모르는 상환 방식이면 계산하지 않고 null이다', () => {
    // Given 체증식
    // When
    const result = getReverseResult(makeReverse({ method: 'GRADUATED', rate: 5 }))
    // Then
    expect(result).toBeNull()
  })
})

describe('getReverseErrors (상환능력 입력 검사)', () => {
  it('처음 값은 매달 갚을 돈이 빈칸이라 입력 안내가 난다', () => {
    // Given 숫자 칸은 빈칸으로 열림
    // When
    const errors = getReverseErrors(REVERSE_DEFAULTS)
    // Then
    expect(errors.monthly).toBe('매달 갚을 돈을 입력해 주세요')
  })

  it('매달 갚을 돈이 비면 입력 안내를 보인다', () => {
    // Given 매달 갚을 돈 빈 칸
    // When
    const errors = getReverseErrors(makeReverse({ monthly: '' }))
    // Then
    expect(errors.monthly).toBe('매달 갚을 돈을 입력해 주세요')
  })

  it('매달 갚을 돈이 1만원 미만이면 범위 안내를 보인다', () => {
    // Given 매달 갚을 돈 0
    // When
    const errors = getReverseErrors(makeReverse({ monthly: 0 }))
    // Then
    expect(errors.monthly).toBe('매달 갚을 돈은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('매달 갚을 돈이 서버 한도(99억 9,999만원)를 넘으면 오류이다', () => {
    // Given 매달 갚을 돈 99억 9,999만원보다 1원 많음
    // When
    const errors = getReverseErrors(makeReverse({ monthly: 9999990001 }))
    // Then
    expect(errors.monthly).toBeDefined()
  })

  it('이자율이 비면 입력 안내를 보인다', () => {
    // Given 이자율 빈 칸
    // When
    const errors = getReverseErrors(makeReverse({ rate: '' }))
    // Then
    expect(errors.rate).toBe('연 이자율을 입력해 주세요')
  })

  it('이자율이 20%를 넘으면 범위 안내를 보인다', () => {
    // Given 이자율 21%
    // When
    const errors = getReverseErrors(makeReverse({ rate: 21 }))
    // Then
    expect(errors.rate).toBe('연 이자율은 0% 이상 20% 이하로 입력해 주세요')
  })

  it('원금균등은 이자율 0%도 오류가 아니다', () => {
    // Given 원금균등, 이자율 0% (만기일시를 빼면서 0% 규칙도 없앰)
    // When
    const errors = getReverseErrors(makeReverse({ method: 'EQUAL_P', rate: 0 }))
    // Then
    expect(errors.rate).toBeUndefined()
  })

  it('원리금균등은 이자율 0%도 오류가 아니다', () => {
    // Given 원리금균등, 이자율 0%
    // When
    const errors = getReverseErrors(makeReverse({ rate: 0 }))
    // Then
    expect(errors.rate).toBeUndefined()
  })

  it('기간이 비어 있으면 오류이다', () => {
    // Given 기간 비움
    // When
    const errors = getReverseErrors(makeReverse({ months: '' }))
    // Then
    expect(errors.months).toBe('대출 기간을 입력해 주세요')
  })

  it('기간이 600개월을 넘으면 오류이다', () => {
    // Given 601개월
    // When
    const errors = getReverseErrors(makeReverse({ months: 601 }))
    // Then
    expect(errors.months).toBe('대출 기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('기간이 소수이면 오류이다', () => {
    // Given 12.5개월
    // When
    const errors = getReverseErrors(makeReverse({ months: 12.5 }))
    // Then
    expect(errors.months).toBe('대출 기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('기간 선택지에 없는 기간도 1-600개월이면 통과한다', () => {
    // Given 24개월
    // When
    const errors = getReverseErrors(makeReverse({ months: 24 }))
    // Then
    expect(errors.months).toBeUndefined()
  })
})

describe('getInitialReverse (넘어온 값 → 상환능력 입력칸 처음 값)', () => {
  it('넘어온 값이 없으면 기본값이다', () => {
    // Given 넘어온 값 없음
    // When
    const form = getInitialReverse(undefined)
    // Then
    expect(form).toEqual(REVERSE_DEFAULTS)
  })

  it('원 단위 금액을 그대로 받는다', () => {
    // Given 매달 갚을 돈 200만원 (원 단위)
    // When
    const form = getInitialReverse({ monthlyPayment: 2000000 })
    // Then
    expect(form.monthly).toBe(2000000)
  })

  it('범위 밖 금액은 그 칸만 기본값이다', () => {
    // Given 매달 갚을 돈 0원
    // When
    const form = getInitialReverse({ monthlyPayment: 0 })
    // Then
    expect(form.monthly).toBe(REVERSE_DEFAULTS.monthly)
  })

  it('범위 밖 이자율은 기본값이다', () => {
    // Given 이자율 21%
    // When
    const form = getInitialReverse({ interestRate: 21 })
    // Then
    expect(form.rate).toBe(REVERSE_DEFAULTS.rate)
  })

  it('1-600개월 안의 기간은 선택지에 없어도 받는다', () => {
    // Given 24개월
    // When
    const form = getInitialReverse({ loanMonths: 24 })
    // Then
    expect(form.months).toBe(24)
  })

  it('범위 밖 기간은 기본값이다', () => {
    // Given 601개월
    // When
    const form = getInitialReverse({ loanMonths: 601 })
    // Then
    expect(form.months).toBe(REVERSE_DEFAULTS.months)
  })

  it('기간 선택지에 있는 기간을 받는다', () => {
    // Given 120개월
    // When
    const form = getInitialReverse({ loanMonths: 120 })
    // Then
    expect(form.months).toBe(120)
  })

  it('예전에 만기일시로 저장한 기록은 원리금균등으로 연다', () => {
    // Given 상환 방식 만기일시 (상환능력 계산기에서 뺌)
    // When
    const form = getInitialReverse({ repayMethod: 'BULLET' })
    // Then
    expect(form.method).toBe('EQUAL_PI')
  })

  it('체증식은 기본값이다', () => {
    // Given 상환 방식 체증식
    // When
    const form = getInitialReverse({ repayMethod: 'GRADUATED' })
    // Then
    expect(form.method).toBe(REVERSE_DEFAULTS.method)
  })
})

describe('toReverseRecord (상환능력 저장 본문, API-58)', () => {
  it('서버가 받는 5개 칸만 보낸다', () => {
    // Given 계산한 결과
    const form = makeReverse()
    // When
    const record = toReverseRecord(form, getReverseResult(form))
    // Then
    expect(Object.keys(record).sort()).toEqual(
      ['repayMethod', 'monthlyPayment', 'interestRate', 'loanMonths', 'maxLoan'].sort(),
    )
  })

  it('원 단위 입력을 그대로 보낸다', () => {
    // Given 매달 갚을 돈 100만원
    const form = makeReverse()
    // When
    const record = toReverseRecord(form, getReverseResult(form))
    // Then
    expect(record.monthlyPayment).toBe(1000000)
  })

  it('최대 대출 금액은 요약의 값 그대로 보낸다', () => {
    // Given 최대 대출 금액 1,200만원
    const form = makeReverse()
    // When
    const record = toReverseRecord(form, getReverseResult(form))
    // Then
    expect(record.maxLoan).toBe(12000000)
  })

  it('저장한 기록을 그대로 넘기면 같은 입력칸이 복원된다', () => {
    // Given 저장 본문(원 단위)을 MY [불러오기]가 그대로 넘기는 상황
    const form = makeReverse({ method: 'EQUAL_P', monthly: 2500000, rate: 4.25, months: 120 })
    const record = toReverseRecord(form, getReverseResult(form))
    // When
    const loaded = getInitialReverse(record)
    // Then
    expect(loaded).toEqual(form)
  })
})

describe('toLoanCalcState (대출 이자 계산기로 넘기는 값)', () => {
  it('대출 이자 계산기가 받는 4개 칸만 넘긴다', () => {
    // Given 계산한 결과
    const form = makeReverse()
    // When
    const state = toLoanCalcState(form, getReverseResult(form))
    // Then
    expect(Object.keys(state).sort()).toEqual(['loanAmount', 'loanMonths', 'interestRate', 'repayMethod'].sort())
  })

  it('최대 대출 금액을 원 단위로 넘긴다', () => {
    // Given 최대 대출 금액 1,200만원
    const form = makeReverse()
    // When
    const state = toLoanCalcState(form, getReverseResult(form))
    // Then
    expect(state.loanAmount).toBe(12000000)
  })

  it('10억원을 넘으면 대출 이자 계산기의 한도인 10억원으로 넘긴다', () => {
    // Given 매달 99억 9,999만원, 연 5%, 180개월 → 최대 대출 금액이 10억원보다 큼
    const form = makeReverse({ monthly: 9999990000, rate: 5, months: 180 })
    // When
    const state = toLoanCalcState(form, getReverseResult(form))
    // Then
    expect(state.loanAmount).toBe(1000000000)
  })

  it('만원 아래는 버리고 넘긴다 (금액 칸이 만원 단위)', () => {
    // Given 매달 12만 3,456원, 연 5%, 36개월 → 최대 대출 금액이 만원으로 딱 떨어지지 않음
    const form = makeReverse({ monthly: 123456, rate: 5, months: 36 })
    const { maxLoan } = getReverseResult(form)
    // When
    const state = toLoanCalcState(form, getReverseResult(form))
    // Then
    expect(maxLoan % 10000).not.toBe(0)
    expect(state.loanAmount).toBe(Math.floor(maxLoan / 10000) * 10000)
  })

  it('기간, 금리, 상환 방식을 그대로 넘긴다', () => {
    // Given 원금균등, 연 4.5%, 60개월
    const form = makeReverse({ method: 'EQUAL_P', rate: 4.5, months: 60 })
    // When
    const state = toLoanCalcState(form, getReverseResult(form))
    // Then
    expect([state.loanMonths, state.interestRate, state.repayMethod]).toEqual([60, 4.5, 'EQUAL_P'])
  })
})


// 손으로 계산하기 쉬운 값: 연소득 5,000만원, 대출 1,200만원 원금균등 금리 0% 12개월 → 1년 상환액 1,200만원 (DSR 24%)
const makeLoan = (patch = {}) => ({ kind: 'MORTGAGE', method: 'EQUAL_P', amount: 12000000, rate: 0, months: 12, ...patch })
const makeDsr = (patch = {}) => ({ annualIncome: 50000000, loans: [makeLoan()], ...patch })

describe('getDsrResult (DSR 계산)', () => {
  it('원금균등 금리 0%는 1년 상환액이 원금 전체이다 (1년짜리)', () => {
    // Given 1,200만원, 금리 0%, 12개월
    // When
    const result = getDsrResult(makeDsr())
    // Then
    expect(result.yearlyPayment).toBe(12000000)
  })

  it('기간이 1년보다 길면 첫 1년 동안 갚는 원금만 센다', () => {
    // Given 1,200만원, 금리 0%, 24개월 → 1년에 600만원
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ months: 24 })] }))
    // Then
    expect(result.yearlyPayment).toBe(6000000)
  })

  it('원금균등은 1년 원금에 남은 원금에 붙는 이자를 더한다', () => {
    // Given 1,200만원, 연 12% (월 1%), 12개월 → 원금 1,200만원 + 이자 78만원
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ rate: 12 })] }))
    // Then
    expect(result.yearlyPayment).toBe(12780000)
  })

  it('원리금균등은 월 상환액 x 12이다', () => {
    // Given 1,200만원, 금리 0%, 24개월 → 월 50만원 x 12
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ method: 'EQUAL_PI', months: 24 })] }))
    // Then
    expect(result.yearlyPayment).toBe(6000000)
  })

  it('원리금균등은 기간이 1년보다 짧으면 그 개월 수만큼만 센다', () => {
    // Given 600만원, 금리 0%, 6개월 → 월 100만원 x 6
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ method: 'EQUAL_PI', amount: 6000000, months: 6 })] }))
    // Then
    expect(result.yearlyPayment).toBe(6000000)
  })

  it('만기일시는 원금을 대출 기간에 나눠 갚는다고 보고 계산한다', () => {
    // Given 주택담보 만기일시 1,200만원, 연 12%, 12개월 → 원금균등과 같은 1,278만원
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ method: 'BULLET', rate: 12 })] }))
    // Then
    expect(result.yearlyPayment).toBe(12780000)
  })

  it('신용대출 만기일시는 원금을 5년에 나눠 갚는다고 본다', () => {
    // Given 신용대출 만기일시 1,200만원, 연 12%, 12개월 → 60개월 균등: 원금 240만원 + 이자 130.8만원
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ kind: 'CREDIT', method: 'BULLET', rate: 12 })] }))
    // Then
    expect(result.yearlyPayment).toBe(3708000)
  })

  it('신용대출이라도 원금균등은 입력한 기간으로 계산한다', () => {
    // Given 신용대출 원금균등 1,200만원, 금리 0%, 12개월
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ kind: 'CREDIT' })] }))
    // Then
    expect(result.yearlyPayment).toBe(12000000)
  })

  it('대출 여러 건의 1년 상환액을 모두 더한다', () => {
    // Given 1,200만원 + 1,200만원
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan(), makeLoan()] }))
    // Then
    expect(result.yearlyPayment).toBe(24000000)
  })

  it('대출별 1년 상환액을 입력 순서대로 돌려준다', () => {
    // Given 첫 번째 1,200만원/12개월, 두 번째 1,200만원/24개월
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan(), makeLoan({ months: 24 })] }))
    // Then
    expect(result.loanPayments).toEqual([12000000, 6000000])
  })

  it('DSR은 1년 상환액 / 연소득(%)이다', () => {
    // Given 1년 상환액 1,200만원, 연소득 5,000만원
    // When
    const result = getDsrResult(makeDsr())
    // Then
    expect(result.dsrRate).toBe(24)
  })

  it('DSR은 소수 둘째 자리까지 맞춘다', () => {
    // Given 1년 상환액 1,278만원, 연소득 5,000만원 → 25.56%
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ rate: 12 })] }))
    // Then
    expect(result.dsrRate).toBe(25.56)
  })

  it('DSR 40%는 좋음이다', () => {
    // Given 1년 상환액 2,000만원 = 40%
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ amount: 20000000 })] }))
    // Then
    expect(result.level).toBe('GOOD')
  })

  it('DSR이 40%를 조금 넘으면 주의이다', () => {
    // Given 1년 상환액 2,001만원 = 40.02%
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ amount: 20010000 })] }))
    // Then
    expect(result.level).toBe('WARN')
  })

  it('DSR 50%는 주의이다', () => {
    // Given 1년 상환액 2,500만원 = 50%
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ amount: 25000000 })] }))
    // Then
    expect(result.level).toBe('WARN')
  })

  it('DSR이 50%를 넘으면 위험이다', () => {
    // Given 1년 상환액 2,501만원 = 50.02%
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ amount: 25010000 })] }))
    // Then
    expect(result.level).toBe('BAD')
  })

  it('40%까지 더 갚을 수 있는 돈은 연소득 x 40% - 1년 상환액이다', () => {
    // Given 연소득 5,000만원 x 40% = 2,000만원, 1년 상환액 1,200만원
    // When
    const result = getDsrResult(makeDsr())
    // Then
    expect(result.extraRoom).toBe(8000000)
  })

  it('이미 40%를 넘었으면 더 갚을 수 있는 돈은 0이다', () => {
    // Given 1년 상환액 3,000만원 (60%)
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ amount: 30000000 })] }))
    // Then
    expect(result.extraRoom).toBe(0)
  })

  it('대출이 없으면 null이다', () => {
    // Given 대출 0건
    // When
    const result = getDsrResult(makeDsr({ loans: [] }))
    // Then
    expect(result).toBeNull()
  })

  it('소수 개월은 null이다', () => {
    // Given 기간 2.5개월
    // When
    const result = getDsrResult(makeDsr({ loans: [makeLoan({ months: 2.5 })] }))
    // Then
    expect(result).toBeNull()
  })
})

describe('getDsrErrors (DSR 입력 검사)', () => {
  it('처음 값은 연소득이 빈칸이라 입력 안내가 난다', () => {
    // Given 숫자 칸은 빈칸으로 열림
    // When
    const errors = getDsrErrors(DSR_DEFAULTS)
    // Then
    expect(errors.annualIncome).toBe('연소득을 입력해 주세요')
  })

  it('연소득이 비면 입력 안내를 보인다', () => {
    // Given 연소득 빈 칸
    // When
    const errors = getDsrErrors(makeDsr({ annualIncome: '' }))
    // Then
    expect(errors.annualIncome).toBe('연소득을 입력해 주세요')
  })

  it('연소득이 1만원 미만이면 범위 안내를 보인다', () => {
    // Given 연소득 0
    // When
    const errors = getDsrErrors(makeDsr({ annualIncome: 0 }))
    // Then
    expect(errors.annualIncome).toBe('연소득은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('대출금이 비면 그 줄에 입력 안내를 보인다', () => {
    // Given 첫 줄 대출금 빈 칸
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ amount: '' })] }))
    // Then
    expect(errors.loans[0].amount).toBe('대출금을 입력해 주세요')
  })

  it('대출금이 범위 밖이면 범위 안내를 보인다', () => {
    // Given 대출금 0
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ amount: 0 })] }))
    // Then
    expect(errors.loans[0].amount).toBe('대출금은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('금리가 비면 그 줄에 입력 안내를 보인다', () => {
    // Given 금리 빈 칸
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ rate: '' })] }))
    // Then
    expect(errors.loans[0].rate).toBe('금리를 입력해 주세요')
  })

  it('금리가 20%를 넘으면 범위 안내를 보인다', () => {
    // Given 금리 21%
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ rate: 21 })] }))
    // Then
    expect(errors.loans[0].rate).toBe('금리는 0% 이상 20% 이하로 입력해 주세요')
  })

  it('기간이 비면 그 줄에 입력 안내를 보인다', () => {
    // Given 기간 빈 칸
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ months: '' })] }))
    // Then
    expect(errors.loans[0].months).toBe('기간을 입력해 주세요')
  })

  it('기간이 601개월이면 범위 안내를 보인다', () => {
    // Given 기간 601개월
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ months: 601 })] }))
    // Then
    expect(errors.loans[0].months).toBe('기간은 1개월 이상 600개월 이하로 입력해 주세요')
  })

  it('기간 600개월은 오류가 아니다', () => {
    // Given 기간 600개월
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ months: 600 })] }))
    // Then
    expect(errors.loans).toBeUndefined()
  })

  it('기간이 소수이면 오류이다', () => {
    // Given 기간 2.5개월
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan({ months: 2.5 })] }))
    // Then
    expect(errors.loans[0].months).toBeDefined()
  })

  it('오류가 없는 줄은 빈 객체로 자리를 지킨다', () => {
    // Given 첫 줄은 정상, 둘째 줄은 대출금 빈 칸
    // When
    const errors = getDsrErrors(makeDsr({ loans: [makeLoan(), makeLoan({ amount: '' })] }))
    // Then
    expect(errors.loans[0]).toEqual({})
  })

  it('대출이 0건이면 건수 안내를 보인다', () => {
    // Given 대출 0건
    // When
    const errors = getDsrErrors(makeDsr({ loans: [] }))
    // Then
    expect(errors.loanCount).toBe('대출을 1건 이상 입력해 주세요')
  })

  it('대출 10건은 오류가 아니다', () => {
    // Given 대출 10건
    const loans = Array.from({ length: DSR_MAX_LOANS }, () => makeLoan())
    // When
    const errors = getDsrErrors(makeDsr({ loans }))
    // Then
    expect(errors.loanCount).toBeUndefined()
  })

  it('대출이 11건이면 최대 건수 안내를 보인다', () => {
    // Given 대출 11건
    const loans = Array.from({ length: DSR_MAX_LOANS + 1 }, () => makeLoan())
    // When
    const errors = getDsrErrors(makeDsr({ loans }))
    // Then
    expect(errors.loanCount).toBe('대출은 최대 10건까지 입력할 수 있어요')
  })
})

describe('getInitialDsr (넘어온 값 → DSR 입력칸 처음 값)', () => {
  const makeItem = (patch = {}) => ({
    loanKind: 'CREDIT',
    repayMethod: 'BULLET',
    loanAmount: 5000000,
    interestRate: 3,
    loanMonths: 24,
    ...patch,
  })

  it('넘어온 값이 없으면 기본값이다', () => {
    // Given 넘어온 값 없음
    // When
    const form = getInitialDsr(undefined)
    // Then
    expect(form).toEqual(DSR_DEFAULTS)
  })

  it('원 단위 연소득을 그대로 받는다', () => {
    // Given 연소득 7,000만원 (원 단위)
    // When
    const form = getInitialDsr({ annualIncome: 70000000 })
    // Then
    expect(form.annualIncome).toBe(70000000)
  })

  it('범위 밖 연소득은 기본값이다', () => {
    // Given 연소득 0원
    // When
    const form = getInitialDsr({ annualIncome: 0 })
    // Then
    expect(form.annualIncome).toBe(DSR_DEFAULTS.annualIncome)
  })

  it('넘어온 대출 한 줄을 입력칸 모양으로 받는다', () => {
    // Given 신용대출 만기일시 500만원, 3%, 24개월
    // When
    const form = getInitialDsr({ loans: [makeItem()] })
    // Then
    expect(form.loans[0]).toEqual({ kind: 'CREDIT', method: 'BULLET', amount: 5000000, rate: 3, months: 24 })
  })

  it('대출 순서를 그대로 받는다', () => {
    // Given 대출 2건 (신용대출, 주택담보대출)
    // When
    const form = getInitialDsr({ loans: [makeItem(), makeItem({ loanKind: 'MORTGAGE' })] })
    // Then
    expect(form.loans.map((loan) => loan.kind)).toEqual(['CREDIT', 'MORTGAGE'])
  })

  it('범위 밖 대출금은 그 칸만 처음 값이다', () => {
    // Given 대출금 0원
    // When
    const form = getInitialDsr({ loans: [makeItem({ loanAmount: 0 })] })
    // Then
    expect(form.loans[0].amount).toBe(DSR_LOAN_DEFAULT.amount)
  })

  it('한 칸이 범위 밖이어도 같은 줄의 다른 칸은 받는다', () => {
    // Given 대출금 0원, 금리 3%
    // When
    const form = getInitialDsr({ loans: [makeItem({ loanAmount: 0 })] })
    // Then
    expect(form.loans[0].rate).toBe(3)
  })

  it('모르는 대출 종류는 처음 값이다', () => {
    // Given 종류 ETC
    // When
    const form = getInitialDsr({ loans: [makeItem({ loanKind: 'ETC' })] })
    // Then
    expect(form.loans[0].kind).toBe(DSR_LOAN_DEFAULT.kind)
  })

  it('체증식은 처음 값이다', () => {
    // Given 상환 방식 체증식
    // When
    const form = getInitialDsr({ loans: [makeItem({ repayMethod: 'GRADUATED' })] })
    // Then
    expect(form.loans[0].method).toBe(DSR_LOAN_DEFAULT.method)
  })

  it('대출이 10건을 넘으면 앞의 10건만 받는다', () => {
    // Given 대출 12건
    const loans = Array.from({ length: 12 }, () => makeItem())
    // When
    const form = getInitialDsr({ loans })
    // Then
    expect(form.loans).toHaveLength(DSR_MAX_LOANS)
  })

  it('대출 목록이 배열이 아니면 기본 대출이다', () => {
    // Given loans가 문자열
    // When
    const form = getInitialDsr({ loans: 'x' })
    // Then
    expect(form.loans).toEqual(DSR_DEFAULTS.loans)
  })

  it('대출 목록이 비어 있으면 기본 대출이다', () => {
    // Given loans 빈 배열
    // When
    const form = getInitialDsr({ loans: [] })
    // Then
    expect(form.loans).toEqual(DSR_DEFAULTS.loans)
  })
})

describe('toDsrRecord (DSR 저장 본문, API-57)', () => {
  it('서버가 받는 4개 칸만 보낸다', () => {
    // Given 계산한 결과
    const form = makeDsr()
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect(Object.keys(record).sort()).toEqual(['annualIncome', 'dsrRate', 'yearlyPayment', 'loans'].sort())
  })

  it('대출 한 줄은 서버가 받는 5개 칸만 보낸다 (화면용 id는 뺀다)', () => {
    // Given 화면에서 id가 붙은 대출 한 줄
    const form = makeDsr({ loans: [{ ...makeLoan(), id: 1 }] })
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect(Object.keys(record.loans[0]).sort()).toEqual(
      ['loanKind', 'repayMethod', 'loanAmount', 'interestRate', 'loanMonths'].sort(),
    )
  })

  it('원 단위 입력을 그대로 보낸다', () => {
    // Given 연소득 5,000만원
    const form = makeDsr()
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect(record.annualIncome).toBe(50000000)
  })

  it('대출금도 원으로 바꿔 보낸다', () => {
    // Given 대출금 1,200만원
    const form = makeDsr()
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect(record.loans[0].loanAmount).toBe(12000000)
  })

  it('결과의 DSR과 1년 상환액을 그대로 보낸다', () => {
    // Given 1년 상환액 1,200만원, DSR 24%
    const form = makeDsr()
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect([record.dsrRate, record.yearlyPayment]).toEqual([24, 12000000])
  })

  it('대출은 입력한 건수만큼 입력 순서대로 보낸다', () => {
    // Given 대출 3건 (종류 순서: 신용, 주택담보, 기타)
    const form = makeDsr({
      loans: [makeLoan({ kind: 'CREDIT' }), makeLoan({ kind: 'MORTGAGE' }), makeLoan({ kind: 'OTHER' })],
    })
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect(record.loans.map((loan) => loan.loanKind)).toEqual(['CREDIT', 'MORTGAGE', 'OTHER'])
  })

  it('저장한 기록을 그대로 넘기면 같은 입력칸이 복원된다', () => {
    // Given 저장 본문(원 단위)을 MY [불러오기]가 그대로 넘기는 상황
    const form = makeDsr({
      annualIncome: 65000000,
      loans: [makeLoan({ kind: 'CREDIT', method: 'BULLET', amount: 30000000, rate: 5.5, months: 60 }), makeLoan({ method: 'EQUAL_PI', amount: 250000000, rate: 4.25, months: 360 })],
    })
    const record = toDsrRecord(form, getDsrResult(form))
    // When
    const loaded = getInitialDsr(record)
    // Then
    expect(loaded).toEqual(form)
  })
})

describe('금액 입력은 원 단위 (갈아타기, 내 집, 상환능력, DSR)', () => {
  it('갈아타기: 넘어온 남은 대출금은 만원으로 반올림하지 않고 원 그대로 받는다', () => {
    // Given 12,345,678원
    const state = { currentBalance: 12345678 }
    // When
    const form = getInitialChange(state)
    // Then
    expect(form.balance).toBe(12345678)
  })

  it('갈아타기: 남은 대출금이 9,999원이면 범위 안내를 돌려준다', () => {
    // Given 1만원 미만
    const form = makeForm({ balance: 9999 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.balance).toBe('남은 대출금은 1만원 이상 10억원 이하로 입력해 주세요')
  })

  it('갈아타기: 기타 비용 0원은 오류가 아니다', () => {
    // Given
    const form = makeForm({ etcCost: 0 })
    // When
    const errors = getChangeErrors(form)
    // Then
    expect(errors.etcCost).toBeUndefined()
  })

  it('갈아타기: 저장 본문의 남은 대출금은 입력한 원 그대로이다', () => {
    // Given 12,345,678원
    const form = makeForm({ balance: 12345678 })
    // When
    const record = toChangeRecord(form, getChangeResult(form))
    // Then
    expect(record.currentBalance).toBe(12345678)
  })

  it('내 집: 넘어온 집값은 원 그대로 받는다', () => {
    // Given 345,678,901원
    const state = { housePrice: 345678901 }
    // When
    const form = getInitialHome(state)
    // Then
    expect(form.housePrice).toBe(345678901)
  })

  it('내 집: 집값이 9,999원이면 범위 안내를 보인다', () => {
    // Given
    const errors = getHomeErrors(makeHome({ housePrice: 9999 }))
    // Then
    expect(errors.housePrice).toBe('집값은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('내 집: 다른 대출 잔액 0원은 오류가 아니다', () => {
    // Given
    const errors = getHomeErrors(makeHome({ otherLoans: [makeOther({ balance: 0 })] }))
    // Then
    expect(errors.otherLoans?.[0]?.balance).toBeUndefined()
  })

  it('내 집: 집값의 70%는 원 단위로 반올림해 계산한다', () => {
    // Given 집값 123,456,789원 x 70% = 86,419,752.3원
    const result = getHomeResult(makeHome({ housePrice: 123456789 }))
    // Then
    expect(result.ltvLimit).toBe(86419752)
  })

  it('상환능력: 넘어온 매달 갚을 돈은 원 그대로 받는다', () => {
    // Given 1,234,567원
    const form = getInitialReverse({ monthlyPayment: 1234567 })
    // Then
    expect(form.monthly).toBe(1234567)
  })

  it('상환능력: 매달 갚을 돈이 9,999원이면 범위 안내를 보인다', () => {
    // Given
    const errors = getReverseErrors(makeReverse({ monthly: 9999 }))
    // Then
    expect(errors.monthly).toBe('매달 갚을 돈은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('상환능력: 저장 본문의 매달 갚을 돈은 입력한 원 그대로이다', () => {
    // Given 1,234,567원
    const form = makeReverse({ monthly: 1234567 })
    // When
    const record = toReverseRecord(form, getReverseResult(form))
    // Then
    expect(record.monthlyPayment).toBe(1234567)
  })

  it('DSR: 넘어온 연소득과 대출금은 원 그대로 받는다', () => {
    // Given 연소득 45,678,901원, 대출금 123,456,789원
    const form = getInitialDsr({
      annualIncome: 45678901,
      loans: [{ loanKind: 'CREDIT', repayMethod: 'EQUAL_PI', loanAmount: 123456789, interestRate: 3, loanMonths: 24 }],
    })
    // Then
    expect([form.annualIncome, form.loans[0].amount]).toEqual([45678901, 123456789])
  })

  it('DSR: 연소득이 9,999원이면 범위 안내를 보인다', () => {
    // Given
    const errors = getDsrErrors(makeDsr({ annualIncome: 9999 }))
    // Then
    expect(errors.annualIncome).toBe('연소득은 1만원 이상 99억 9,999만원 이하로 입력해 주세요')
  })

  it('DSR: 저장 본문의 연소득과 대출금은 입력한 원 그대로이다', () => {
    // Given 연소득 45,678,901원, 대출금 12,345,678원
    const form = makeDsr({ annualIncome: 45678901, loans: [makeLoan({ amount: 12345678 })] })
    // When
    const record = toDsrRecord(form, getDsrResult(form))
    // Then
    expect([record.annualIncome, record.loans[0].loanAmount]).toEqual([45678901, 12345678])
  })
})

describe('처음 값(빈칸)으로 열었을 때 결과 계산', () => {
  it('집 살 때 대출한도는 멈추지 않고 null이다', () => {
    // Given 숫자 칸이 빈칸인 처음 값 (빈칸 + 스트레스 금리가 글자가 되어 화면이 멈추던 것)
    const form = getInitialHome()
    // When
    const result = getHomeResult(form)
    // Then
    expect(result).toBeNull()
  })

  it('갈아타기는 멈추지 않고 null이다', () => {
    // Given
    const form = getInitialChange()
    // When
    const result = getChangeResult(form)
    // Then
    expect(result).toBeNull()
  })

  it('DSR은 멈추지 않고 null이다', () => {
    // Given
    const form = getInitialDsr()
    // When
    const result = getDsrResult(form)
    // Then
    expect(result).toBeNull()
  })

  it('상환능력 기반 대출은 멈추지 않고 null이다', () => {
    // Given
    const form = getInitialReverse()
    // When
    const result = getReverseResult(form)
    // Then
    expect(result).toBeNull()
  })
})
