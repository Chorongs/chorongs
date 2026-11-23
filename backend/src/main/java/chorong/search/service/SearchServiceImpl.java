package chorong.search.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.dto.ProductSummaryDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.search.dto.FilterChipResponseDTO;
import chorong.search.dto.KeywordSearchRequestDTO;
import chorong.search.dto.KeywordSearchResponseDTO;
import chorong.search.dto.ProductSearchRequestDTO;
import chorong.search.dto.ProductSearchResponseDTO;
import lombok.RequiredArgsConstructor;

/*
 * 검색 (SEARCH-01 상세 검색, 02 간편 검색, 03 필터 칩 목록)
 * 필터 8개 칩 값과 칩 순서는 아래 고정 표 (명세서 엔티티 시트 Tag 값 목록 순서). 요청 값은 이 표와 대조 (B19)
 * 캐시 (MemoryCache.FILTER_CHIP 칸, 상품이 바뀌면 clearProductCaches가 비움): 칩 목록, 태그 전체, 간편 검색 후보 상품
 */
@Service
@RequiredArgsConstructor
public class SearchServiceImpl implements SearchService {

	private static final String RT_NUM = "NUM";
	private static final String RT_MEMO = "MEMO";
	private static final String SORT_BASE = "base";
	private static final String SORT_RATE = "rate";
	private static final String SORT_LIMIT = "limit";
	private static final String SORT_VIEWS = "views";

	private static final int DEFAULT_PAGE = 1;
	private static final int DEFAULT_SIZE = 20;
	private static final int MAX_SIZE = 50;				// 쪽 크기 최대 (B10)
	private static final int MAX_FILTER_CHIPS = 20;		// 한 필터에서 고를 수 있는 칩 (B19)
	private static final int MAX_KEYWORDS = 5;			// 고를 수 있는 키워드 (B19)
	private static final int MAX_KEYWORD_ITEMS = 5;		// 간편 검색 결과 상품 수
	private static final long NO_ID = -1L;				// 빈 IN 목록 대신 보내는 번호 (없는 번호)

	private static final String CACHE_CHIPS = "chips";
	private static final String CACHE_TAGS = "tags";
	private static final String CACHE_CANDIDATES = "candidates";

	// 검색어 q로 찾는 칩 종류 (금융권, 취급기관, 지원 지역, 지원 대상, 자금 용도)
	private static final Set<TagType> Q_TAG_TYPES = EnumSet.of(TagType.SECTOR, TagType.COMPANY, TagType.REGION,
			TagType.TARGET, TagType.PURPOSE);

	// 값을 하나라도 고르면 같이 찾는 '누구나, 어디나' 칩 (요청서 D1: 서울을 고르면 전국 상품도)
	private static final Map<String, String> WILDCARD = Map.of(
			"target", "제한 없음",
			"region", "전국",
			"credit", "신용 무관");

	// 필터: key = 주소 값 이름, values = 고정 칩 목록 (칩 순서 그대로)
	private record FilterDef(String key, String name, TagType tagType, List<String> values) {
	}

	// 금융권 대분류 (서버 상수, DB에는 세분류만 있음)
	private record GroupDef(String value, List<String> members) {
	}

	// 간편 검색 후보: 게시 상품 + 붙은 칩
	private record Candidate(LoanProduct product, List<Tag> tags, Map<TagType, Set<String>> tagValues) {
	}

	// 간편 검색 상품 한 개의 판정 결과
	private record Scored(Candidate candidate, List<String> matched, List<String> reasons) {
	}

	// 비교함 기준 상품 (요청서 A): ids = 비교함 상품 번호 (항상 보임), purposes = 기준 상품의 자금 용도 칩 값,
	// methods = 기준 상품의 상환 방식 칩 값 (원리금균등, 원금균등, 만기일시 중. 이 셋이 하나도 없으면 셋 모두)
	private record CmpBase(Set<Long> ids, Set<String> purposes, Set<String> methods) {
	}

	private static final int MAX_CMP = 2;							// 비교함 상품 수
	private static final List<String> REPAY_METHODS = List.of("원리금균등", "원금균등", "만기일시");

