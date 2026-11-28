import { useEffect, useState } from 'react'
import { StatusText } from '../../styles/common'

// 불러오는 중 글: 처음 LOADING_TEXT_DELAY_MS 동안은 같은 높이의 빈칸, 그 뒤에도 불러오는 중이면 '불러오는 중이에요'
// (보통은 그 안에 끝나서, 메뉴를 옮길 때 '불러오는 중이에요'가 번쩍 보였다 바뀌는 깜빡임이 없음)
const LOADING_TEXT_DELAY_MS = 300

function LoadingText() {
  const [isShown, setIsShown] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setIsShown(true), LOADING_TEXT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
  return <StatusText role="status">{isShown ? '불러오는 중이에요' : '\u00a0'}</StatusText>
}

export default LoadingText
