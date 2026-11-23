import styled from 'styled-components'
import { formatMoney } from '../../utils/format'
import HBar from '../chart/HBar'
import SectionHeader from '../common/SectionHeader'

// CA-06 방식별 총이자: 같은 입력으로 상환 방식 4개의 총이자를 가로 막대 4줄로 (CH-02 HBar), 지금 방식은 주황 강조
// interests: getMethodInterests 결과 [{ code, label, totalInterest }] (계산이 안 되는 방식은 totalInterest가 null이라 '계산 불가') / currentMethod: 지금 고른 방식 코드
const Bars = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

function MethodCompare({ interests, currentMethod }) {
  const max = Math.max(0, ...interests.map((item) => item.totalInterest ?? 0))

  return (
    <section>
      <SectionHeader title="방식별 총이자" description="지금 입력한 값을 상환 방식만 바꿔 계산했어요." />
      <Bars>
        {interests.map((item) => (
          <HBar
            key={item.code}
            label={item.label}
            value={item.totalInterest ?? 0}
            max={max}
            valueText={item.totalInterest === null ? '계산 불가' : formatMoney(item.totalInterest, '원')}
            isActive={item.code === currentMethod}
          />
        ))}
      </Bars>
    </section>
  )
}

export default MethodCompare
