import { useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import logoImg from '../../assets/images/logo_main.png'
import TermsDialog from '../common/TermsDialog'

// LY-13 푸터: 로고 / 링크 / 서비스 고지 / 데이터 출처 (관리자 링크 없음)
// 모양은 시안과 같게: 연회색 바탕, 위쪽에 로고 + 한 줄 소개 + 링크, 아래에 고지 글
// '이용약관', '개인정보 수집/이용' 링크 → 약관 창 TermsDialog (CM-21)
const Wrap = styled.footer`
  border-top: 1px solid var(--line);
  background: var(--mist);
`

const Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(100% - 32px, 1304px);
  margin: 0 auto;
  padding-block: 40px 48px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.7;
  @media (min-width: 768px) {
    width: min(100% - 64px, 1304px);
  }
  @media (max-width: 899px) {
    padding-bottom: calc(66px + 32px + env(safe-area-inset-bottom));
  }
`

const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
`

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  span {
    color: var(--cocoa);
    font-size: var(--fs-sm);
    font-weight: 700;
  }
`

const LogoImage = styled.img`
  display: block;
  height: 26px;
`

const Links = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  color: var(--ink-2);
  font-weight: 700;
  a:hover,
  button:hover {
    color: var(--ink);
  }
`

// 약관 링크: 주소 이동 없이 약관 창을 여는 버튼 (모양은 옆 링크와 같게)
const TermsButton = styled.button.attrs({ type: 'button' })`
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
`

const Notice = styled.p`
  b {
    color: var(--ink-2);
  }
`

function Footer() {
  const [termsKind, setTermsKind] = useState(null)

  return (
    <Wrap>
      <Inner>
        <Top>
          <Brand>
            <LogoImage src={logoImg} alt="캐링" />
            <span>대출, 더 쉽게 연결되다</span>
          </Brand>
          <Links aria-label="하단 링크">
            <TermsButton onClick={() => setTermsKind('service')}>이용약관</TermsButton>
            <TermsButton onClick={() => setTermsKind('privacy')}>개인정보 수집/이용</TermsButton>
            <Link to="/help/faq">자주 묻는 질문</Link>
            <Link to="/help/illegal">불법 금융 대응</Link>
            <Link to="/help/terms">용어 사전</Link>
            <Link to="/my">MY</Link>
          </Links>
        </Top>
        <Notice>
          <b>캐링은 대출 상품을 판매하거나 중개하지 않는 정보 포털이에요.</b> 대출 신청과 심사는 각
          금융회사의 공식 채널에서 진행돼요.
        </Notice>
        <Notice>데이터 출처: 서민금융진흥원 대출상품한눈에, 금융감독원 금융상품통합비교공시</Notice>
      </Inner>
      <TermsDialog kind={termsKind} onClose={() => setTermsKind(null)} />
    </Wrap>
  )
}

export default Footer
