import { useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { postSavedRecommend } from '../../api/myApi'
import {
  CREDIT_BAND_LABEL,
  HOUSING_PURPOSES,
  JOB_OPTIONS,
  MONTHS_DEFAULT,
  MONTHS_DEFAULT_HOUSING,
  MONTHS_UNKNOWN,
  PRIORITY_OPTIONS,
} from '../../constants/options'
import { getCompareBlock, useCompareItems } from '../../store/useCompareStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, IconButton, Panel, Tag } from '../../styles/common'
import { formatMoney } from '../../utils/format'
import { formatMatchRate } from '../../utils/recommend'
import requireLogin from '../../utils/requireLogin'
import Disclaimer from '../common/Disclaimer'
import ProductList from '../common/ProductList'
import PurposeFilterBanner from '../common/PurposeFilterBanner'
import Icon from '../ui/Icon'
import RecommendCard from './RecommendCard'

const TOP_COUNT = 3 // 1~3위는 위에 따로
const PAGE_SIZE = 10 // 4위부터 한 쪽에 10개씩
const MAX_RESULT_COUNT = 30 // 서버가 보내는 최대 개수. 남은 상품이 이보다 많으면 '상위 30개까지' 안내

// 서버가 0건일 때 notes에 넣는 글 (RecommendServiceImpl NOTE_EMPTY). 제목에 같은 글을 쓰므로 안내 줄에서는 뺌
const EMPTY_NOTE = '조건에 맞는 상품을 찾지 못했어요'

// 고지 글: 명세서 RC-07 '실제 심사가 아닌 참고용, 예상 금리는 공시 범위'
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

// 줄이 바뀌어도 오른쪽 끝에 붙음 (가안 .save-row)
const SaveButton = styled(Button)`
  margin-left: auto;
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
// 안내 줄 사이 간격 20, 카드까지 20 (가안 .excl)
const Notes = styled.ul`
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const NoteLine = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;

  & [data-icon] {
    margin-top: 2px;
    color: var(--muted);
  }
`

// 1~3위 카드는 한 줄에 하나씩 세로로 (가안)
const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 20px;
`

// 이전 쪽 버튼: 다음 쪽과 같은 화살표를 반대로 돌림
const PrevButton = styled(IconButton)`
  & [data-icon] {
    transform: rotate(180deg);
  }
`

const PageNumber = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 800;
`

const Hint = styled.p`
  margin: -4px 0 0;
  color: var(--cocoa);
  font-size: var(--fs-sm);
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

const AGE_LABEL = { YOUTH: '청년(만 19~34세)', ADULT: '만 35세 이상' }

// 신용 구간 글에 '점' 붙이기: '701~800' → '701~800점', '900 초과' → '900점 초과'
const getBandText = (creditBand) => {
  const label = CREDIT_BAND_LABEL[creditBand]
  if (!label) return ''
  return /^\d+ /.test(label) ? label.replace(' ', '점 ') : `${label}점`
}

// 입력 조건 태그 (가안 순서: 직업, 나이, 지역, 소득, 용도 금액 · 기간, 신용, 기존 대출, 연체, 중요한 것)
const getConditionLabels = (input) => {
  if (!input) return []
  const job = JOB_OPTIONS.find((option) => option.value === input.job)
  const defaultMonths = HOUSING_PURPOSES.includes(input.purpose) ? MONTHS_DEFAULT_HOUSING : MONTHS_DEFAULT
  const period =
    input.months === MONTHS_UNKNOWN
      ? `기간 미정(${defaultMonths / 12}년으로 가정)`
      : `${input.months / 12}년 이내`
  let debt = '기존 대출 없음'
  if (input.debtUnknown) debt = '기존 대출 모름'
  else if (input.debtMonthly > 0) debt = `기존 상환 월 ${formatMoney(input.debtMonthly)}`
  const priorities = (input.priorities ?? [])
    .map((value) => PRIORITY_OPTIONS.find((option) => option.value === value)?.label)
    .filter(Boolean)

  return [
    job?.label,
    AGE_LABEL[input.ageGroup],
    input.region ? `사는 지역 ${input.region}` : '',
    `연소득 ${formatMoney(input.income ?? 0)}`,
    `${input.purpose} ${formatMoney(input.need)} · ${period}`,
    `신용 ${getBandText(input.creditBand)}`,
    debt,
    input.overdue ? '최근 연체 있음' : '',
    `중요: ${priorities.join(' · ')}`,
  ].filter(Boolean)
}

/*
    RC-07 추천 결과 (최대 30개). 제목 '추천 결과'는 RecommendPage가 그림
    - useRecommendStore의 result, lastInput을 읽음. 결과가 없으면 아무것도 안 그림 (빈 안내는 RecommendPage가 함)
    - [결과 저장] → API-38 (purpose, need, months, job + 순위대로 productIds), 연타 방지 (E5)
    - 서버가 준 안내 문구(notes, hint)와 제외 요약은 글자로만 출력 (E1)
    - 1~3위는 추천 카드를 세로로, 4위부터는 상품 한 줄(ProductList, 순위와 일치도 포함)을 10개씩 쪽 넘김 (이미 받은 30개 안에서)
    - TODO(LY-01, 각 이슈 담당): 0건 바로가기의 /search(CHORONG-64 조빌립), /diagnosis/credit(CHORONG-51 김진석), /ranking(CHORONG-60 김채희) 화면은 각 이슈가 라우트를 추가해야 생김 (그 전에는 '찾을 수 없음' 화면)
    - [결과 저장]은 requireLogin으로 감쌈: 비회원이면 로그인 안내 창 '추천 결과 저장은 회원 전용이에요.' (CM-22, CM-17)
    - TODO(RC-07, LOAN-04, CHORONG-45 김채희, CHORONG-43 Tong B): 같은 결과를 누를 때마다 다시 저장됨 (명세서에 중복 규칙 없음, 10개 넘으면 오래된 저장이 밀려 지워짐).
      시연 뒤 A안: 저장 성공하면 버튼을 '저장했어요'로 잠그고, 새로 추천받으면 다시 풀기 (새로고침 뒤에도 막으려면 useRecommendStore에 저장한 결과 표시 추가). 문서_반영_목록 Q12
    - 비교 필터 (CM-10, CHORONG-47, CHORONG-82): 비교할 상품을 고르는 중이면 남겨 둔 상품과 자금 용도와 상환 방식이 겹치는 상품만 보이고, 위에 띠 + 숨긴 개수를 보여 줌
      (getCompareBlock이 null이 아닌 상품을 숨김, 남겨 둔 상품은 그대로 보임). 결과 저장은 필터와 상관없이 전체 순위대로
*/
function RecommendResult() {
  const result = useRecommendStore((state) => state.result)
  const lastInput = useRecommendStore((state) => state.lastInput)
  const showToast = useUiStore((state) => state.showToast)

  const baseItems = useCompareItems() // 거르는 기준 상품 (비교 화면의 한 칸을 고르러 나온 중 남은 상품)
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
  const items = result.items ?? []
  // 0건일 때 서버가 notes에 넣는 '찾지 못했어요' 글은 제목과 같아서 뺌 (연체, 기간 모름 같은 다른 안내는 0건에서도 보임)
  const noteLines = (result.notes ?? []).filter((note) => note !== EMPTY_NOTE)
  // 고르는 중 거르기: 남겨 둔 상품과 용도나 상환 방식이 안 겹치는 상품은 숨김 (남겨 둔 상품은 보임)
  const isHiddenByPick = (item) =>
    baseItems.length > 0 &&
    !baseItems.some((base) => base.productId === item.product.productId) &&
    getCompareBlock(baseItems[0], item.product) !== null
  const shownItems = items.filter((item) => !isHiddenByPick(item))
  const hiddenCount = items.length - shownItems.length
  const topItems = shownItems.filter((item) => item.rankNo <= TOP_COUNT)
  const restItems = shownItems.filter((item) => item.rankNo > TOP_COUNT)
  const restPageCount = Math.ceil(restItems.length / PAGE_SIZE)
  const currentRestPage = Math.min(restPage, Math.max(0, restPageCount - 1))
  const visibleRest = restItems.slice(currentRestPage * PAGE_SIZE, (currentRestPage + 1) * PAGE_SIZE)
  const canSave = lastInput !== null && items.length > 0
  const excludedTotal = excluded.reduce((sum, entry) => sum + entry.count, 0)

  const saveResult = async () => {
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
    } catch (error) {
      // 401(로그인 풀림)은 axiosInstance가 로그인 안내 창을 띄우므로 실패 알림을 겹쳐 띄우지 않음 (E4)
      if (error.response?.status === 401) return
      showToast('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  // 비회원이면 저장 대신 로그인 안내 창 (RC-07 비회원: requireLogin, 문구는 CM-17 '추천 결과 저장', CHORONG-43에서 연결)
  const handleSave = () => requireLogin(saveResult, '추천 결과 저장은 회원 전용이에요.')

  return (
    <Wrap aria-label="추천 결과">
      <Head>
        <HeadMain>
          <ResultTitle>
            {items.length === 0
              ? '조건에 맞는 상품을 찾지 못했어요'
              : `조건에 맞는 대출 ${total}개가 추천 상품이에요`}
          </ResultTitle>
          {total > MAX_RESULT_COUNT && <Hint>추천 순위 상위 {MAX_RESULT_COUNT}개까지 보여드려요.</Hint>}
          <ConditionTags>
            {getConditionLabels(lastInput).map((label, index) => (
              <Tag key={`${index}-${label}`}>{label}</Tag>
            ))}
          </ConditionTags>
        </HeadMain>
        {canSave && (
          <SaveButton $variant="outline" $size="sm" disabled={isSaving} onClick={handleSave}>
            <Icon name="doc" size={16} />
            결과 저장
          </SaveButton>
        )}
      </Head>

      {(noteLines.length > 0 || (items.length > 0 && excluded.length > 0)) && (
        <Notes>
          {noteLines.map((note, index) => (
            <NoteLine key={`${index}-${note}`}>
              <Icon name="alert" size={17} />
              <span>{note}</span>
            </NoteLine>
          ))}
          {items.length > 0 && excluded.length > 0 && (
            <NoteLine>
              <Icon name="alert" size={17} />
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
            신용점수 기준이 없는 <b>정책·서민금융</b> 상품을 살펴보세요.{' '}
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
          <PurposeFilterBanner hiddenCount={hiddenCount} />
          <CardList>
            {topItems.map((item) => (
              <RecommendCard key={item.product.productId} item={item} />
            ))}
          </CardList>
          {visibleRest.length > 0 && (
            <>
              <RestTitle>다음 순위 {restItems.length}개</RestTitle>
              <ProductList
                items={visibleRest.map((item) => item.product)}
                from="recommend"
                getRowProps={(_, index) => ({
                  rank: visibleRest[index].rankNo,
                  matchRate: formatMatchRate(visibleRest[index].matchRate),
                })}
              />
            </>
          )}
          {restPageCount > 1 && (
            <Pager>
              <PrevButton
                aria-label="다음 순위 이전"
                disabled={currentRestPage === 0}
                onClick={() => setRestPage(currentRestPage - 1)}
              >
                <Icon name="chevron_right" />
              </PrevButton>
              <PageNumber aria-label={`${restPageCount}쪽 중 ${currentRestPage + 1}쪽`}>
                {currentRestPage + 1} / {restPageCount}
              </PageNumber>
              <IconButton
                aria-label="다음 순위 다음"
                disabled={currentRestPage === restPageCount - 1}
                onClick={() => setRestPage(currentRestPage + 1)}
              >
                <Icon name="chevron_right" />
              </IconButton>
            </Pager>
          )}
        </>
      )}

      <Disclaimer>{DISCLAIMER_TEXT}</Disclaimer>
    </Wrap>
  )
}

export default RecommendResult
