import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { IconButton } from '../../styles/common'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import RecommendStepper from './RecommendStepper'

const RESULT_PATH = '/recommend'

// 추천 실행 실패 때 보여 줄 짧은 안내 (서버 오류 내용을 그대로 내지 않음: E3)
const getRunErrorMessage = (error) => {
  const status = error?.response?.status
  if (status === 400) return error.response.data?.message || '입력한 값을 다시 확인해 주세요'
  if (status === 429) return '잠시 후 다시 시도해 주세요'
  return '추천을 불러오지 못했어요. 다시 시도해 주세요'
}

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
`

const Title = styled.h2`
  margin: 0;
  color: var(--ink);
  font-family: var(--f-ui);
  font-size: var(--fs-h3);
  font-weight: 800;
`

// 열려 있는 동안만 그려지므로, 닫으면 입력 단계와 실행 상태가 처음으로 돌아감 (입력값은 스토어에 남음)
function RecommendDialogBody() {
  const navigate = useNavigate()
  const run = useRecommendStore((state) => state.run)
  const closeRecommend = useUiStore((state) => state.closeRecommend)

  const [isRunning, setIsRunning] = useState(false)
  // { message } 또는 null (같은 문구로 또 실패해도 새로 실패한 것으로 알 수 있게 객체로 둠)
  const [runError, setRunError] = useState(null)

  // 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const handleRun = async () => {
    if (isRunning) return
    setIsRunning(true)
    setRunError(null)
    try {
      await run()
      closeRecommend()
      navigate(RESULT_PATH)
    } catch (error) {
      setRunError({ message: getRunErrorMessage(error) })
      setIsRunning(false)
    }
  }

  return (
    <Modal isOpen onClose={closeRecommend} label="캐링 추천" showClose={false}>
      <Head>
        <Title>캐링 추천</Title>
        <IconButton aria-label="닫기" onClick={closeRecommend}>
          <Icon name="close" />
        </IconButton>
      </Head>
      <RecommendStepper onRun={handleRun} isRunning={isRunning} runError={runError} />
    </Modal>
  )
}

/*
    RC-14 맞춤 추천 창 (SCR-26)
    - 어느 화면에서든 뜨는 추천 입력 창. Layout(LY-03)에서 한 번만 그림 (Layout은 조빌립 담당, 연결 TODO)
    - 열림은 useUiStore(recommendOpen, closeRecommend). 여는 곳은 openRecommend(skipGate)
    - 제목 '캐링 추천' + 닫기 / '잠깐' 창(RC-13) → 3단계 입력(RC-03)
    - 마지막 단계에서 추천 실행(API-06) → 성공하면 창을 닫고 /recommend로 이동. 실패하면 창을 닫지 않고 3단계 아래에 문구 + [다시 시도] (E3)
    - 닫기: X, Esc, 바깥 누르기 (입력값은 그대로 남음). 열려 있는 동안 뒤 화면 스크롤 잠금
    - 입력값 console 출력 금지 (E6)
*/
function RecommendDialog() {
  const recommendOpen = useUiStore((state) => state.recommendOpen)

  if (!recommendOpen) return null
  return <RecommendDialogBody />
}

export default RecommendDialog
