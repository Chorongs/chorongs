import { useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, FormField, FormLabel, FormStack, Panel, SegmentedFull } from '../../styles/common'
import { formatMoney } from '../../utils/format'
import {
  HOME_FIRST,
  HOME_METHODS,
  HOME_REGIONS,
  getHomeErrors,
  getHomeResult,
  getInitialHome,
  toHomeRecord,
} from '../../utils/finance'
import requireLogin from '../../utils/requireLogin'
import Checkbox from '../ui/Checkbox'
import Disclaimer from '../common/Disclaimer'
import SummaryCards from '../common/SummaryCards'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'

// CA-11 내 집 대출한도 계산기 (SCR-25, /calc/home): 집 살 때 최대 대출 한도. 계산은 프론트에서 (utils/finance.js)
// 왼쪽 입력: 집값, 집이 있는 곳, 생애 첫 집 구입, 연소득, 다른 대출 1년 이자, 주택담보대출 금리, 대출 기간, 상환 방식 → [계산하기] [결과 저장]
// 오른쪽 결과: 요약 3칸 (최대 대출 한도, 집값 기준 LTV, 소득 기준 DTI) → 고지 (좁은 화면은 입력 아래)
// 계산 시점은 CA-02와 같다: 입력칸 값(form)과 결과에 쓰는 값(applied)을 나눠 들고, [계산하기]를 눌렀을 때만 form을 applied로 옮긴다.
//   입력을 바꾸고 안 눌렀으면 결과 위에 안내를 띄우고 [결과 저장]은 막음 (화면에 보이는 결과와 저장 값이 다르지 않게)
// 처음 값: MY 계산 기록 [불러오기]가 넘긴 navigate state가 있으면 그 값 (범위 밖 칸은 기본값, CA-01), 없으면 기본값 / 열자마자 처음 값으로 한 번 계산해 보여 줌
// [결과 저장] → 회원: 입력과 결과를 저장 (API-59, 요청 중 버튼 잠금 E5) / 비회원: 로그인 안내 창 (CM-17 '계산 기록 저장은 회원 전용이에요.')
const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
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

const REGION_OPTIONS = HOME_REGIONS.map((region) => ({ value: region.code, label: region.label }))
const METHOD_OPTIONS = HOME_METHODS.map((method) => ({ value: method.code, label: method.label }))

const money = (value) => formatMoney(value, '원')

function HomeLimitCalculator() {
  const location = useLocation()
  const showToast = useUiStore((state) => state.showToast)
  // form: 입력칸 값 / applied: 결과에 쓰는 값 ([계산하기]를 누른 때의 form, 처음엔 처음 값)
  const [form, setForm] = useState(() => getInitialHome(location.state))
  const [applied, setApplied] = useState(() => getInitialHome(location.state))
  const [hasTried, setHasTried] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const resultRef = useRef(null)

  const handleChange = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // 입력 검사: [계산하기]를 한 번 눌러 본 뒤부터 칸마다 오류 문구를 보임
  const formErrors = getHomeErrors(form)
  const hasFormError = Object.keys(formErrors).length > 0
  const errors = hasTried ? formErrors : {}

  // 결과는 applied로만 계산 (applied는 검사를 통과한 값만 들어옴)
  const result = getHomeResult(applied)
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
    if (window.matchMedia('(max-width: 899px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // [결과 저장] (API-59): 입력과 결과 값을 보냄 (화면은 만원, 서버는 원)
  const saveResult = async () => {
    if (isSaving || !result) return
    setIsSaving(true)
    try {
      await myApi.postHomeCalc(toHomeRecord(applied, result))
      showToast('계산 결과를 저장했어요. MY의 계산 기록에서 다시 볼 수 있어요')
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
        label: '최대 대출 한도',
        value: money(result.maxLoan),
        tone: 'hl',
        sub: result.isLtvLower ? '집값 기준이 더 작아서 이 금액이에요' : '소득 기준이 더 작아서 이 금액이에요',
      },
      {
        label: '집값 기준 (LTV)',
        value: money(result.ltvLimit),
        sub: `집값의 ${result.ltvRate}%${applied.isFirstHome ? ` (생애 첫 집은 최대 ${money(HOME_FIRST.maxLoanMan * 10000)})` : ''}`,
      },
      {
        label: '소득 기준 (DTI)',
        value: money(result.dtiLimit),
        sub:
          result.dtiLimit === 0
            ? '다른 대출 이자가 커서 더 빌릴 수 없어요'
            : `연소득의 ${result.dtiRate}%에서 다른 대출 이자를 뺀 돈 기준`,
      },
    ]
    resultView = (
      <>
        <SummaryCards items={summaryItems} />
        <Disclaimer>
          실제 한도는 DSR 규제, 지역별 대출 상한, 은행 심사에 따라 더 작을 수 있어요. 지역별 LTV, DTI 비율은 예시 값이에요.
        </Disclaimer>
      </>
    )
  }

  return (
    <Layout>
      <Panel>
        <FormStack>
          <NumberField
            label="집값"
            unit="만원"
            value={form.housePrice}
            onChange={(housePrice) => handleChange({ housePrice })}
            hasComma
            isRequired
            placeholder="예: 50,000"
            error={errors.housePrice}
          />
          <FormField>
            <FormLabel>집이 있는 곳</FormLabel>
            <SegmentedFull>
              <Segmented
                options={REGION_OPTIONS}
                value={form.region}
                onChange={(region) => handleChange({ region })}
                isOnPanel
                label="집이 있는 곳"
              />
            </SegmentedFull>
          </FormField>
          <Checkbox
            checked={form.isFirstHome}
            onChange={(isFirstHome) => handleChange({ isFirstHome })}
            label="생애 첫 집 구입"
            description="처음 집을 사면 집값 기준 한도를 더 넉넉하게 봐요."
          />
          <NumberField
            label="연소득"
            unit="만원"
            value={form.annualIncome}
            onChange={(annualIncome) => handleChange({ annualIncome })}
            hasComma
            isRequired
            placeholder="예: 6,000"
            error={errors.annualIncome}
          />
          <NumberField
            label="다른 대출 1년 이자"
            unit="만원"
            value={form.otherInterest}
            onChange={(otherInterest) => handleChange({ otherInterest })}
            hasComma
            placeholder="예: 200"
            error={errors.otherInterest}
          />
          <NumberField
            label="주택담보대출 금리"
            unit="%"
            decimals={2}
            value={form.rate}
            onChange={(rate) => handleChange({ rate })}
            isRequired
            placeholder="예: 4.5"
            error={errors.rate}
          />
          <NumberField
            label="대출 기간"
            unit="년"
            value={form.years}
            onChange={(years) => handleChange({ years })}
            isRequired
            placeholder="예: 30"
            error={errors.years}
          />
          <FormField>
            <FormLabel>상환 방식</FormLabel>
            <SegmentedFull>
              <Segmented
                options={METHOD_OPTIONS}
                value={form.method}
                onChange={(method) => handleChange({ method })}
                isOnPanel
                label="상환 방식"
              />
            </SegmentedFull>
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
        </FormStack>
      </Panel>

      <Result ref={resultRef}>
        {isStale && <StaleNotice>입력을 바꿨어요. [계산하기]를 누르면 결과가 새로 계산돼요.</StaleNotice>}
        {resultView}
      </Result>
    </Layout>
  )
}

export default HomeLimitCalculator
