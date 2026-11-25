package chorong.ranking.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.dto.ProductSummaryDTO;
import chorong.product.entity.*;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import chorong.ranking.dto.RankingRequestDTO;
import chorong.ranking.dto.RankingResponseDTO;
import lombok.RequiredArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/*
 * RANK-01, 02 처리 순서 (be_ranking.md)
 * 1. 값 확인: metric(rate, limit, term, views), dir(asc, desc), cat(금융권) 모르는 값은 400 (B1, B2)
 * 2. 게시(ON) 상품만
 * 3. cat이 있으면 SECTOR 태그 값으로 거름 (대분류를 고르면 그 세분류 전체, 대분류 목록은 서버 상수)
 * 4. 기준 정렬: 금리, 한도, 기간 값이 없는 상품은 오름차순, 내림차순 모두 맨 뒤 → 같으면 조회수 → 이름
 * 5. 상위 30개 (B10 랭킹 최대 30)
 * 6. 상품 특징 칸 → features (ProductSummaryDTO.from 한 곳, PROD-01과 같은 변환)
 * 결과는 MemoryCache.RANKING에 저장 (키 = cat, metric, dir 조합), 상품이 바뀌면 MemoryCache가 비움 (B10)
 * 필요한 것(직접 주입): LoanProductRepository, TagRepository, ProductTagRepository, MemoryCache (엔티티, Repository는 product 것 사용)
 * 응답: rankNo(1부터), product, prepayFeeMax, metricValue, total, baseDate
 */
@Service
@RequiredArgsConstructor
public class RankingServiceImpl implements RankingService {
	private final LoanProductRepository loanProductRepository;
	private final TagRepository tagRepository;
	private final ProductTagRepository  productTagRepository;
	private final MemoryCache memoryCache;

	private record GroupDef(String value, List<String> members) {
	}
	private static final int MAX_RANKING = 30;	// 랭킹 최대 개수 (B10)
	private static final List<RankingServiceImpl.GroupDef> FIN_GROUPS = List.of(
			new RankingServiceImpl.GroupDef("은행권", List.of("시중은행", "지방은행", "특수은행", "인터넷은행")),
			new RankingServiceImpl.GroupDef("비은행권", List.of("저축은행", "캐피탈", "생명보험", "신협", "카드사", "손해보험")),
			new RankingServiceImpl.GroupDef("정책금융", List.of("신용보증재단", "서민금융기관", "공공기관", "지자체", "협약 금융회사", "복지기관", "기타")));


