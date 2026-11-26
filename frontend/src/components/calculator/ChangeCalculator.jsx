import { useRef, useState } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useUiStore from '../../store/useUiStore'
import { Button, CalcFormStack, CalcKv, CalcLayout, CalcPanel, EmptyBox, FormField, SegmentedFull } from '../../styles/common'
import { formatMoney } from '../../utils/format'
import { getChangeErrors, getChangeResult, getInitialChange, toChangeRecord } from '../../utils/finance'
import { REPAY_METHODS } from '../../utils/loanMath'
import requireLogin from '../../utils/requireLogin'
import Disclaimer from '../common/Disclaimer'
import SummaryCards from '../common/SummaryCards'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'

// CA-08 대출 갈아타기 계산기 (SCR-07, /calc/change): 갈아탈 때 아끼는 돈 계산. 계산은 프론트에서 (utils/finance.js)
// 왼쪽 입력: 지금 대출 (상환 방식, 남은 대출금, 지금 금리, 남은 기간) → 갈아탈 대출 (상환 방식, 새 금리, 새 대출 기간) → 중도상환수수료, 기타 비용 → [계산하기] [결과 저장]
// 오른쪽 결과: 요약 3칸 (아끼는 돈 또는 더 내는 돈, 첫 달 납입액, 총 이자 = 갈아탄 뒤 기준) → 자세히 → 고지 (좁은 화면은 입력 아래)
// 계산 시점은 CA-02와 같다: 입력칸 값(form)과 결과에 쓰는 값(applied)을 나눠 들고, [계산하기]를 눌렀을 때만 form을 applied로 옮긴다.
//   입력을 바꾸고 안 눌렀으면 결과 위에 안내를 띄우고 [결과 저장]은 막음 (화면에 보이는 결과와 저장 값이 다르지 않게)
// 처음 값: MY 계산 기록 [불러오기]가 넘긴 navigate state가 있으면 그 값 (범위 밖 칸은 기본값, CA-01), 없으면 기본값 / 열자마자 처음 값으로 한 번 계산해 보여 줌
// [결과 저장] → 회원: 입력과 결과를 저장 (API-56, 요청 중 버튼 잠금 E5) / 비회원: 로그인 안내 창 (CM-17 '계산 기록 저장은 회원 전용이에요.')
const GroupTitle = styled.h3`
  color: var(--ink);
  font-size: var(--fs-base);
  font-weight: 800;
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const Actions = styled.div`
  display: flex;
  gap: 8px;
  & > button {
    flex: 1;
  }
`

const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
  scroll-margin-top: 76px; /* 계산하기 후 스크롤할 때 상단바에 가리지 않게 */
`

