import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as productApi from '../../api/productApi'
import { CREDIT_BAND_LABEL, FEATURE_LABEL, REPAY_METHOD_CODE } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, IconButton, Tag } from '../../styles/common'
import { formatMoney, formatRate } from '../../utils/format'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import BaseDateBadge from './BaseDateBadge'
import Disclaimer from './Disclaimer'
import MoneyText from './MoneyText'
import RateText from './RateText'

// CM-07 상품 상세 창: 주소가 안 바뀌는 팝업 (Layout에서 한 번만 그림). 열림은 useUiStore(sheetProductId)
// 열리면 상품 상세(API-02)를 받고 조회 기록(API-05)을 보낸다. 조회 기록 실패는 화면에 안 보인다.
// 열려 있는 동안 뒤 화면 스크롤을 잠근다.
// 모양은 시안과 같게: 제목 줄 오른쪽 닫기 → 금리·한도·기간 3칸 → 구획(h4 + 표) → 버튼 줄 → 기준일, 고지
//
// TODO(CM-08, CHORONG-45): '내 조건 안내' EligibilityNotice (3칸 아래, useRecommendStore의 입력값이 올라온 뒤)
// TODO(RC-09, CHORONG-45): 추천 이유 ReasonList (sheetFrom이 'recommend'일 때 3칸 아래, productId를 넘겨 표시)
// TODO(CM-06, CHORONG-43): [찜하기] LikeButton을 버튼 줄에 연결 (버튼 줄을 3칸: 찜하기 / + 비교 / 이자 계산)
// TODO(ST-04, CHORONG-47): [+ 비교] 버튼 연결. addTray가 true면 창 닫기, false면 그대로. sheetFrom이 'ranking'이면 [+ 비교] 숨김 (랭킹에서는 비교 안 함)
// TODO(API-21, CHORONG-43): 회원이면 최근 본 대출 기록 myApi.postRecentView (useAuthStore가 올라온 뒤)
// TODO(CM-16, CHORONG-52): 버튼 줄 아래 '상품 정보가 이상하면 신고해 주세요' 링크 (게시 상품만). 이미 신고했으면(reported) 신고 완료 문구
// TODO(ST-03, CHORONG-45): [이자 계산] 금액은 useRecommendStore의 lastInput.need와 한도 중 작은 값 (지금은 기본값 1,000만원)
const DEFAULT_NEED_MAN = 1000
const DEFAULT_MONTHS = 36
const SOURCE_LABEL = { KINFA: '서민금융진흥원', FSS: '금융감독원' }

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const TopBar = styled.div`
  display: flex;
  justify-content: flex-end;
`

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

const HeadInfo = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Name = styled.h3`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

// 금리, 최대 한도, 최대 기간 3칸 (칸 사이 2px 틈은 바탕색으로)
const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  overflow: hidden;
  border-radius: var(--r-md);
  background: var(--line);
`

const Tile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 16px 18px;
  background: var(--mist);
`

const TileLabel = styled.small`
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 700;
`

const TileValue = styled.b`
  color: ${({ $isRate }) => ($isRate ? 'var(--brand-text)' : 'inherit')};
  font-family: var(--f-num);
  font-size: var(--fs-xl);
  font-weight: 900;
  letter-spacing: -0.01em;
  white-space: nowrap;
`

const Memo = styled.span`
  color: var(--cocoa);
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Unit = styled.small`
  margin-left: 2px;
  font-family: var(--f-ui);
  font-size: var(--fs-xs);
  font-weight: 800;
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const SectionBox = styled.section`
  margin-top: 6px;
`

const SectionTitle = styled.h4`
  margin: 16px 0 4px;
  font-size: var(--fs-base);
  font-weight: 800;
`

// 표: 왼쪽 이름 130px, 오른쪽 값. 줄마다 아래 구분선
const Kv = styled.dl`
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  dt,
  dd {
    padding: 9px 0;
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-sm);
  }
  dt {
    color: var(--cocoa);
    font-weight: 600;
  }
  dd {
    overflow-wrap: anywhere;
    color: var(--ink);
    font-weight: 700;
  }
`

const BandValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`

const ExternalLink = styled.a`
  color: var(--brand-text);
  font-weight: 700;
`

