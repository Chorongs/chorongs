import styled from 'styled-components'
import Checkbox from '../ui/Checkbox'
import NumberField from '../ui/NumberField'

// CA-03 옵션 입력: 거치 기간 / 중도상환(회차, 금액, 수수료율) / 금리 변동(회차, 변동 후 금리). 체크하면 칸이 펼쳐짐
// 값은 부모(LoanCalculator)가 들고 있고, 바꾸면 onChange({ 바뀐 칸 })로 알린다 (상태 값: 부모 값)
// 오류 문구(errors)도 부모가 getCalcErrors로 검사해서 내려준다 (E2): 회차는 1~대출 기간, 중도상환액은 그때 남은 원금 이하
// - 만기일시는 매달 이자만 내서 거치 기간 칸이 없다
// - 중도상환은 회차와 금액을 둘 다 비워 두면 아직 안 정한 것으로 보고 계산에 안 넣는다
// - 변동 회차가 0이면 금리 변동을 적용하지 않는다
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Fold = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--paper);
`

const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

function LoanOptions({ form, errors, onChange }) {
  return (
    <Wrap>
      {form.method === 'BULLET' ? (
        <Hint>만기일시는 매달 이자만 내서 거치 기간이 없어요.</Hint>
      ) : (
        <NumberField
          label="거치 기간"
          unit="개월"
          value={form.graceMonths}
          onChange={(graceMonths) => onChange({ graceMonths })}
          placeholder="0"
          error={errors.graceMonths}
        />
      )}

      <Checkbox label="중도상환" checked={form.isPrepay} onChange={(isPrepay) => onChange({ isPrepay })} />
      {form.isPrepay && (
        <Fold>
          <Pair>
            <NumberField
              label="회차"
              unit="회차"
              value={form.prepayRound}
              onChange={(prepayRound) => onChange({ prepayRound })}
              placeholder="예: 12"
              error={errors.prepayRound}
            />
            <NumberField
              label="금액"
              unit="만원"
              value={form.prepayAmount}
              onChange={(prepayAmount) => onChange({ prepayAmount })}
              hasComma
              placeholder="예: 300"
              error={errors.prepayAmount}
            />
          </Pair>
          <NumberField
            label="수수료율"
            unit="%"
            decimals={2}
            value={form.prepayFee}
            onChange={(prepayFee) => onChange({ prepayFee })}
            placeholder="0"
            error={errors.prepayFee}
          />
          <Hint>회차와 금액을 비워 두면 중도상환 없이 계산해요.</Hint>
        </Fold>
      )}

      <Checkbox label="금리 변동" checked={form.isRateChange} onChange={(isRateChange) => onChange({ isRateChange })} />
      {form.isRateChange && (
        <Fold>
          <Pair>
            <NumberField
              label="변동 회차"
              unit="회차"
              value={form.changeRound}
              onChange={(changeRound) => onChange({ changeRound })}
              placeholder="0"
              error={errors.changeRound}
            />
            <NumberField
              label="변동 후 금리"
              unit="%"
              decimals={2}
              value={form.changeRate}
              onChange={(changeRate) => onChange({ changeRate })}
              placeholder="예: 7.5"
              error={errors.changeRate}
            />
          </Pair>
          <Hint>변동 회차가 0이면 금리 변동 없이 계산해요.</Hint>
        </Fold>
      )}
    </Wrap>
  )
}

export default LoanOptions
