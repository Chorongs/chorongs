import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { postRecommend } from '../api/recommendApi'
import { MONTHS_DEFAULT } from '../constants/options'

/*
    ST-03 추천 입력값, 결과
    - input: API-06 보내는 값과 같은 이름
    - result: API-06 응답 data 그대로 (total, excluded, notes, hint, items)
    - lastInput: 마지막으로 추천을 실행한 조건
    - diagBand: 이 탭에서 셀프 진단한 신용 구간 (BAND1~5). 점수, 답은 담지 않음
    - savedKey: 마지막으로 저장한 추천 결과의 내용 글 (조건 + 순위대로 상품 번호). 같은 내용 중복 저장 막기용
    - persist + sessionStorage: 탭을 닫으면 지워짐 (E6)
    - 입력값(소득, 신용 등)은 console 출력 금지 (E6)
*/

// 처음 골라 두는 값 (ST-03: 직장인, 청년, 생활비, 36개월, 연체 없음, 낮은 금리). 칸은 모두 바꿀 수 있음
// 소득, 기존 대출, 지역, 필요 금액, 신용 구간은 비워 둠 (신용 구간은 StepCredit이 진단 구간이 있을 때 미리 고름)
const initialInput = {
  job: 'OFFICE',
  ageGroup: 'YOUTH',
  region: null,
  income: null,
  debtMonthly: null,
  debtUnknown: false,
  purpose: '생활비',
  need: null,
  months: MONTHS_DEFAULT,
  creditBand: null,
  overdue: false,
  priorities: ['LOW_RATE'],
}

export const useRecommendStore = create(
  persist(
    (set, get) => ({
      input: initialInput,
      result: null,
      lastInput: null,
      diagBand: null,
      savedKey: null,

      // 바꿀 칸만 담아서 부르면 기존 input에 합쳐짐 (전체 교체 아님)
      setInput: (changes) => {
        set((state) => ({ input: { ...state.input, ...changes } }))
      },

      // 셀프 진단 구간 기억 (추천 창, 신용 진단 화면 둘 다 씀)
      setDiagBand: (diagBand) => {
        set({ diagBand })
      },

      // 마지막으로 저장한 추천 결과 내용 기억 (RC-07 [결과 저장], 같은 내용은 다시 저장하지 않음)
      markSaved: (savedKey) => {
        set({ savedKey })
      },

      // API-06 호출. 실패하면 에러를 그대로 던짐 (로딩, 실패 화면은 부른 쪽에서 처리: E3, E5)
      run: async () => {
        const { input } = get()
        const result = await postRecommend(input)
        set({ result, lastInput: input })
      },

      // 입력값과 결과를 모두 비움 (로그아웃, 탈퇴 때)
      clear: () => {
        set({ input: initialInput, result: null, lastInput: null, diagBand: null, savedKey: null })
      },
    }),
    {
      name: 'recommend-storage', // sessionStorage 키 이름
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
