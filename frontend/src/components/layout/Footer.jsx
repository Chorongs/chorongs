import { Link } from 'react-router-dom'
import styled from 'styled-components'
import logoImg from '../../assets/images/logo_main.png'

// LY-13 푸터: 로고 / 링크 / 서비스 고지 / 데이터 출처 (관리자 링크 없음)
// TODO: '이용약관', '개인정보 수집/이용' 링크는 약관 창 TermsDialog(CM-21)가 올라온 뒤 추가
const Wrap = styled.footer`
  border-top: 1px solid var(--line);
  background: var(--mist);
`

const Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(100% - 32px, 1304px);
  margin: 0 auto;
  padding: 28px 0;
  @media (min-width: 768px) {
    width: min(100% - 64px, 1304px);
  }
`

const Logo = styled(Link)`
  display: block;
  align-self: flex-start;
  width: 88px;
  height: 44px;
`

const LogoImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
`

const Links = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
`

const FooterLink = styled(Link)`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
  text-decoration: none;
  &:hover {
    color: var(--ink);
    text-decoration: underline;
  }
`

const Note = styled.p`
  margin: 0;
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

function Footer() {
  return (
    <Wrap>
      <Inner>
        <Logo to="/">
          <LogoImage src={logoImg} alt="캐링" />
        </Logo>
        <Links aria-label="푸터 링크">
          <FooterLink to="/help/faq">자주 묻는 질문</FooterLink>
          <FooterLink to="/help/illegal">불법 금융 대응</FooterLink>
          <FooterLink to="/help/terms">용어 사전</FooterLink>
          <FooterLink to="/my">MY</FooterLink>
        </Links>
        <Note>캐링은 대출을 판매하거나 중개하지 않고, 대출 상품 비교와 추천 정보만 알려 드려요.</Note>
        <Note>데이터 출처: 서민금융진흥원, 금융감독원</Note>
      </Inner>
    </Wrap>
  )
}

export default Footer