// 입력을 바꿨지만 아직 [계산하기]를 안 눌렀을 때 결과 위 안내
const StaleNotice = styled.p.attrs({ role: 'status' })`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const METHOD_OPTIONS = REPAY_METHODS.map((method) => ({ value: method.code, label: method.label }))

const money = (value) => formatMoney(value, '원')

// 결과 한 줄: 이자 차이와 수수료, 기타 비용을 합쳐 왜 이득인지, 손해인지
function getVerdictText(result) {
  const interestGap = result.currentInterest - result.newInterest
  const extra = result.prepayFee + result.etcCost
  const extraText = extra > 0 ? `수수료와 기타 비용 ${money(extra)}` : ''

  if (result.isGain) {
    const base = `이자가 ${money(interestGap)} 줄어`
    return extra > 0 ? `${base}, ${extraText}을 빼도 ${money(result.savingAmount)} 아껴요.` : `${base} ${money(result.savingAmount)} 아껴요.`
  }
  const interestText = interestGap >= 0 ? `이자는 ${money(interestGap)} 줄지만` : `이자가 ${money(-interestGap)} 늘고`
  const tail = `${money(-result.savingAmount)} 더 내요. 지금 대출을 유지하는 게 나아요.`
  return extra > 0 ? `${interestText} ${extraText}이 들어서 ${tail}` : `${interestText} ${tail}`
}

function ChangeCalculator() {
  const location = useLocation()
  // 저장에 성공하면 CalculatorPage 오른쪽 칸의 계산 기록을 다시 받게 함
  const { onSaved } = useOutletContext()
  const showToast = useUiStore((state) => state.showToast)
  // form: 입력칸 값 / applied: 결과에 쓰는 값 ([계산하기]를 누른 때의 form, 처음엔 처음 값)
  const [form, setForm] = useState(() => getInitialChange(location.state))
  const [applied, setApplied] = useState(() => getInitialChange(location.state))
  const [hasTried, setHasTried] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const resultRef = useRef(null)

  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // 입력 검사: [계산하기]를 한 번 눌러 본 뒤부터 칸마다 오류 문구를 보임
  const formErrors = getChangeErrors(form)
  const hasFormError = Object.keys(formErrors).length > 0
  const errors = hasTried ? formErrors : {}

  // 결과는 applied로만 계산 (applied는 검사를 통과한 값만 들어옴)
  const result = getChangeResult(applied)
  // 입력을 바꾼 뒤 아직 계산을 안 눌렀는지
  const isStale = JSON.stringify(form) !== JSON.stringify(applied)

  // [계산하기]: 검사 → 통과하면 입력칸 값으로 결과를 새로 계산. 결과가 입력 아래로 내려가는 좁은 화면에서는 결과 자리로 내려감
  const handleCalculate = () => {
    setHasTried(true)
    if (hasFormError) {
      showToast('입력한 값을 확인해 주세요')
      return
    }
    setApplied(form)
    // 입력과 결과가 세로 한 줄(CalcLayout 열이 1개)일 때만 결과 자리로 내려감. 배치가 화면 폭이 아니라 계산기 칸 폭으로 바뀌어서 열 수로 봄 (2026-11-26 사용자 요청)
    const resultEl = resultRef.current
    if (resultEl && getComputedStyle(resultEl.parentElement).gridTemplateColumns.split(' ').length === 1) {
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // [결과 저장] (API-56): 입력과 결과 값을 보냄 (화면과 서버 모두 원 단위)
  const saveResult = async () => {
    if (isSaving || !result) return
    setIsSaving(true)
    try {
      await myApi.postChangeCalc(toChangeRecord(applied, result))
      showToast('계산 결과를 저장했어요. MY의 계산 기록에서 다시 볼 수 있어요')
      onSaved?.()
    } catch (error) {
      const status = error.response?.status
      // 401(로그인 풀림)은 axiosInstance가 로그인 안내 창을 띄우므로 알림을 겹쳐 띄우지 않음 (E4)
      if (status === 401) return
      if (status === 400) showToast(error.response?.data?.message ?? '입력한 값을 확인해 주세요')
      else showToast('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = () => {
    if (isStale) {
      showToast('입력을 바꿨어요. [계산하기]를 먼저 눌러 주세요')
      return
    }
    if (!result) {
      showToast('입력한 값을 확인해 주세요')
      return
    }
    requireLogin(saveResult, '계산 기록 저장은 회원 전용이에요.')
  }

  let resultView
  if (!result) {
    resultView = <EmptyBox>이 조건으로는 계산할 수 없어요. 금리와 기간을 확인해 주세요.</EmptyBox>
  } else {
    const summaryItems = [
      {
        label: result.isGain ? '아끼는 돈' : '더 내는 돈',
        value: money(Math.abs(result.savingAmount)),
        tone: result.isGain ? 'hl' : 'bad',
        sub: result.isGain ? '갈아타는 게 이득' : '지금 대출 유지가 이득',
      },
      {
        label: '첫 달 납입액',
        value: money(result.newFirstPayment),
        sub: `갈아탄 뒤 기준 (지금 ${money(result.currentFirstPayment)})`,
      },
      {
        label: '총 이자',
        value: money(result.newInterest),
        sub: `갈아탄 뒤 기준 (지금 ${money(result.currentInterest)})`,
      },
    ]
    resultView = (
      <>
        <SummaryCards items={summaryItems} />
        <CalcKv>
          <dt>지금 대출 총 이자</dt>
          <dd>{money(result.currentInterest)}</dd>
          <dt>갈아탈 대출 총 이자</dt>
          <dd>{money(result.newInterest)}</dd>
          <dt>중도상환수수료</dt>
          <dd>{money(result.prepayFee)}</dd>
          <dt>기타 비용</dt>
          <dd>{money(result.etcCost)}</dd>
          <dt>결과</dt>
          <dd>{getVerdictText(result)}</dd>
        </CalcKv>
        <Disclaimer>
          남은 대출금 전액을 새 대출로 갈아탄다고 보고 계산해요. 실제 금리, 수수료, 비용은 금융기관마다 달라요.
        </Disclaimer>
      </>
    )
  }

  return (
    <CalcLayout>
      <CalcPanel>
        <CalcFormStack>
          <GroupTitle>지금 대출</GroupTitle>
          <FormField>
            <SegmentedFull>
              <Segmented
                options={METHOD_OPTIONS}
                value={form.currentMethod}
                onChange={(currentMethod) => handleChange({ currentMethod })}
                isOnPanel
                label="지금 대출 상환 방식"
              />
            </SegmentedFull>
          </FormField>
          <NumberField
            isLabelInside
            label="남은 대출금"
            unit="원"
            value={form.balance}
            onChange={(balance) => handleChange({ balance })}
            hasComma
            showReadable
            isRequired
            placeholder="예: 50,000,000"
            error={errors.balance}
          />
          <NumberField
            isLabelInside
            label="지금 금리"
            unit="%"
            decimals={2}
            value={form.currentRate}
            onChange={(currentRate) => handleChange({ currentRate })}
            isRequired
            placeholder="예: 5.5"
            error={errors.currentRate}
          />
          <NumberField
            isLabelInside
            label="남은 기간"
            unit="개월"
            value={form.currentMonths}
            onChange={(currentMonths) => handleChange({ currentMonths })}
            isRequired
            placeholder="예: 36"
            error={errors.currentMonths}
          />

          <GroupTitle>갈아탈 대출</GroupTitle>
          <FormField>
            <SegmentedFull>
              <Segmented
                options={METHOD_OPTIONS}
                value={form.newMethod}
                onChange={(newMethod) => handleChange({ newMethod })}
                isOnPanel
                label="갈아탈 대출 상환 방식"
              />
            </SegmentedFull>
          </FormField>
          <NumberField
            isLabelInside
            label="새 금리"
            unit="%"
            decimals={2}
            value={form.newRate}
            onChange={(newRate) => handleChange({ newRate })}
            isRequired
            placeholder="예: 4.5"
            error={errors.newRate}
          />
          <NumberField
            isLabelInside
            label="새 대출 기간"
            unit="개월"
            value={form.newMonths}
            onChange={(newMonths) => handleChange({ newMonths })}
            isRequired
            placeholder="예: 36"
            error={errors.newMonths}
          />

          <GroupTitle>갈아탈 때 드는 돈</GroupTitle>
          <FormField>
            <NumberField
              isLabelInside
              label="중도상환수수료"
              unit="%"
              decimals={2}
              value={form.feeRate}
              onChange={(feeRate) => handleChange({ feeRate })}
              placeholder="예: 1"
              error={errors.feeRate}
            />
            <Hint>수수료는 단순 계산이에요. 실제로는 기간이 지나면 줄거나 없어져요.</Hint>
          </FormField>
          <FormField>
            <NumberField
              isLabelInside
              label="기타 비용"
              unit="원"
              value={form.etcCost}
              onChange={(etcCost) => handleChange({ etcCost })}
              hasComma
              showReadable
              placeholder="예: 500,000"
              error={errors.etcCost}
            />
            <Hint>기타 비용은 인지세, 보증료처럼 새 대출 때 드는 돈이에요.</Hint>
          </FormField>

          <Actions>
            <Button onClick={handleCalculate}>
              <Icon name="calc" size={16} />
              계산하기
            </Button>
            <Button $variant="outline" disabled={isSaving} onClick={handleSave}>
              <Icon name="doc" size={16} />
              결과 저장
            </Button>
          </Actions>
        </CalcFormStack>
      </CalcPanel>

      <Result ref={resultRef}>
        {isStale && <StaleNotice>입력을 바꿨어요. [계산하기]를 누르면 결과가 새로 계산돼요.</StaleNotice>}
        {resultView}
      </Result>
    </CalcLayout>
  )
}

export default ChangeCalculator
