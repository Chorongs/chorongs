import { useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { postSavedRecommend } from '../../api/myApi'
import { JOB_OPTIONS, MONTHS_UNKNOWN } from '../../constants/options'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Panel, Tag } from '../../styles/common'
import { formatMoney } from '../../utils/format'
import Disclaimer from '../common/Disclaimer'
import Icon from '../ui/Icon'
import RecommendCard from './RecommendCard'

const TOP_COUNT = 3 // 1~3위는 위에 따로
const PAGE_SIZE = 10 // 4위부터 한 쪽에 10개씩
const MAX_RESULT_COUNT = 30 // 서버가 보내는 최대 개수. 남은 상품이 이보다 많으면 '상위 30개까지' 안내

const DISCLAIMER_TEXT = '실제 심사가 아닌 참고용이에요. 예상 금리는 공시된 금리 범위를 기준으로 해요.'

// 서민금융진흥원 누리집 (0건 안내의 상담 안내에서 새 창으로)
const KINFA_URL = 'https://www.kinfa.or.kr/main.do'

// 결과가 0건일 때 바로가기 (이동 주소는 화면 목록, 버튼 글자는 가안 기준)
const EMPTY_SHORTCUTS = [
  { label: '상세 검색으로 찾기', to: '/search' },
  { label: '신용 셀프 진단', to: '/diagnosis/credit' },
  { label: '대출 랭킹', to: '/ranking' },
]

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--f-ui);
  color: var(--ink);
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 4px;
`

const HeadMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const ResultTitle = styled.h2`
  margin: 0;
  font-size: var(--fs-h2);
  font-weight: 800;
`

const RestTitle = styled.h3`
  margin: 16px 0 -4px;
  font-size: var(--fs-xl);
  font-weight: 800;
`

const ConditionTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

// 안내 줄: 앞에 느낌표 아이콘 (가안). 연체, 기간 모름 같은 서버 안내와 제외 요약에 씀
const Notes = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const NoteLine = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const AlertMark = styled.svg`
  flex: none;
  width: 17px;
  height: 17px;
  margin-top: 2px;
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
`

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
`

const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
`

const PageNumber = styled.span`
  color: var(--ink-2);
  font-family: var(--f-num);
  font-size: var(--fs-md);
  font-weight: 700;
`

const Notice = styled.p`
  margin: 0;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  text-align: center;
`

// 0건 안내 판: 큰 회색 판(Panel) 안에 글 + 바로가기 버튼 (가안)
const EmptyText = styled.p`
  margin: 0;
  color: var(--ink-2);
  line-height: 1.6;

  & b {
    color: var(--ink);
  }
`

const EmptyButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
`

const OrgLink = styled.a`
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
`

// 입력 조건 태그 (소득, 신용 같은 민감한 값은 보이지 않음)
const getConditionLabels = (input) => {
  if (!input) return []
  const job = JOB_OPTIONS.find((option) => option.value === input.job)
  const months = input.months === MONTHS_UNKNOWN ? '기간 모름' : `${input.months}개월`
  return [job?.label, input.purpose, formatMoney(input.need), months].filter(Boolean)
}