	private static final List<GroupDef> FIN_GROUPS = List.of(
			new GroupDef("은행권", List.of("시중은행", "지방은행", "특수은행", "인터넷은행")),
			new GroupDef("비은행권", List.of("저축은행", "캐피탈", "생명보험", "신협", "카드사", "손해보험")),
			new GroupDef("정책금융", List.of("신용보증재단", "서민금융기관", "공공기관", "지자체", "협약 금융회사", "복지기관", "기타")));

	private static final List<FilterDef> FILTERS = List.of(
			new FilterDef("target", "지원 대상", TagType.TARGET,
					List.of("제한 없음", "청년/학생", "직장인", "저신용/서민", "사업자", "특별 지원 대상", "기타")),
			new FilterDef("purpose", "자금 용도", TagType.PURPOSE,
					List.of("생활비", "전월세", "학자금", "주택 구입", "대환", "창업", "사업 운영", "기타")),
			new FilterDef("amount", "필요 금액", TagType.AMOUNT,
					List.of("1천만원 미만", "1천만원 이상", "3천만원 이상", "5천만원 이상", "1억원 이상", "담보/보증 비율",
							"한도 제한 없음", "매출/실비 기준", "심사 후 결정")),
			new FilterDef("repay", "상환 방법", TagType.REPAY,
					List.of("원리금균등", "원금균등", "만기일시", "분할상환(방식 미표기)", "기타")),
			new FilterDef("fin", "금융권", TagType.SECTOR,
					FIN_GROUPS.stream().flatMap(group -> group.members().stream()).toList()),
			new FilterDef("inst", "취급기관", TagType.COMPANY,
					List.of("은행", "공공기관", "서민금융센터/미소금융", "저축은행", "신협/새마을금고", "카드사", "캐피탈", "보험사",
							"신용보증재단", "지자체", "기타")),
			new FilterDef("region", "지원 지역", TagType.REGION,
					List.of("전국", "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남",
							"전북", "전남", "경북", "경남", "제주")),
			new FilterDef("credit", "신용점수 구간", TagType.CREDIT,
					List.of("900 초과", "801~900", "701~800", "601~700", "600 이하", "신용 무관", "심사 후 결정")));

	private final LoanProductRepository loanProductRepository;
	private final TagRepository tagRepository;
	private final ProductTagRepository productTagRepository;
	private final MemoryCache memoryCache;
	private final KeywordRule keywordRule;

	// ---------------------------------------------------------------- SEARCH-01 상세 검색