// 지금은 [이자 계산] 하나라 한 칸. 찜하기, + 비교가 올라오면 3칸(repeat(3, minmax(0, 1fr)))으로
const Actions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
`

const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  text-align: center;
`

function getTagValues(product, tagType) {
  return (product.tags ?? []).filter((tag) => tag.tagType === tagType).map((tag) => tag.tagValue)
}

// 범위 글: 둘 다 있으면 'a ~ b', 한쪽만 있으면 '이상', '이하'. 둘 다 없으면 null
function getRangeText(min, max, suffix, prefix = '') {
  if (min != null && max != null) return `${prefix}${min}${suffix} ~ ${prefix}${max}${suffix}`
  if (min != null) return `${prefix}${min}${suffix} 이상`
  if (max != null) return `${prefix}${max}${suffix} 이하`
  return null
}

// 금리 범위 글: '4.50% ~ 9.80%', 같으면 '3.60% · 고정', 없으면 '금리는 기관 문의'
function getRateRangeText(min, max) {
  if (min == null && max == null) return '금리는 기관 문의'
  const low = formatRate(min ?? max)
  const high = formatRate(max ?? min)
  return low === high ? `${low}% · 고정` : `${low}% ~ ${high}%`
}

// 중도상환수수료: 0 → '없음', 숫자 → '최대 n%', 값 없음 → '기관 문의'
function getPrepayText(prepayFeeMax) {
  if (typeof prepayFeeMax !== 'number') return '기관 문의'
  if (prepayFeeMax === 0) return '없음'
  return `최대 ${formatRate(prepayFeeMax)}%`
}

// 구획별 표 줄. 값 없는 칸은 줄째 숨기고(content가 false/null), 줄이 하나도 없는 구획은 구획째 숨긴다.
function buildSections(product) {
  const isFss = product.source === 'FSS'
  const repay = getTagValues(product, 'REPAY')
  const target = getTagValues(product, 'TARGET')
  const purpose = getTagValues(product, 'PURPOSE')
  const limitTag = getTagValues(product, 'AMOUNT')[0]
  const features = (product.features ?? []).map((code) => FEATURE_LABEL[code] ?? code)
  const ageText = getRangeText(product.ageMin, product.ageMax, '세', '만 ')
  const creditText = getRangeText(product.creditMin, product.creditMax, '점')
  const info = product.applyInfo

  const sections = [
    {
      title: '상품 요건',
      rows: [
        {
          label: '대출 한도',
          content: typeof product.limitAmount === 'number' ? formatMoney(product.limitAmount) : (limitTag ?? '한도는 기관 문의'),
        },
        { label: '금리 (연)', content: getRateRangeText(product.rateMin, product.rateMax) },
        typeof product.termMax === 'number' && { label: '대출 기간', content: `최대 ${product.termMax}개월` },
        repay.length > 0 && { label: '상환 방식', content: repay.join(' · ') },
        { label: '중도상환수수료', content: getPrepayText(product.prepayFeeMax) },
      ],
    },
    {
      title: '지원 대상 요건',
      rows: [
        target.length > 0 && { label: '신청 대상', content: target.join(', ') },
        product.targetDetail && { label: '요건', content: product.targetDetail },
        purpose.length > 0 && { label: '자금 용도', content: purpose.join(', ') },
        // 금감원 상품의 나이, 소득, 연체 조건은 값이 없어 기관 확인으로 안내
        (isFss || ageText) && { label: '나이 조건', content: isFss ? '기관 확인' : ageText },
        (isFss || product.incomeNote) && { label: '소득 조건', content: isFss ? '기관 확인' : product.incomeNote },
        creditText && { label: '신용점수 기준', content: creditText },
        isFss && { label: '연체 조건', content: '기관 확인' },
        !isFss && product.extraCond && { label: '그 밖의 조건', content: product.extraCond },
      ],
    },
    {
      title: '기타 상품 정보',
      rows: [
        SOURCE_LABEL[product.source] && { label: '정보 제공', content: SOURCE_LABEL[product.source] },
        info?.applyMethod && { label: '신청 방법', content: info.applyMethod },
        info?.joinWay && { label: '가입 방법', content: info.joinWay },
        info?.contact && { label: '연락처', content: info.contact },
        info?.siteUrl && { label: '사이트', content: getSiteContent(info.siteUrl) },
        features.length > 0 && { label: '특징', content: features.join(', ') },
      ],
    },
  ]

  return sections
    .map((section) => ({ ...section, rows: section.rows.filter(Boolean) }))
    .filter((section) => section.rows.length > 0)
}

