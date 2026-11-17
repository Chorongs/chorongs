import styled from 'styled-components'
import {
  HOUSING_PURPOSES,
  MONTHS_DEFAULT,
  MONTHS_DEFAULT_HOUSING,
  MONTHS_UNKNOWN,
  PURPOSE_OPTIONS,
  QUICK_AMOUNT_OPTIONS,
} from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import {
  ChipGrid,
  FormField,
  FormLabel,
  FormLabelNote,
  FormStack,
  InlineError,
  SegmentedFull,
} from '../../styles/common'
import { getMonthsOptions, isValidMonths } from '../../utils/validate'
import ChipGroup from '../ui/ChipGroup'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'

// 용도 칩: 서버로 가는 값은 그대로(PURPOSE_OPTIONS), 화면 글자와 순서만 가안 기준
const PURPOSE_CHIP_LABEL = { 전월세: '전월세 보증금', 대환: '대출 갈아타기' }
const PURPOSE_CHIP_ORDER = ['생활비', '학자금', '전월세', '대환', '창업', '사업 운영', '주택 구입', '기타']
const PURPOSE_CHIP_OPTIONS = PURPOSE_CHIP_ORDER.filter((purpose) =>
  PURPOSE_OPTIONS.includes(purpose),
).map((purpose) => ({ value: purpose, label: PURPOSE_CHIP_LABEL[purpose] ?? purpose }))

const OTHER_PURPOSE = '기타'

// 용도에 따라 바뀌는 맨 아래 팁 (가안 문구). 없는 용도는 기본 문구
const DEFAULT_TIP = '기간이 길면 월 부담은 줄지만 총이자는 늘어요.'
const PURPOSE_TIP = {
  [OTHER_PURPOSE]: '생활비 상품과 용도가 기타인 상품을 보여 드려요.',
  '주택 구입':
    '주택 구입 자금은 집값과 소득에 따라 한도가 정해져요(LTV · DSR). 정부 지원 구입자금 상품부터 확인해 보세요.',
  대환: '갈아타기 전에 지금 대출의 중도상환수수료부터 확인해 보세요. 아낀 이자보다 수수료가 크면 손해예요.',
}

// 기간 선택 글자: 12개월 단위는 'N년 이내', 0은 '모르겠어요' (가안)
const getMonthsLabel = (months) => (months === MONTHS_UNKNOWN ? '모르겠어요' : `${months / 12}년 이내`)

// 맨 아래 팁: 용도에 따라 글이 바뀜 (좁은 화면에서는 숨김. 단 '기타' 안내는 명세서 문구라 계속 보임)
const Tip = styled.p`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: auto 0 0;
  padding-top: 4px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;

  & [data-icon] {
    margin-top: 2px;
    color: var(--muted);
  }

  @media (max-width: 899px) {
    display: ${({ $isAlwaysShown }) => ($isAlwaysShown ? 'flex' : 'none')};
  }
`

/*
    RC-05 2단계 필요한 돈
    - props: error ({ field, message } 또는 null, 부른 쪽에서 [다음] 검사에 걸린 칸)
    - 용도가 바뀌면 기간 선택지가 바뀌고, 고른 기간이 새 선택지에 없으면 그 용도의 기본 기간(전월세, 주택 구입 120, 그 밖 36)으로
    - 맨 아래 팁은 용도에 따라 바뀜 (문구는 가안 cashlink_21.html 기준: 기본, 기타, 주택 구입, 대환)
*/
function StepMoney({ error }) {
  const input = useRecommendStore((state) => state.input)
  const setInput = useRecommendStore((state) => state.setInput)

  const errorOf = (field) => (error?.field === field ? error.message : '')

  const monthsOptions = [
    ...getMonthsOptions(input.purpose),
    MONTHS_UNKNOWN,
  ].map((months) => ({ value: months, label: getMonthsLabel(months) }))

  const handlePurposeChange = (purpose) => {
    // 고른 기간이 새 용도의 선택지에 없으면 그 용도의 기본 기간으로 (가안 기준)
    const defaultMonths = HOUSING_PURPOSES.includes(purpose) ? MONTHS_DEFAULT_HOUSING : MONTHS_DEFAULT
    const months = isValidMonths(purpose, input.months) ? input.months : defaultMonths
    setInput({ purpose, months })
  }

  return (
    <FormStack>
      <FormField data-field="purpose">
        <FormLabel>어디에 쓰나요</FormLabel>
        <ChipGrid>
          <ChipGroup
            label="자금 용도"
            options={PURPOSE_CHIP_OPTIONS}
            value={input.purpose}
            onChange={handlePurposeChange}
          />
        </ChipGrid>
        <InlineError>{errorOf('purpose')}</InlineError>
      </FormField>

      <FormField data-field="need">
        <NumberField
          label={
            <>
              얼마나 필요한가요<FormLabelNote>10만원 ~ 10억원</FormLabelNote>
            </>
          }
          unit="만원"
          placeholder="0"
          min={10}
          max={100000}
          hasComma
          quickValues={QUICK_AMOUNT_OPTIONS}
          value={input.need ?? ''}
          onChange={(need) => setInput({ need: need === '' ? null : need })}
          error={errorOf('need')}
        />
      </FormField>

      <FormField data-field="months">
        <FormLabel>언제까지 갚을 계획인가요</FormLabel>
        <SegmentedFull>
          <Segmented
            label="갚을 기간"
            isOnPanel
            options={monthsOptions}
            value={input.months}
            onChange={(months) => setInput({ months })}
          />
        </SegmentedFull>
        <InlineError>{errorOf('months')}</InlineError>
      </FormField>

      <Tip $isAlwaysShown={input.purpose === OTHER_PURPOSE}>
        <Icon name="bulb" size={16} />
        {PURPOSE_TIP[input.purpose] ?? DEFAULT_TIP}
      </Tip>
    </FormStack>
  )
}

export default StepMoney
