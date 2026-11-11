import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { postRecommend } from '../api/recommendApi'

/*
    ST-03 추천 입력값, 결과
    - input: API-06 보내는 값과 같은 이름
    - result: API-06 응답 data 그대로 (total, excluded, notes, hint, items)
    - isDemo: 예시 결과인지 여부
    - lastInput: 마지막으로 추천을 실행한 조건
    - persist + sessionStorage: 탭을 닫으면 지워짐 (E6)
    - 입력값(소득, 신용 등)은 console 출력 금지 (E6)
*/

const initialInput = {
  job: null,
  ageGroup: null,
  region: null,
  income: null,
  debtMonthly: null,
  debtUnknown: false,
  purpose: null,
  need: null,
  months: null,
  creditBand: null,
  overdue: null,
  priorities: [],
}

export const useRecommendStore = create(
  persist(
    (set, get) => ({
      input: initialInput,
      result: null,
      isDemo: false,
      lastInput: null,

      // 바꿀 칸만 담아서 부르면 기존 input에 합쳐짐 (전체 교체 아님)
      setInput: (changes) => {
        set((state) => ({ input: { ...state.input, ...changes } }))
      },

      // API-06 호출. 실패하면 에러를 그대로 던짐 (로딩, 실패 화면은 부른 쪽에서 처리: E3, E5)
      run: async () => {
        const { input } = get()
        const result = await postRecommend(input)
        set({ result, lastInput: input, isDemo: false })
      },

      // 입력값과 결과를 모두 비움 (로그아웃, 탈퇴 때)
      clear: () => {
        set({ input: initialInput, result: null, isDemo: false, lastInput: null })
      },
    }),
    {
      name: 'recommend-storage', // sessionStorage 키 이름
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
