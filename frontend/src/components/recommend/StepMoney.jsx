import styled from 'styled-components'
import {
  MONTHS_UNKNOWN,
  PURPOSE_OPTIONS,
  QUICK_AMOUNT_OPTIONS,
} from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import { InlineError } from '../../styles/common'
import { getMonthsOptions, isValidMonths } from '../../utils/validate'
import ChipGroup from '../ui/ChipGroup'
import NumberField from '../ui/NumberField'

// 용도 칩: 칩 글자가 그대로 서버로 가는 값
const PURPOSE_CHIP_OPTIONS = PURPOSE_OPTIONS.map((purpose) => ({ value: purpose, label: purpose }))

// '기타' 용도를 고르면 보이는 안내 (명세서 문구)
const OTHER_PURPOSE = '기타'
const OTHER_PURPOSE_NOTICE = '생활비 상품과 용도가 기타인 상품을 보여 드려요'

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Label = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

const Notice = styled.p`
  margin: 0;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--mist-2);
  color: var(--ink-2);
  font-size: var(--fs-md);
`

/*
    RC-05 2단계 필요한 돈
    - props: error ({ field, message } 또는 null, 부른 쪽에서 [다음] 검사에 걸린 칸)
    - 용도가 바뀌면 기간 선택지가 바뀌고, 고른 기간이 새 선택지에 없으면 비움
    - TODO(RC-05): 용도에 따라 바뀌는 '아래 팁' 문구 (명세서에 문구 없음)
*/
function StepMoney({ error }) {
  const input = useRecommendStore((state) => state.input)
  const setInput = useRecommendStore((state) => state.setInput)

  const errorOf = (field) => (error?.field === field ? error.message : '')

  const monthsOptions = [
    ...getMonthsOptions(input.purpose).map((months) => ({ value: months, label: `${months}개월` })),
    { value: MONTHS_UNKNOWN, label: '잘 모르겠어요' },
  ]

  const handlePurposeChange = (purpose) => {
    // 고른 기간이 새 용도의 선택지에 없으면 비움
    const months = isValidMonths(purpose, input.months) ? input.months : null
    setInput({ purpose, months })
  }

  return (
    <Wrap>
      <Field data-field="purpose">
        <Label>자금 용도</Label>
        <ChipGroup
          label="자금 용도"
          options={PURPOSE_CHIP_OPTIONS}
          value={input.purpose}
          onChange={handlePurposeChange}
        />
        {input.purpose === OTHER_PURPOSE && <Notice>{OTHER_PURPOSE_NOTICE}</Notice>}
        <InlineError>{errorOf('purpose')}</InlineError>
      </Field>

      <Field data-field="need">
        <NumberField
          label="필요한 금액"
          unit="만원"
          min={10}
          max={100000}
          hasComma
          quickValues={QUICK_AMOUNT_OPTIONS}
          value={input.need ?? ''}
          onChange={(need) => setInput({ need: need === '' ? null : need })}
          error={errorOf('need')}
        />
      </Field>

      <Field data-field="months">
        <Label>갚을 기간</Label>
        <ChipGroup
          label="갚을 기간"
          options={monthsOptions}
          value={input.months}
          onChange={(months) => setInput({ months })}
        />
        <InlineError>{errorOf('months')}</InlineError>
      </Field>
    </Wrap>
  )
}

export default StepMoney
