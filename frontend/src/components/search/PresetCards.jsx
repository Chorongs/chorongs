import styled from 'styled-components'
import { KEYWORD_PRESETS } from '../../constants/options'

// SR-08 자주 쓰는 조합: 카드 5개 (이름 + 키워드 요약). 누르면 그 조합으로 키워드를 바꿈 (바꾸는 일은 부르는 쪽이 함)
// 지금 고른 키워드와 같으면 눌림 표시. 조합은 constants/options.js (정해진 키워드 안에서만)
// props: keywords 지금 고른 키워드 목록 / onSelect(키워드 목록)
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  @media (max-width: 899px) {
    flex-wrap: nowrap;
    margin: 0 -20px;
    padding: 0 20px 2px;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
`

const Card = styled.button.attrs({ type: 'button' })`
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--paper);
  text-align: left;
  cursor: pointer;
  &:hover {
    border-color: var(--cocoa);
  }
  &[aria-pressed='true'] {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
`

const Name = styled.b`
  font-size: var(--fs-md);
  font-weight: 800;
  ${Card}[aria-pressed='true'] & {
    color: var(--brand-text);
  }
`

const Summary = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-xs);
`

function PresetCards({ keywords = [], onSelect }) {
  const isSame = (list) => list.length === keywords.length && list.every((keyword) => keywords.includes(keyword))

  return (
    <Wrap role="group" aria-label="자주 쓰는 조합">
      {KEYWORD_PRESETS.map((preset) => (
        <Card key={preset.name} aria-pressed={isSame(preset.keywords)} onClick={() => onSelect(preset.keywords)}>
          <Name>{preset.name}</Name>
          <Summary>{preset.summary}</Summary>
        </Card>
      ))}
    </Wrap>
  )
}

export default PresetCards
