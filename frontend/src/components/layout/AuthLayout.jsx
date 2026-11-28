import styled from 'styled-components'
import logoImg from '../../assets/images/logo_main.png'
import Icon from '../ui/Icon'

// 로그인류 화면 틀 (회원 로그인, 가입 단계, 관리자 로그인, 관리자 가입 신청이 같이 씀)
// 가운데 440px / 머리(표시, 한 줄 소개, 제목, 설명) + 내용(children, 세로 20px 간격)
// mark: 'logo'면 캐링 로고, 그 밖의 값은 아이콘 이름 (검은 네모 안, 관리자는 'shield')
// tagline: 로고 위 한 줄 소개. 'logo'이고 안 넘기면 LOGO_TAGLINE (회원 로그인, 가입 단계가 같은 글)
// isError: 설명을 빨간 오류 글로 / 설명 안의 \n은 줄바꿈
const LOGO_TAGLINE = '대출, 더 쉽게 연결되다'

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 440px;
  margin: 8px auto 0;
`

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  text-align: center;
`

const Logo = styled.img`
  height: 64px;
`

const Mark = styled.span`
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: var(--r-lg);
  background: var(--ink);
  color: var(--paper);
`

const Tagline = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-base);
  font-weight: 700;
`

const Title = styled.h1`
  margin-top: 8px;
  font-size: var(--fs-h2);
  font-weight: 800;
`

const Description = styled.p`
  color: ${({ $isError }) => ($isError ? 'var(--bad)' : 'var(--cocoa)')};
  font-weight: ${({ $isError }) => ($isError ? 600 : 400)};
  white-space: pre-line;
`

function AuthLayout({ mark, tagline, title, description, isError = false, children }) {
  const taglineText = tagline ?? (mark === 'logo' ? LOGO_TAGLINE : null)
  return (
    <Wrap>
      <Head>
        {mark === 'logo' ? (
          <Logo src={logoImg} alt="캐링" />
        ) : (
          <Mark aria-hidden="true">
            <Icon name={mark} size={30} />
          </Mark>
        )}
        {taglineText && <Tagline>{taglineText}</Tagline>}
        <Title>{title}</Title>
        {description && (
          <Description $isError={isError} role={isError ? 'alert' : undefined}>
            {description}
          </Description>
        )}
      </Head>
      {children}
    </Wrap>
  )
}

export default AuthLayout
