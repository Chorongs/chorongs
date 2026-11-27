// 이미 지워진 기록을 지우려 할 때 (다른 탭, 다른 단말기에서 먼저 지움): 서버가 404를 줌
export const isGoneError = (error) => error?.response?.status === 404

// 이미 지워진 기록 알림: '이미 삭제한 계산 기록이에요', '이미 취소한 찜이에요', '이미 삭제한 추천 결과예요' (받침이 없으면 '예요')
export function getGoneText(itemName, removeWord = '삭제') {
  const code = itemName.charCodeAt(itemName.length - 1) - 0xac00
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0
  return `이미 ${removeWord}한 ${itemName}${hasFinal ? '이에요' : '예요'}`
}