	@Override
	@Transactional(readOnly = true)
	public ProductSearchResponseDTO searchProducts(ProductSearchRequestDTO request) {
		// 1. 값 확인 (정해진 코드만)
		String q = request.getQ() == null ? "" : request.getQ().trim();
		String rt = request.getRt() == null ? RT_NUM : request.getRt();
		String sort = request.getSort() == null ? SORT_BASE : request.getSort();
		int page = request.getPage() == null ? DEFAULT_PAGE : request.getPage();
		int size = request.getSize() == null ? DEFAULT_SIZE : request.getSize();
		if ((!RT_NUM.equals(rt) && !RT_MEMO.equals(rt)) || !isKnownSort(sort) || page < 1 || size < 1
				|| size > MAX_SIZE) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		// 금리 기관 문의 탭에는 금리 낮은 순이 없음 (기본 순으로)
		if (RT_MEMO.equals(rt) && SORT_RATE.equals(sort)) {
			sort = SORT_BASE;
		}
		Map<String, List<String>> selected = readFilters(request);
		List<Long> cmpIds = readCmpIds(request.getCmp());

		// 3. 필터: 고른 필터마다 칩 번호 모으기. 칩이 DB에 하나도 없는 필터가 있으면 맞는 상품이 없음
		List<Tag> allTags = getAllTags();
		Set<Long> tagIds = new HashSet<>();
		long groupCount = 0;
		for (FilterDef def : FILTERS) {
			List<String> values = selected.get(def.key());
			if (values.isEmpty()) {
				continue;
			}
			Set<String> wanted = new HashSet<>(values);
			String wildcard = WILDCARD.get(def.key());
			if (wildcard != null) {
				wanted.add(wildcard);
			}
			List<Long> ids = allTags.stream()
					.filter(tag -> tag.getTagType() == def.tagType() && wanted.contains(tag.getTagValue()))
					.map(Tag::getTagId)
					.toList();
			if (ids.isEmpty()) {
				return new ProductSearchResponseDTO(List.of(), 0L, page, size, 0, 0, 0);
			}
			tagIds.addAll(ids);
			groupCount++;
		}

		// 비교함 기준 (cmp): 기준 상품(첫 번호)이 게시(ON)가 아니거나 없으면 거르지 않음
		CmpBase cmpBase = findCmpBase(cmpIds, allTags);
		int useCmp = cmpBase == null ? 0 : 1;
		List<Long> cmpIdsArg = cmpBase == null ? List.of(NO_ID) : List.copyOf(cmpBase.ids());
		List<Long> cmpPurposeArg = cmpBase == null ? List.of(NO_ID) : tagIdsOf(allTags, TagType.PURPOSE, cmpBase.purposes());
		List<Long> allMethodArg = tagIdsOf(allTags, TagType.REPAY, REPAY_METHODS);
		List<Long> cmpMethodArg = cmpBase == null ? List.of(NO_ID) : tagIdsOf(allTags, TagType.REPAY, cmpBase.methods());

		// 6. 검색어 q: 상품명, 취급기관명 (Repository에서) + 상품 칩 값 (여기서 칩 번호로)
		String lowerQ = q.toLowerCase(Locale.ROOT);
		List<Long> qTagIds = q.isEmpty() ? List.of() : allTags.stream()
				.filter(tag -> Q_TAG_TYPES.contains(tag.getTagType())
						&& tag.getTagValue().toLowerCase(Locale.ROOT).contains(lowerQ))
				.map(Tag::getTagId)
				.toList();

		// 2, 4, 5, 7. 게시 상품만, 금리 탭, 정렬, 쪽 나눔 (같은 상품은 1번만)
		int useQ = q.isEmpty() ? 0 : 1;
		int useTags = tagIds.isEmpty() ? 0 : 1;
		String qArg = q.isEmpty() ? "" : lowerQ;
		List<Long> qIdsArg = qTagIds.isEmpty() ? List.of(NO_ID) : qTagIds;
		List<Long> tagIdsArg = tagIds.isEmpty() ? List.of(NO_ID) : List.copyOf(tagIds);
		Pageable pageable = PageRequest.of(page - 1, size, buildSort(sort));
		Page<LoanProduct> result = loanProductRepository.searchProducts(ProductStatus.ON, rateMode(rt), useQ, qArg,
				qIdsArg, useTags, tagIdsArg, groupCount, useCmp, cmpIdsArg, cmpPurposeArg, allMethodArg, cmpMethodArg,
				pageable);

		// 8. 금리 안내, 금리 기관 문의 건수는 rt 조건을 뺀 값 (다른 탭 건수는 한 줄만 받아 건수만 읽음)
		String otherRt = RT_NUM.equals(rt) ? RT_MEMO : RT_NUM;
		long otherTotal = loanProductRepository.searchProducts(ProductStatus.ON, rateMode(otherRt), useQ, qArg, qIdsArg,
				useTags, tagIdsArg, groupCount, useCmp, cmpIdsArg, cmpPurposeArg, allMethodArg, cmpMethodArg,
				PageRequest.of(0, 1)).getTotalElements();
		int thisCount = Math.toIntExact(result.getTotalElements());
		int otherCount = Math.toIntExact(otherTotal);
		int numCount = RT_NUM.equals(rt) ? thisCount : otherCount;
		int memoCount = RT_NUM.equals(rt) ? otherCount : thisCount;

		// 숨긴 상품 수: 비교함 기준을 뺀 같은 검색의 지금 금리 탭 건수 - 거른 뒤 건수 (비교함 기준이 없으면 0)
		int hiddenCount = 0;
		if (useCmp == 1) {
			long unfiltered = loanProductRepository.searchProducts(ProductStatus.ON, rateMode(rt), useQ, qArg, qIdsArg,
					useTags, tagIdsArg, groupCount, 0, List.of(NO_ID), List.of(NO_ID), List.of(NO_ID), List.of(NO_ID),
					PageRequest.of(0, 1)).getTotalElements();
			hiddenCount = Math.toIntExact(unfiltered - result.getTotalElements());
		}

		return new ProductSearchResponseDTO(List.copyOf(toSummaries(result.getContent())), result.getTotalElements(),
				page, size, numCount, memoCount, hiddenCount);
	}

