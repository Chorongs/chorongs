import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import HelpShortcuts from '../components/recommend/HelpShortcuts'
import HeroSection from '../components/recommend/HeroSection'
import IllegalSteps from '../components/recommend/IllegalSteps'
import ToolShortcuts from '../components/recommend/ToolShortcuts'

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: 28px;
`

const RevealBox = styled.div`
  padding: 28px 0;
  opacity: ${({ $isVisible }) => ($isVisible ? 1 : 0)};
  transform: translateY(${({ $isVisible }) => ($isVisible ? '0' : '28px')});
  transition: opacity 0.7s, transform 0.7s;

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transform: none;
    transition: none;
  }
`

// 화면에 들어오면 한 번 떠오름 (IntersectionObserver). 지원 안 하는 브라우저는 처음부터 보임
function Reveal({ children }) {
  const boxRef = useRef(null)
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  return (
    <RevealBox ref={boxRef} $isVisible={isVisible}>
      {children}
    </RevealBox>
  )
}

/*
    RC-01 웰컴 화면 (SCR-01)
    - 소개(RC-02) / 도구 바로가기(RC-10) / 도움말 바로가기(RC-11) / 불법 금융 대응 3단계(RC-12)
    - 소개 아래 구역은 스크롤하면 하나씩 떠오름 (0.7s)
    - 서버 호출 없음 (글은 모두 고정). 추천 입력은 추천 창(RC-14), 결과는 /recommend(RC-15)
    - 상시 도우미를 처음에 접어 두는 것은 Layout(LY-09) 쪽
*/
function HomePage() {
  return (
    <Page>
      <HeroSection />
      <Reveal>
        <ToolShortcuts />
      </Reveal>
      <Reveal>
        <HelpShortcuts />
      </Reveal>
      <Reveal>
        <IllegalSteps />
      </Reveal>
    </Page>
  )
}

export default HomePage