/*
    RC-07 추천 결과 (최대 30개). 제목 '추천 결과'는 RecommendPage가 그림
    - useRecommendStore의 result, lastInput을 읽음. 결과가 없으면 아무것도 안 그림 (빈 안내는 RecommendPage가 함)
    - [결과 저장] → API-38 (purpose, need, months, job + 순위대로 productIds), 연타 방지 (E5)
    - 서버가 준 안내 문구(notes, hint)와 제외 요약은 글자로만 출력 (E1)
    - 4위부터는 10개씩 쪽 넘김 (이미 받은 30개 안에서)
    - TODO(CM-22, CHORONG-43): [결과 저장]을 requireLogin(저장 함수, '로그인하면 결과를 저장할 수 있어요')로 감싸기 (지금은 비회원이면 서버 401 → 실패 알림)
    - TODO(ST-04, CHORONG-47): 비교함에 용도 필터가 있으면 겹치는 상품만 보이고 숨긴 개수 안내
      (상품 용도는 product.tags의 PURPOSE, 비교함 용도는 useCompareStore tray의 purposes)
*/
function RecommendResult() {
  const result = useRecommendStore((state) => state.result)
  const lastInput = useRecommendStore((state) => state.lastInput)
  const showToast = useUiStore((state) => state.showToast)

  const [restPage, setRestPage] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  // 새 추천 결과가 오면 쪽 넘김을 1쪽으로 되돌림 (이전 결과의 3쪽이 남아 목록이 비는 것 방지)
  const [shownResult, setShownResult] = useState(result)
  if (result !== shownResult) {
    setShownResult(result)
    setRestPage(0)
  }

  if (!result) return null

  // 서버가 빼고 보낸 칸은 빈 값으로 (화면이 깨지지 않게)
  const { total = 0, hint = null } = result
  const excluded = result.excluded ?? []
  const notes = result.notes ?? []
  const items = result.items ?? []
  const topItems = items.filter((item) => item.rankNo <= TOP_COUNT)
  const restItems = items.filter((item) => item.rankNo > TOP_COUNT)
  const restPageCount = Math.ceil(restItems.length / PAGE_SIZE)
  const visibleRest = restItems.slice(restPage * PAGE_SIZE, (restPage + 1) * PAGE_SIZE)
  const canSave = lastInput !== null && items.length > 0
  const excludedTotal = excluded.reduce((sum, entry) => sum + entry.count, 0)

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await postSavedRecommend({
        purpose: lastInput.purpose,
        need: lastInput.need,
        months: lastInput.months,
        job: lastInput.job,
        productIds: items.map((item) => item.product.productId),
      })
      showToast('추천 결과를 저장했어요')
    } catch {
      showToast('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Wrap aria-label="추천 결과">
      <Head>
        <HeadMain>
          <ResultTitle>
            {items.length === 0
              ? '조건에 맞는 상품을 찾지 못했어요'
              : `조건에 맞는 대출 ${total}개가 추천 상품이에요`}
          </ResultTitle>
          <ConditionTags>
            {getConditionLabels(lastInput).map((label, index) => (
              <Tag key={`${index}-${label}`}>{label}</Tag>
            ))}
          </ConditionTags>
        </HeadMain>
        {canSave && (
          <Button $variant="outline" $size="sm" disabled={isSaving} onClick={handleSave}>
            <Icon name="doc" size={16} />
            결과 저장
          </Button>
        )}
      </Head>

      {items.length > 0 && (notes.length > 0 || excluded.length > 0) && (
        <Notes>
          {notes.map((note, index) => (
            <NoteLine key={`${index}-${note}`}>
              <AlertMark viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.5h.01" />
              </AlertMark>
              <span>{note}</span>
            </NoteLine>
          ))}
          {excluded.length > 0 && (
            <NoteLine>
              <AlertMark viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.5h.01" />
              </AlertMark>
              <span>
                제외한 상품 {excludedTotal}개:{' '}
                {excluded.map((entry) => `${entry.reason} ${entry.count}개`).join(', ')}
              </span>
            </NoteLine>
          )}
        </Notes>
      )}

      {items.length === 0 ? (
        <Panel>
          {hint && <EmptyText>{hint}</EmptyText>}
          <EmptyText>
            {!hint && '용도나 금액을 바꿔 보거나, '}신용점수 기준이 없는 <b>정책·서민금융</b> 상품을{' '}
            살펴보세요.{' '}
            <OrgLink href={KINFA_URL} target="_blank" rel="noopener noreferrer">
              서민금융진흥원(1397)
            </OrgLink>
            에서 무료 상담도 받을 수 있어요.
          </EmptyText>
          <EmptyButtons>
            {EMPTY_SHORTCUTS.map((shortcut) => (
              <Button key={shortcut.to} as={Link} to={shortcut.to} $variant="outline" $size="sm">
                {shortcut.label}
                <Icon name="arrow" />
              </Button>
            ))}
          </EmptyButtons>
        </Panel>
      ) : (
        <>
          <CardGrid>
            {topItems.map((item) => (
              <RecommendCard key={item.product.productId} item={item} />
            ))}
          </CardGrid>
          {visibleRest.length > 0 && (
            <>
              <RestTitle>다음 순위 {restItems.length}개</RestTitle>
              <CardGrid>
                {visibleRest.map((item) => (
                  <RecommendCard key={item.product.productId} item={item} />
                ))}
              </CardGrid>
            </>
          )}
          {restPageCount > 1 && (
            <Pager>
              <Button
                $variant="outline"
                $size="sm"
                disabled={restPage === 0}
                onClick={() => setRestPage((page) => page - 1)}
              >
                이전 쪽
              </Button>
              <PageNumber aria-label={`${restPageCount}쪽 중 ${restPage + 1}쪽`}>
                {restPage + 1} / {restPageCount}
              </PageNumber>
              <Button
                $variant="outline"
                $size="sm"
                disabled={restPage === restPageCount - 1}
                onClick={() => setRestPage((page) => page + 1)}
              >
                다음 쪽
              </Button>
            </Pager>
          )}
          {total > MAX_RESULT_COUNT && <Notice>상위 {MAX_RESULT_COUNT}개까지 보여 드려요</Notice>}
        </>
      )}

      <Disclaimer>{DISCLAIMER_TEXT}</Disclaimer>
    </Wrap>
  )
}

export default RecommendResult
