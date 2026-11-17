import styled from 'styled-components'
import { AGE_GROUP_OPTIONS, JOB_OPTIONS, REGION_OPTIONS } from '../../constants/options'
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
import ChipGroup from '../ui/ChipGroup'
import Icon from '../ui/Icon'
import NumberField from '../ui/NumberField'
import Segmented from '../ui/Segmented'
import SelectField from '../ui/SelectField'

// 사는 지역 드롭다운: 첫 칸 '선택 안 함'은 값 null (화면에서는 빈 글자로 다룸)
const REGION_SELECT_OPTIONS = [
  { value: '', label: '선택 안 함' },
  ...REGION_OPTIONS.map((region) => ({ value: region, label: region })),
]

// 매달 갚는 대출: '대출 없어요'는 0, '잘 모르겠어요'는 debtUnknown true
const DEBT_NONE = 'NONE'
const DEBT_UNKNOWN = 'UNKNOWN'
const DEBT_OPTIONS = [
  { value: DEBT_NONE, label: '대출 없어요' },
  { value: DEBT_UNKNOWN, label: '잘 모르겠어요' },
]

const Hint = styled.p`
  margin: 0;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

// 맨 아래 안내 (좁은 화면에서는 숨김)
const Note = styled.p`
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
    display: none;
  }
`

/*
    RC-04 1단계 나에 대해
    - props: error ({ field, message } 또는 null, 부른 쪽에서 [다음] 검사에 걸린 칸)
    - 각 칸의 data-field는 걸렸을 때 그 칸에 커서를 옮기는 데 쓰임 (RecommendStepper)
    - 나이, 지역은 상품 조건 확인에만 쓰고 서버, DB에 저장하지 않음 (탭 안 sessionStorage에만: ST-03)
    - 칸 이름과 안내 글은 가안(cashlink_21.html) 기준
*/
function StepAboutMe({ error }) {
  const input = useRecommendStore((state) => state.input)
  const setInput = useRecommendStore((state) => state.setInput)

  const errorOf = (field) => (error?.field === field ? error.message : '')

  let debtChoice = null
  if (input.debtUnknown) debtChoice = DEBT_UNKNOWN
  else if (input.debtMonthly === 0) debtChoice = DEBT_NONE

  const handleDebtChoice = (choice) => {
    if (choice === DEBT_UNKNOWN) setInput({ debtMonthly: null, debtUnknown: true })
    else setInput({ debtMonthly: 0, debtUnknown: false })
  }

  const handleDebtChange = (number) => {
    setInput({ debtMonthly: number === '' ? null : number, debtUnknown: false })
  }

  return (
    <FormStack>
      <FormField data-field="job">
        <FormLabel>지금 나는</FormLabel>
        <ChipGrid>
          <ChipGroup
            label="직업"
            options={JOB_OPTIONS}
            value={input.job}
            onChange={(job) => setInput({ job })}
          />
        </ChipGrid>
        <InlineError>{errorOf('job')}</InlineError>
      </FormField>

      <FormField data-field="ageGroup">
        <FormLabel>
          나이<FormLabelNote>청년 상품 확인에만 써요</FormLabelNote>
        </FormLabel>
        <SegmentedFull>
          <Segmented
            label="나이"
            isOnPanel
            options={AGE_GROUP_OPTIONS}
            value={input.ageGroup}
            onChange={(ageGroup) => setInput({ ageGroup })}
          />
        </SegmentedFull>
        <InlineError>{errorOf('ageGroup')}</InlineError>
      </FormField>

      <FormField data-field="region">
        <SelectField
          label={
            <>
              사는 지역<FormLabelNote>지역 상품 확인에만 써요</FormLabelNote>
            </>
          }
          options={REGION_SELECT_OPTIONS}
          value={input.region ?? ''}
          onChange={(region) => setInput({ region: region === '' ? null : region })}
        />
      </FormField>

      <FormField data-field="income">
        <NumberField
          label={
            <>
              연소득<FormLabelNote>세전, 없으면 0</FormLabelNote>
            </>
          }
          unit="만원"
          placeholder="0"
          min={0}
          max={99999}
          hasComma
          value={input.income ?? ''}
          onChange={(income) => setInput({ income: income === '' ? null : income })}
          error={errorOf('income')}
        />
      </FormField>

      <FormField data-field="debt">
        <NumberField
          label={
            <>
              현재 갚고 있는 대출<FormLabelNote>매달 내는 금액</FormLabelNote>
            </>
          }
          unit="만원/월"
          placeholder="0"
          min={0}
          max={99999}
          hasComma
          value={input.debtMonthly ?? ''}
          onChange={handleDebtChange}
          error={errorOf('debt')}
        />
        <ChipGroup
          label="매달 갚는 대출 바로 고르기"
          size="sm"
          options={DEBT_OPTIONS}
          value={debtChoice}
          onChange={handleDebtChoice}
        />
        <Hint>여러 개면 합쳐서, 대략적인 금액도 괜찮아요.</Hint>
      </FormField>

      <Note>
        <Icon name="shield" size={16} />
        입력값은 이 탭에만 잠시 두고 저장하지 않아요. 탭을 닫거나 로그아웃하면 지워져요.
      </Note>
    </FormStack>
  )
}

export default StepAboutMe
