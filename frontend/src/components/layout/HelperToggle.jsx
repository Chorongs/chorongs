import { Button } from '../../styles/common'
import useUiStore from '../../store/useUiStore'

// LY-06 도우미 버튼: 누르면 상시 도우미 열기/닫기. aria-expanded를 실제 열림 상태와 맞춤
function HelperToggle() {
  const helperOpen = useUiStore((state) => state.helperOpen)
  const toggleHelper = useUiStore((state) => state.toggleHelper)

  return (
    <Button
      $variant="outline"
      $size="sm"
      aria-expanded={helperOpen}
      onClick={toggleHelper}
    >
      도우미
    </Button>
  )
}

export default HelperToggle