	// cmp 읽기: 숫자 1~2개 (쉼표). 숫자가 아니거나 3개 이상이면 400. 비었으면 빈 목록 (거르지 않음)
	private List<Long> readCmpIds(String cmp) {
		if (cmp == null || cmp.isBlank()) {
			return List.of();
		}
		Set<Long> ids = new LinkedHashSet<>();
		String[] parts = cmp.split(",", -1);
		if (parts.length > MAX_CMP) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		for (String part : parts) {
			String text = part.trim();
			if (!text.matches("[0-9]{1,18}")) {
				throw new BusinessException(ErrorCode.INVALID_INPUT);
			}
			ids.add(Long.parseLong(text));
		}
		return List.copyOf(ids);
	}

	// 비교함 기준 상품의 용도, 상환 방식 칩 읽기. 첫 번호 상품이 없거나 게시(ON)가 아니면 null (요청서 C2)
	private CmpBase findCmpBase(List<Long> cmpIds, List<Tag> allTags) {
		if (cmpIds.isEmpty()) {
			return null;
		}
		LoanProduct base = loanProductRepository.findById(cmpIds.get(0)).orElse(null);
		if (base == null || base.getProductStatus() != ProductStatus.ON) {
			return null;
		}
		Map<Long, Tag> tagById = new HashMap<>();
		for (Tag tag : allTags) {
			tagById.put(tag.getTagId(), tag);
		}
		Set<String> purposes = new HashSet<>();
		Set<String> methods = new HashSet<>();
		for (ProductTag productTag : productTagRepository.findByProductIdIn(List.of(base.getProductId()))) {
			Tag tag = tagById.get(productTag.getTagId());
			if (tag == null) {
				continue;
			}
			if (tag.getTagType() == TagType.PURPOSE) {
				purposes.add(tag.getTagValue());
			} else if (tag.getTagType() == TagType.REPAY && REPAY_METHODS.contains(tag.getTagValue())) {
				methods.add(tag.getTagValue());
			}
		}
		// 세 방식이 하나도 없으면 방식 정보가 없는 상품: 세 방식 모두 가능
		if (methods.isEmpty()) {
			methods.addAll(REPAY_METHODS);
		}
		return new CmpBase(Set.copyOf(cmpIds), Set.copyOf(purposes), Set.copyOf(methods));
	}

	// 칩 종류, 값 -> 칩 번호 목록 (없으면 -1 하나)
	private List<Long> tagIdsOf(List<Tag> allTags, TagType type, Collection<String> values) {
		List<Long> ids = allTags.stream()
				.filter(tag -> tag.getTagType() == type && values.contains(tag.getTagValue()))
				.map(Tag::getTagId)
				.toList();
		return ids.isEmpty() ? List.of(NO_ID) : ids;
	}

	// 비교함 기준을 통과하는지 (간편 검색, 메모리 판정). 규칙은 위 searchProducts 쿼리, 프론트 E15와 같음
	private boolean passesCmp(CmpBase cmp, Candidate candidate) {
		if (cmp.ids().contains(candidate.product().getProductId())) {
			return true;
		}
		Set<String> purposes = candidate.tagValues().getOrDefault(TagType.PURPOSE, Set.of());
		if (purposes.stream().noneMatch(cmp.purposes()::contains)) {
			return false;
		}
		Set<String> own = new HashSet<>(candidate.tagValues().getOrDefault(TagType.REPAY, Set.of()));
		own.retainAll(REPAY_METHODS);
		return own.isEmpty() || own.stream().anyMatch(cmp.methods()::contains);
	}

	private boolean isKnownSort(String sort) {
		return SORT_BASE.equals(sort) || SORT_RATE.equals(sort) || SORT_LIMIT.equals(sort) || SORT_VIEWS.equals(sort);
	}