	@Override
	@Transactional(readOnly = true)
	public RankingResponseDTO getRanking(RankingRequestDTO request) {
		List<String> catValues = new ArrayList<>();
		// null, 빈 값, 공백만 있는 값은 모두 "전체"로 맞춤 (캐시 키도 같아짐)
		String cat = request.getCat() == null ? "" : request.getCat().trim();

		//DTO의 cat에 값이 있을 때: 대분류를 세분류 목록으로 바꿈 (DB는 아직 읽지 않음)
		if(!cat.isEmpty()) {
			for(RankingServiceImpl.GroupDef val : FIN_GROUPS) {
				if(val.value().equals(cat)) {
					catValues = val.members;
				}
			}
			//GroupDef에서 value를 못 찾아 배열이 비어있을 경우 400 에러 발생
			if(catValues.isEmpty()) throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		// 위에서 모르는 cat은 이미 400이라, 여기서 catValues가 비어 있으면 cat이 없었던 것 (전체)
		boolean hasCat = !catValues.isEmpty();
		// metric, dir 값 확인(400)은 캐시 확인과 DB를 읽기 전에 한다
		Comparator<LoanProduct> comparator = rankingComparator(request.getMetric(), request.getDir());

		// 같은 cat, metric, dir 조합은 캐시에서 바로 응답 (값 확인이 끝난 값만 키로 씀, B10)
		// 인기순(views)은 조회수가 계속 올라가는데 캐시는 상품이 바뀔 때만 비워지므로 캐시하지 않음 (명세서에 없는 선택)
		boolean useCache = !"views".equals(request.getMetric());
		String cacheKey = cat + "|" + request.getMetric() + "|" + request.getDir();
		if (useCache && memoryCache.get(MemoryCache.RANKING, cacheKey) instanceof RankingResponseDTO cached) {
			return cached;
		}

		Set<Long> filterIds = hasCat ? productIdsBySector(catValues) : Set.of();
		List<LoanProduct> productList = loanProductRepository.findByProductStatus(ProductStatus.ON);

		// cat이 있으면 그 금융권 상품만 → 기준값(null은 맨 뒤) → 조회수 → 이름 순 정렬 → 상위 30개
		List<LoanProduct> rankingList = productList.stream()
				.filter(p -> !hasCat || filterIds.contains(p.getProductId()))
				.sorted(comparator)
				.limit(MAX_RANKING)
				.toList();
		
		//rankList에 있는 productId만 가지는 리스트
		List<Long> rankingIds = rankingList.stream().map(LoanProduct::getProductId).collect(Collectors.toList());
		Map<Long, List<Tag>> tagsByProduct = tagsByProduct(rankingIds);
		List<RankingResponseDTO.RankingItem> items = new ArrayList<>();
		// metric에 맞는 기준값을 꺼내는 규칙은 반복문 밖에서 한 번만 받는다 (정렬에 쓴 값과 같은 값)
		Function<LoanProduct, BigDecimal> metricValue = metricValueOf(request.getMetric());

		for(int i = 0; i < rankingList.size(); i++) {
			ProductSummaryDTO summary = ProductSummaryDTO.from(rankingList.get(i),
					tagsByProduct.getOrDefault(rankingList.get(i).getProductId(), List.of()));

			RankingResponseDTO.RankingItem item =
					new RankingResponseDTO.RankingItem(i+1, summary,
							rankingList.get(i).getPrepayFeeMax(), metricValue.apply(rankingList.get(i)));
			items.add(item);
		}
		// 랭킹 기준일 = 게시(ON) 상품 전체 중 가장 최근 baseDate (cat, metric을 바꿔도 같은 값, ON 상품이 없으면 null)
		LocalDateTime baseDate = productList.stream()
				.map(LoanProduct::getBaseDate)
				.filter(Objects::nonNull)
				.max(Comparator.naturalOrder())
				.orElse(null);

		// 캐시에 담은 응답은 여러 요청이 같이 쓰므로 목록을 복사해서 담음 (dto 규칙)
		RankingResponseDTO rankingDTO = new RankingResponseDTO(List.copyOf(items), items.size(), baseDate);
		if (useCache) {
			memoryCache.put(MemoryCache.RANKING, cacheKey, rankingDTO);
		}
		return rankingDTO;
	}

	// 세분류 이름 목록(SECTOR 태그 값)을 가진 상품 번호 모음
	private Set<Long> productIdsBySector(List<String> sectorValues) {
		List<Tag> tags = tagRepository.findByTagTypeAndTagValueIn(TagType.SECTOR, sectorValues);
		// 그 금융권 태그가 DB에 하나도 없으면 빈 IN 쿼리를 보내지 않고 바로 "해당 상품 없음"
		if (tags.isEmpty()) return Set.of();
		//tag_id만 가지는 set으로 변환
		Set<Long> tagIds = tags.stream().map(Tag::getTagId).collect(Collectors.toSet());
		List<ProductTag> productTags = productTagRepository.findByTagIdIn(tagIds);
		//tagIds 중 하나라도 가진 상품의 productId만 가지는 set으로 변환
		return productTags.stream().map(ProductTag::getProductId).collect(Collectors.toSet());
	}





	// metric(rate, limit, term, views)에 맞는 기준값을 BigDecimal로 꺼내는 규칙 (타입이 달라서 BigDecimal로 통일, 응답 metricValue에도 같이 씀)
	private Function<LoanProduct, BigDecimal> metricValueOf(String metric) {
		return switch (metric == null ? "" : metric) {
			case "rate" -> LoanProduct::getRateMin;
			case "limit" -> p -> p.getLimitAmount() == null ? null : BigDecimal.valueOf(p.getLimitAmount());
			case "term" -> p -> p.getTermMax() == null ? null : BigDecimal.valueOf(p.getTermMax());
			case "views" -> p -> p.getViewCount() == null ? null : BigDecimal.valueOf(p.getViewCount());
			default -> throw new BusinessException(ErrorCode.INVALID_INPUT);
		};
	}

	// 정렬 규칙: 기준값 (dir 방향, 값이 없으면 asc, desc 모두 맨 뒤) → 조회수 높은 순 → 상품 이름 가나다순
	private Comparator<LoanProduct> rankingComparator(String metric, String dir) {
		Function<LoanProduct, BigDecimal> metricValue = metricValueOf(metric);
		Comparator<BigDecimal> order;
		if ("asc".equals(dir)) {
			order = Comparator.naturalOrder();
		} else if ("desc".equals(dir)) {
			order = Comparator.reverseOrder();
		} else {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		return Comparator.comparing(metricValue, Comparator.nullsLast(order))
				.thenComparing(LoanProduct::getViewCount, Comparator.nullsLast(Comparator.reverseOrder()))
				.thenComparing(LoanProduct::getProductName, Comparator.nullsLast(Comparator.naturalOrder()));
	}

	private Map<Long, List<Tag>> tagsByProduct(List<Long> productIds) {
		// 결과가 0건이면 빈 IN 쿼리를 보내지 않음
		if (productIds.isEmpty()) return new HashMap<>();
		List<ProductTag> productTags = productTagRepository.findByProductIdIn(productIds);
		Map<Long, List<Tag>> result = new HashMap<>();
		if (productTags.isEmpty()) return result;

		List<Long> tagIds = productTags.stream().map(ProductTag::getTagId).distinct().toList();
		Map<Long, Tag> tagById = new HashMap<>();
		for (Tag tag : tagRepository.findByTagIdInOrderByTagId(tagIds)) {
			tagById.put(tag.getTagId(), tag);
		}
		for (ProductTag productTag : productTags) {
			Tag tag = tagById.get(productTag.getTagId());
			if (tag != null) {
				result.computeIfAbsent(productTag.getProductId(), id -> new ArrayList<>()).add(tag);
			}
		}
		for (List<Tag> tags : result.values()) {
			tags.sort((a, b) -> a.getTagId().compareTo(b.getTagId()));
		}
		return result;
	}
}