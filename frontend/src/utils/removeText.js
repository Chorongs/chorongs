// 기록 지우기 알림 글과 판단 (MY 구역, 계산기 화면 계산 기록 칸, 내 진단 리포트, 찜 버튼이 같이 씀)

// 지우기 실패 알림
export const REMOVE_FAIL_TEXT = '삭제하지 못했어요. 다시 시도해 주세요'

// 이미 지워진 기록을 지우려 할 때 (다른 탭, 다른 단말기에서 먼저 지움): 서버가 404를 줌
export const isGoneError = (error) => error?.response?.status === 404

// 마지막 글자에 받침이 있으면 true, 없으면 false, 한글이 아니면 null
function getHasFinal(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  if (code < 0 || code > 11171) return null
  return code % 28 !== 0
}

// 받침이 있으면 '을', 없으면 '를' (한글이 아닌 글자로 끝나면 '을(를)')
export function withObjectParticle(word) {
  const hasFinal = getHasFinal(word)
  if (hasFinal === null) return `${word}을(를)`
  return `${word}${hasFinal ? '을' : '를'}`
}

// 이미 지워진 기록 알림: '이미 삭제한 계산 기록이에요', '이미 취소한 찜이에요', '이미 삭제한 추천 결과예요' (받침이 없으면 '예요')
export function getGoneText(itemName, removeWord = '삭제') {
  return `이미 ${removeWord}한 ${itemName}${getHasFinal(itemName) ? '이에요' : '예요'}`
}