	// 정해진 정렬 값 -> 컬럼 (B1). 같은 값이면 기본 순 (취급기관 가나다 -> 상품명 가나다), 금리, 한도 없는 상품은 맨 뒤
	private Sort buildSort(String sort) {
		Sort base = Sort.by(Sort.Order.asc("companyName"), Sort.Order.asc("productName"), Sort.Order.asc("productId"));
		return switch (sort) {
			case SORT_RATE -> Sort.by(Sort.Order.asc("rateMin").nullsLast()).and(base);
			case SORT_LIMIT -> Sort.by(Sort.Order.desc("limitAmount").nullsLast()).and(base);
			case SORT_VIEWS -> Sort.by(Sort.Order.desc("viewCount")).and(base);
			default -> base;
		};
	}

	// 금리 탭 -> Repository 값 (1 금리 숫자 있는 상품, 2 없는 상품)
	private int rateMode(String rt) {
		return RT_NUM.equals(rt) ? 1 : 2;
	}

	// 필터 8개 값 읽기: 쉼표로 나눠 중복을 빼고, 20개 초과나 고정 목록에 없는 값은 400 (B19)
	private Map<String, List<String>> readFilters(ProductSearchRequestDTO request) {
		Map<String, List<String>> selected = new LinkedHashMap<>();
		for (FilterDef def : FILTERS) {
			selected.put(def.key(), parseValues(filterText(request, def.key()), def));
		}
		return selected;
	}

	private String filterText(ProductSearchRequestDTO request, String key) {
		return switch (key) {
			case "target" -> request.getTarget();
			case "purpose" -> request.getPurpose();
			case "amount" -> request.getAmount();
			case "repay" -> request.getRepay();
			case "fin" -> request.getFin();
			case "inst" -> request.getInst();
			case "region" -> request.getRegion();
			case "credit" -> request.getCredit();
			default -> null;
		};
	}

	private List<String> parseValues(String text, FilterDef def) {
		if (text == null || text.isBlank()) {
			return List.of();
		}
		Set<String> values = new LinkedHashSet<>();
		for (String part : text.split(",")) {
			String value = part.trim();
			if (!value.isEmpty()) {
				values.add(value);
			}
		}
		if (values.size() > MAX_FILTER_CHIPS) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		for (String value : values) {
			if (!def.values().contains(value)) {
				throw new BusinessException(ErrorCode.INVALID_INPUT);
			}
		}
		return List.copyOf(values);
	}

	// 상품 목록 -> 한 줄 목록 (칩은 한 번에 읽음)
	private List<ProductSummaryDTO> toSummaries(List<LoanProduct> products) {
		if (products.isEmpty()) {
			return List.of();
		}
		Map<Long, Tag> tagById = new HashMap<>();
		for (Tag tag : getAllTags()) {
			tagById.put(tag.getTagId(), tag);
		}
		List<Long> ids = products.stream().map(LoanProduct::getProductId).toList();
		Map<Long, List<Tag>> tagsByProduct = new HashMap<>();
		for (ProductTag productTag : productTagRepository.findByProductIdIn(ids)) {
			Tag tag = tagById.get(productTag.getTagId());
			if (tag != null) {
				tagsByProduct.computeIfAbsent(productTag.getProductId(), id -> new ArrayList<>()).add(tag);
			}
		}
		List<ProductSummaryDTO> summaries = new ArrayList<>();
		for (LoanProduct product : products) {
			List<Tag> tags = new ArrayList<>(tagsByProduct.getOrDefault(product.getProductId(), List.of()));
			tags.sort(Comparator.comparing(Tag::getTagId));
			summaries.add(ProductSummaryDTO.from(product, tags));
		}
		return summaries;
	}

	// 태그 전체 (칩 마스터, 100개 안팎). 상품이 바뀌면 캐시와 같이 비워짐
	private List<Tag> getAllTags() {
		Object cached = memoryCache.get(MemoryCache.FILTER_CHIP, CACHE_TAGS);
		if (cached instanceof List<?> list) {
			return list.stream().map(Tag.class::cast).toList();
		}
		List<Tag> tags = List.copyOf(tagRepository.findAll());
		memoryCache.put(MemoryCache.FILTER_CHIP, CACHE_TAGS, tags);
		return tags;
	}

	// ---------------------------------------------------------------- SEARCH-03 필터 칩 목록