// 사이트 주소는 http(s)만 링크로, 새 창 (E9). 다른 모양은 글자로만 보여 준다.
function getSiteContent(siteUrl) {
  if (!/^https?:\/\//i.test(siteUrl)) return siteUrl
  return (
    <ExternalLink href={siteUrl} target="_blank" rel="noopener noreferrer">
      {siteUrl}
    </ExternalLink>
  )
}

// [이자 계산]으로 계산기(/calc)에 넘기는 값
// 금액: 1,000만원과 한도 중 작은 값(원) / 기간: 36개월과 최대 기간 중 작은 값 / 금리: 범위 중간값 / 방식: 첫 상환 방식
function buildCalcState(product) {
  const limit = product.limitAmount > 0 ? product.limitAmount : DEFAULT_NEED_MAN
  const rates = [product.rateMin, product.rateMax].filter((rate) => typeof rate === 'number')
  const interestRate = rates.length > 0 ? Number((rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(2)) : null
  const firstRepay = getTagValues(product, 'REPAY')[0]

  return {
    loanAmount: Math.min(DEFAULT_NEED_MAN, limit) * 10000,
    loanMonths: Math.min(DEFAULT_MONTHS, product.termMax > 0 ? product.termMax : DEFAULT_MONTHS),
    interestRate,
    repayMethod: REPAY_METHOD_CODE[firstRepay] ?? 'EQUAL_PI',
  }
}

function CloseButton({ onClose }) {
  return (
    <IconButton aria-label="닫기" onClick={onClose}>
      <Icon name="close" />
    </IconButton>
  )
}

function ProductDetail({ product, onClose }) {
  const navigate = useNavigate()
  const sector = getTagValues(product, 'SECTOR')[0]

  const head = (
    <Head>
      <HeadInfo>
        <Org>{sector ? `${product.companyName} · ${sector}` : product.companyName}</Org>
        <Name>
          {product.productName}
          {product.productStatus === 'CLOSED' && <Tag $variant="warn">판매 종료</Tag>}
        </Name>
      </HeadInfo>
      <CloseButton onClose={onClose} />
    </Head>
  )

  // 숨긴 상품은 상품명과 안내만 (찜, 최근 본, 비교 내역에서 열 때)
  if (product.productStatus === 'HIDDEN') {
    return (
      <Body>
        {head}
        <EmptyBox>지금은 볼 수 없는 상품이에요</EmptyBox>
      </Body>
    )
  }

  const bandRates = product.bandRates ?? []
  const hasRate = product.rateMin != null || product.rateMax != null

  const handleCalc = () => navigate('/calc', { state: buildCalcState(product) })

  return (
    <Body>
      {head}

      <Tiles>
        <Tile>
          <TileLabel>금리</TileLabel>
          <TileValue $isRate>
            {hasRate ? (
              <RateText min={product.rateMin} max={product.rateMax} hasFixedLabel weight={900} unitSize="xs" />
            ) : (
              <Memo>금리는 기관 문의</Memo>
            )}
          </TileValue>
        </Tile>
        <Tile>
          <TileLabel>최대 한도</TileLabel>
          <TileValue>
            {typeof product.limitAmount === 'number' ? (
              <MoneyText value={product.limitAmount} weight={900} unitSize="xs" />
            ) : (
              <Memo>{getTagValues(product, 'AMOUNT')[0] ?? '한도는 기관 문의'}</Memo>
            )}
          </TileValue>
        </Tile>
        <Tile>
          <TileLabel>최대 기간</TileLabel>
          <TileValue>
            {typeof product.termMax === 'number' ? (
              <>
                {product.termMax}
                <Unit>개월</Unit>
              </>
            ) : (
              '-'
            )}
          </TileValue>
        </Tile>
      </Tiles>

      {product.grouped && <Hint>조합마다 금리 다름, 가까운 취급기관 문의</Hint>}

      {bandRates.length > 0 && (
        <SectionBox>
          <SectionTitle>신용 구간별 금리</SectionTitle>
          <Kv>
            {bandRates.map((band) => (
              <BandRow key={band.creditBand} band={band} />
            ))}
          </Kv>
          <Hint>
            {bandRates.some((band) => band.rateSource === 'ESTIMATED') &&
              '추정은 공시된 값이 아니라 추정한 값이에요. '}
            실제 금리는 기관 심사로 정해져요.
          </Hint>
        </SectionBox>
      )}

      {buildSections(product).map((section) => (
        <SectionBox key={section.title}>
          <SectionTitle>{section.title}</SectionTitle>
          <Kv>
            {section.rows.map((row) => (
              <KvRow key={row.label} label={row.label} content={row.content} />
            ))}
          </Kv>
        </SectionBox>
      ))}

      <Actions>
        <Button onClick={handleCalc}>
          이자 계산
          <Icon name="arrow" size={13} />
        </Button>
      </Actions>

      <BaseDateBadge date={product.baseDate} />
      <Disclaimer>실제 심사 결과가 아닌 참고용 정보이고, 예상 금리는 공시된 범위예요.</Disclaimer>
    </Body>
  )
}

function KvRow({ label, content }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{content}</dd>
    </>
  )
}

function BandRow({ band }) {
  return (
    <>
      <dt>{CREDIT_BAND_LABEL[band.creditBand] ?? band.creditBand}</dt>
      <dd>
        <BandValue>
          <RateText min={band.rateMin} max={band.rateMax} />
          {band.rateSource === 'ESTIMATED' && <Tag $variant="warn">추정</Tag>}
        </BandValue>
      </dd>
    </>
  )
}

function ProductDetailSheet() {
  const productId = useUiStore((state) => state.sheetProductId)
  const closeProduct = useUiStore((state) => state.closeProduct)

  // 받은 결과에 어느 상품, 몇 번째 시도였는지 같이 적어 두면 '불러오는 중'을 따로 저장하지 않고 알 수 있다.
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ id: null, attempt: 0, product: null, errorStatus: null })

  // 상품 상세 받기 (E3: 실패하면 문구 + [다시 시도])
  useEffect(() => {
    if (productId === null) return undefined
    let isCancelled = false
    productApi
      .getProduct(productId)
      .then((product) => {
        if (!isCancelled) setResult({ id: productId, attempt, product, errorStatus: null })
      })
      .catch((error) => {
        if (!isCancelled) {
          setResult({ id: productId, attempt, product: null, errorStatus: error.response?.status ?? 0 })
        }
      })
    return () => {
      isCancelled = true
    }
  }, [productId, attempt])

  // 조회 기록은 열릴 때 한 번 (다시 시도에는 다시 보내지 않음). 실패해도 화면에 안 보임
  useEffect(() => {
    if (productId === null) return
    productApi.postProductView(productId).catch(() => {})
  }, [productId])

  // 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (productId === null) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [productId])

  if (productId === null) return null

  const isLoading = result.id !== productId || result.attempt !== attempt

  let body
  if (isLoading) {
    body = (
      <Body>
        <TopBar>
          <CloseButton onClose={closeProduct} />
        </TopBar>
        <Status role="status">불러오는 중이에요</Status>
      </Body>
    )
  } else if (result.product) {
    body = <ProductDetail product={result.product} onClose={closeProduct} />
  } else {
    body = (
      <Body>
        <TopBar>
          <CloseButton onClose={closeProduct} />
        </TopBar>
        {result.errorStatus === 404 ? (
          <EmptyBox>찾을 수 없는 상품이에요</EmptyBox>
        ) : (
          <EmptyBox>
            상품 정보를 불러오지 못했어요
            <Button $size="sm" $variant="outline" onClick={() => setAttempt((count) => count + 1)}>
              다시 시도
            </Button>
          </EmptyBox>
        )}
      </Body>
    )
  }

  return (
    <Modal isOpen onClose={closeProduct} label="상품 상세" isTop showClose={false} isTallOnMobile>
      {body}
    </Modal>
  )
}

export default ProductDetailSheet
