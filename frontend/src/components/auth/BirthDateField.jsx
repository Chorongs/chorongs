import styled from 'styled-components'
import { formatBirthInput } from '../../utils/format'

// 생년월일 칸 (가입 단계 AU-03, MY 회원 정보 MY-11이 같이 씀)
// 숫자 8자리를 치면 'YYYY-MM-DD'로 이어 보여 줌 (휴대폰은 숫자 키패드, 붙여 넣은 '1990.01.01'도 같은 모양으로)
// value, onChange(글): 'YYYY-MM-DD' 모양의 글 (덜 쳤으면 '1990-01'처럼 짧음). 맞는 날짜인지는 부르는 쪽이 isValidBirthDate로 봄
// onBlur: 칸을 떠날 때 (덜 친 날짜를 그때 오류로 보이게) / isInvalid: 칸을 오류로 표시 / children: 칸 아래 안내, 오류 글
const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-md);
  font-weight: 600;
  input {
    height: 52px;
    padding: 0 16px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-sm);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--fs-lg);
    @media (max-width: 899px) {
      height: 48px;
    }
  }
`

function BirthDateField({ value, onChange, onBlur, isInvalid = false, children }) {
  return (
    <Field>
      생년월일
      <input
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="예) 19900101"
        maxLength={10}
        value={value}
        aria-invalid={isInvalid}
        onChange={(event) => onChange(formatBirthInput(event.target.value))}
        onBlur={onBlur}
      />
      {children}
    </Field>
  )
}

export default BirthDateField
