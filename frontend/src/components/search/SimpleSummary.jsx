import styled from 'styled-components'
import { getKeywordLabel } from '../../constants/options'
import Icon from '../ui/Icon'

// SR-09 추천 요약: 왜 이 상품인지 한 문단. 요약 문장은 서버가 안 주고 프론트가 응답으로 만듦
// "‘A’ + ‘B’ 조합으로 골랐어요. 가장 잘 맞는 상품은 OO으로, 키워드 N개 중 M개를 충족해요."
// 1위 상품이 못 맞춘 키워드가 있으면 "‘C’까지 맞는 상품은 없어서 가까운 순서로 보여드려요." 추가
// props: keywords 고른 키워드 / bestName 1위 상품 이름 / matchedCount 1위가 충족한 키워드 수 / missedKeywords 1위가 못 맞춘 키워드
const Wrap = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin: 28px 0 8px;
  padding: 22px 24px;
  border-radius: var(--r-md);
  background: var(--brand-soft);
`

const IconBox = styled.span`
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: var(--r-sm);
  background: var(--paper);
  color: var(--brand-text);
`

const Text = styled.p`
  color: var(--ink-2);
  font-size: var(--fs-base);
  line-height: 1.7;
  & b {
    color: var(--ink);
  }
`

// 받침이 있으면 '으로', 없거나 ㄹ 받침이면 '로' (한글이 아니면 '로')
function getRo(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code >= 11172) return '로'
  const final = code % 28
  return final === 0 || final === 8 ? '로' : '으로'
}

const quote = (keyword) => `‘${getKeywordLabel(keyword)}’`

function SimpleSummary({ keywords, bestName, matchedCount, missedKeywords = [] }) {
  return (
    <Wrap>
      <IconBox>
        <Icon name="spark" size={22} />
      </IconBox>
      <Text>
        <b>{keywords.map(quote).join(' + ')}</b> 조합으로 골랐어요. 가장 잘 맞는 상품은 <b>{bestName}</b>
        {getRo(bestName)}, 키워드{' '}
        {keywords.length}개 중 {matchedCount}개를 충족해요.
        {missedKeywords.length > 0 &&
          ` ${missedKeywords.map(quote).join(', ')}까지 맞는 상품은 없어서 가까운 순서로 보여드려요.`}
      </Text>
    </Wrap>
  )
}

export default SimpleSummary
