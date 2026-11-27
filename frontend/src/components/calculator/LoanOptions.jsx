import styled from 'styled-components'
import Checkbox from '../ui/Checkbox'
import NumberField from '../ui/NumberField'

// CA-03 옵션 입력: 거치 기간 / 중도상환(회차, 금액, 수수료율) / 금리 변동(회차, 변동 후 금리). 셋 다 체크하면 칸이 펼쳐짐 (거치 기간도 체크로 둔 것은 거치를 쓰지 않는 경우 칸이 늘지 않게. 해제하면 0개월)
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

// 체크박스 세 개를 가로로 (좁으면 줄바꿈, 가안 .opts)
const Checks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 2px;
`

const Fold = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--paper);
`

const Pair = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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
      <Checks>
        {form.method !== 'BULLET' && (
          <Checkbox
            label="거치 기간"
            checked={form.isGrace}
            onChange={(isGrace) => onChange(isGrace ? { isGrace } : { isGrace, graceMonths: 0 })}
          />
        )}
        <Checkbox label="중도상환" checked={form.isPrepay} onChange={(isPrepay) => onChange({ isPrepay })} />
        <Checkbox label="금리 변동" checked={form.isRateChange} onChange={(isRateChange) => onChange({ isRateChange })} />
      </Checks>
      {form.method === 'BULLET' && <Hint>만기일시는 매달 이자만 내서 거치 기간이 없어요.</Hint>}
      {form.method !== 'BULLET' && form.isGrace && (
        <Fold>
          <NumberField
            isLabelInside
            isCompact
            label="거치 기간"
            unit="개월"
            value={form.graceMonths}
            onChange={(graceMonths) => onChange({ graceMonths })}
            placeholder="예: 6"
            error={errors.graceMonths}
          />
          <Hint>거치 기간에는 이자만 내고, 끝난 뒤 남은 기간에 원금을 나눠 갚아요.</Hint>
        </Fold>
      )}
      {form.isPrepay && (
        <Fold>
          <Pair>
            <NumberField
              isLabelInside
              isCompact
              label="회차"
              unit="회차"
              value={form.prepayRound}
              onChange={(prepayRound) => onChange({ prepayRound })}
              placeholder="예: 12"
              error={errors.prepayRound}
            />
            <NumberField
              isLabelInside
              isCompact
              label="금액"
              unit="만원"
              isManwon
              value={form.prepayAmount}
              onChange={(prepayAmount) => onChange({ prepayAmount })}
              hasComma
              showReadable
              placeholder="예: 300"
              error={errors.prepayAmount}
            />
          </Pair>
          <NumberField
            isLabelInside
            isCompact
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

      {form.isRateChange && (
        <Fold>
          <Pair>
            <NumberField
              isLabelInside
              isCompact
              label="변동 회차"
              unit="회차"
              value={form.changeRound}
              onChange={(changeRound) => onChange({ changeRound })}
              placeholder="0"
              error={errors.changeRound}
            />
            <NumberField
              isLabelInside
              isCompact
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
