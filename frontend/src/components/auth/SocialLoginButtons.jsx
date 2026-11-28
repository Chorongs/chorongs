import kakaoSymbol from '../../assets/images/kakao_symbol.svg'
import naverSymbol from '../../assets/images/naver_symbol.png'
import { Button } from '../../styles/common'

// 카카오, 네이버 로그인 버튼 두 개 (로그인 화면 AU-01, 로그인 안내 창 CM-17이 같이 씀): 누르면 onLogin('kakao' 또는 'naver')
// 버튼을 감싸는 줄과 간격은 부르는 쪽이 정함 / disabled: 로그인 여부를 다시 확인하는 동안 등 두 버튼 모두 잠금 (E5)
// 버튼 글: 카카오 로그인 디자인 가이드의 문구('카카오 로그인' 또는 '로그인')와 받은 네이버 공식 리소스 문구('네이버 로그인')를 따름
// 심볼은 공식 파일 그대로(모양, 비율, 색 변경 금지), 글자가 있으니 alt=""(꾸밈 그림)
function SocialLoginButtons({ onLogin, disabled = false }) {
  return (
    <>
      <Button $variant="kakao" onClick={() => onLogin('kakao')} disabled={disabled}>
        <img src={kakaoSymbol} alt="" />
        카카오 로그인
      </Button>
      <Button $variant="naver" onClick={() => onLogin('naver')} disabled={disabled}>
        <img src={naverSymbol} alt="" />
        네이버 로그인
      </Button>
    </>
  )
}

export default SocialLoginButtons
