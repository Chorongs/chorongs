// 목록 상태 { status, ...결과, hasShown }를 '다시 받는 중'으로 바꿈: 이전 결과(빈 목록 포함)는 그대로 둠
// hasShown: 다 받은 결과를 한 번이라도 보여 줬는지 (처음 열 때만 false → 그때만 불러오는 중 글, 그 뒤로는 이전 결과를 흐리게 둠)
export const toLoading = (prev) => ({ ...prev, status: 'loading', hasShown: prev.status === 'done' || Boolean(prev.hasShown) })