	@Override
	@Transactional(readOnly = true)
	public FilterChipResponseDTO getFilterChips() {
		// 1. 캐시에 있으면 그대로
		Object cached = memoryCache.get(MemoryCache.FILTER_CHIP, CACHE_CHIPS);
		if (cached instanceof FilterChipResponseDTO response) {
			return response;
		}

		// 2. 게시 상품의 칩을 칩별로 모음 (칩 하나에 상품은 1번만)
		Map<Long, Set<Long>> productsByTag = new HashMap<>();
		for (Object[] pair : productTagRepository.findTagPairsByProductStatus(ProductStatus.ON)) {
			Long tagId = ((Number) pair[0]).longValue();
			Long productId = ((Number) pair[1]).longValue();
			productsByTag.computeIfAbsent(tagId, id -> new HashSet<>()).add(productId);
		}

		// 3, 4. 고정 표 순서로 칩을 만들고 상품 수 0인 칩은 뺌
		List<Tag> allTags = getAllTags();
		List<FilterChipResponseDTO.FilterItem> filters = new ArrayList<>();
		for (FilterDef def : FILTERS) {
			Map<String, Long> idByValue = new HashMap<>();
			for (Tag tag : allTags) {
				if (tag.getTagType() == def.tagType()) {
					idByValue.put(tag.getTagValue(), tag.getTagId());
				}
			}
			List<FilterChipResponseDTO.ChipItem> chips = new ArrayList<>();
			for (String value : def.values()) {
				int count = countOf(idByValue.get(value), productsByTag);
				if (count > 0) {
					chips.add(new FilterChipResponseDTO.ChipItem(value, value, count));
				}
			}
			List<FilterChipResponseDTO.GroupItem> groups = "fin".equals(def.key())
					? buildGroups(idByValue, productsByTag)
					: List.of();
			filters.add(new FilterChipResponseDTO.FilterItem(def.key(), def.name(), List.copyOf(chips),
					List.copyOf(groups)));
		}
		FilterChipResponseDTO response = new FilterChipResponseDTO(List.copyOf(filters));
		memoryCache.put(MemoryCache.FILTER_CHIP, CACHE_CHIPS, response);
		return response;
	}

	private int countOf(Long tagId, Map<Long, Set<Long>> productsByTag) {
		return tagId == null ? 0 : productsByTag.getOrDefault(tagId, Set.of()).size();
	}

	// 금융권 대분류: 소속 세분류 중 상품 수 있는 것만 members에, 상품 수는 세분류 하나라도 붙은 상품 (1번만)
	private List<FilterChipResponseDTO.GroupItem> buildGroups(Map<String, Long> idByValue,
			Map<Long, Set<Long>> productsByTag) {
		List<FilterChipResponseDTO.GroupItem> groups = new ArrayList<>();
		for (GroupDef group : FIN_GROUPS) {
			Set<Long> products = new HashSet<>();
			List<String> members = new ArrayList<>();
			for (String member : group.members()) {
				Long tagId = idByValue.get(member);
				if (countOf(tagId, productsByTag) > 0) {
					members.add(member);
					products.addAll(productsByTag.get(tagId));
				}
			}
			if (!products.isEmpty()) {
				groups.add(new FilterChipResponseDTO.GroupItem(group.value(), group.value(), products.size(),
						List.copyOf(members)));
			}
		}
		return groups;
	}

	// ---------------------------------------------------------------- SEARCH-02 간편 검색

