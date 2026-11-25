import styled from 'styled-components'
import { InputField } from '../../styles/common'
import { formatBirthInput } from '../../utils/format'
import { BIRTH_ERROR, BIRTH_GUIDE, getBirthInputState } from '../../utils/validate'

// 생년월일 칸 (가입 단계 AU-03, MY 회원 정보 MY-11이 같이 씀)
// 칸에는 숫자만 보임 (8자리, 휴대폰은 숫자 키패드, 붙여 넣은 '1994.04.29'도 숫자만 남김. 붙여 넣기가 잘리지 않게 칸은 10자까지 받음)
// value, onChange(글): 'YYYY-MM-DD' 모양의 글 (덜 쳤으면 '1994-04'처럼 짧음, formatBirthInput). 맞는 날짜인지는 부르는 쪽도 isValidBirthDate로 봄
// 칸 아래 한 줄은 치는 동안 바로 바뀜 (getBirthInputState):
//   비었거나 치는 중이고 틀린 곳 없음 → 회색 안내 BIRTH_GUIDE / 틀림 또는 forceError → 빨간 BIRTH_ERROR
//   / 맞음 → doneText가 있으면 초록 글 (가입 단계 '생년월일 입력 완료'), 없으면 안 그림
// forceError: 눌렀는데 비었거나 덜 침, 서버가 거절함처럼 부르는 쪽이 오류로 보일 때 / children: 칸 아래 덧붙일 글

// $tone: info 안내 / bad 오류 / good 입력 완료
const TONE_COLOR = { info: 'var(--cocoa)', bad: 'var(--bad)', good: 'var(--good)' }

const Message = styled.span`
  color: ${({ $tone }) => TONE_COLOR[$tone]};
  font-size: var(--fs-sm);
  font-weight: 600;
`

function BirthDateField({ value, onChange, forceError = false, doneText = '', children }) {
  const inputState = getBirthInputState(value)
  const isError = forceError || inputState === 'bad'
  let message = { tone: 'info', text: BIRTH_GUIDE }
  if (isError) message = { tone: 'bad', text: BIRTH_ERROR }
  else if (inputState === 'ok') message = doneText ? { tone: 'good', text: doneText } : null

  return (
    <InputField>
      생년월일
      <input
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="예) 19940429"
        maxLength={10}
        value={value.replace(/\D/g, '')}
        aria-invalid={isError}
        onChange={(event) => onChange(formatBirthInput(event.target.value))}
      />
      {message && (
        <Message $tone={message.tone} role={isError ? 'alert' : undefined}>
          {message.text}
        </Message>
      )}
      {children}
    </InputField>
  )
}

export default BirthDateField