	@Override
	@Transactional(readOnly = true)
	public KeywordSearchResponseDTO searchKeywords(KeywordSearchRequestDTO request) {
		// 1. 정해진 키워드만 (중복은 뺌), 최대 5개
		List<String> keywords = readKeywords(request);
		List<Long> cmpIds = readCmpIds(request.getCmp());
		CmpBase cmpBase = findCmpBase(cmpIds, getAllTags());

		// 2, 3. 게시이고 금리 숫자 있는 상품마다 키워드별 충족 여부와 이유 문구
		List<Scored> scored = new ArrayList<>();
		int hiddenCount = 0;
		for (Candidate candidate : getCandidates()) {
			List<String> matched = new ArrayList<>();
			List<String> reasons = new ArrayList<>();
			for (String keyword : keywords) {
				String reason = keywordRule.judge(keyword, candidate.product(), candidate.tagValues());
				if (reason != null) {
					matched.add(keyword);
					reasons.add(reason);
				}
			}
			// 4. 충족 키워드 1개 이상인 상품만
			if (!matched.isEmpty()) {
				// 비교함 기준에 안 맞는 상품은 빼고 숨긴 수만 셈
				if (cmpBase != null && !passesCmp(cmpBase, candidate)) {
					hiddenCount++;
				} else {
					scored.add(new Scored(candidate, matched, reasons));
				}
			}
		}

		// 충족 수 많은 순 -> 최저 금리 낮은 순 -> 취급기관 가나다 -> 상품명 가나다
		scored.sort(Comparator.comparingInt((Scored s) -> -s.matched().size())
				.thenComparing(s -> s.candidate().product().getRateMin(), Comparator.nullsLast(Comparator.naturalOrder()))
				.thenComparing(s -> s.candidate().product().getCompanyName(), Comparator.nullsLast(Comparator.naturalOrder()))
				.thenComparing(s -> s.candidate().product().getProductName(), Comparator.nullsLast(Comparator.naturalOrder())));

		// 5. 상위 5개 + 이유 문구 + 1위 상품이 못 맞춘 키워드
		List<KeywordSearchResponseDTO.Item> items = new ArrayList<>();
		for (Scored s : scored.subList(0, Math.min(MAX_KEYWORD_ITEMS, scored.size()))) {
			items.add(new KeywordSearchResponseDTO.Item(
					ProductSummaryDTO.from(s.candidate().product(), s.candidate().tags()),
					List.copyOf(s.reasons()), s.matched().size()));
		}
		List<String> missed = new ArrayList<>();
		if (!scored.isEmpty()) {
			for (String keyword : keywords) {
				if (!scored.get(0).matched().contains(keyword)) {
					missed.add(keyword);
				}
			}
		}
		return new KeywordSearchResponseDTO(List.copyOf(items), List.copyOf(missed), hiddenCount);
	}

	// 키워드 확인 (B19): 모르는 키워드, 없음, 중복을 뺀 6개 이상은 400
	private List<String> readKeywords(KeywordSearchRequestDTO request) {
		if (request.getKeywords() == null) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		Set<String> unique = new LinkedHashSet<>();
		for (String keyword : request.getKeywords()) {
			if (!keywordRule.isKnown(keyword)) {
				throw new BusinessException(ErrorCode.INVALID_INPUT);
			}
			unique.add(keyword);
		}
		if (unique.isEmpty() || unique.size() > MAX_KEYWORDS) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		return List.copyOf(unique);
	}

	// 간편 검색 후보: 게시이고 금리 숫자가 있는 상품 + 칩. 캐시가 비었으면 새 목록을 다 만든 뒤 한 번에 넣음
	private List<Candidate> getCandidates() {
		Object cached = memoryCache.get(MemoryCache.FILTER_CHIP, CACHE_CANDIDATES);
		if (cached instanceof List<?> list) {
			return list.stream().map(Candidate.class::cast).toList();
		}

		Map<Long, Tag> tagById = new HashMap<>();
		for (Tag tag : getAllTags()) {
			tagById.put(tag.getTagId(), tag);
		}
		Map<Long, List<Tag>> tagsByProduct = new HashMap<>();
		for (ProductTag productTag : productTagRepository.findAll()) {
			Tag tag = tagById.get(productTag.getTagId());
			if (tag != null) {
				tagsByProduct.computeIfAbsent(productTag.getProductId(), id -> new ArrayList<>()).add(tag);
			}
		}

		List<Candidate> candidates = new ArrayList<>();
		for (LoanProduct product : loanProductRepository.findByProductStatus(ProductStatus.ON)) {
			if (product.getRateMin() == null && product.getRateMax() == null) {
				continue;
			}
			List<Tag> tags = new ArrayList<>(tagsByProduct.getOrDefault(product.getProductId(), List.of()));
			tags.sort(Comparator.comparing(Tag::getTagId));
			Map<TagType, Set<String>> tagValues = new EnumMap<>(TagType.class);
			for (Tag tag : tags) {
				tagValues.computeIfAbsent(tag.getTagType(), type -> new HashSet<>()).add(tag.getTagValue());
			}
			candidates.add(new Candidate(product, List.copyOf(tags), tagValues));
		}
		List<Candidate> result = List.copyOf(candidates);
		memoryCache.put(MemoryCache.FILTER_CHIP, CACHE_CANDIDATES, result);
		return result;
	}
}
