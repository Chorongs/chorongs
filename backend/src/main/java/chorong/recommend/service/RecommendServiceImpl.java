package chorong.recommend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.dto.ProductSummaryDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductRate;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.RateKind;
import chorong.product.entity.Tag;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductRateRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.recommend.dto.EligibilityResponseDTO;
import chorong.recommend.dto.RecommendItemDTO;
import chorong.recommend.dto.RecommendRequestDTO;
import chorong.recommend.dto.RecommendResponseDTO;
import chorong.recommend.service.RecommendRule.Candidate;
import chorong.recommend.service.RecommendRule.Evaluation;
import chorong.recommend.service.RecommendRule.Filter;
import chorong.recommend.service.RecommendRule.Relax;
import lombok.RequiredArgsConstructor;

/*
 * 맞춤 추천 (LOAN-01, 02), 내 조건 판정 (LOAN-05)
 * 후보 = 게시 상품 (메모리 캐시) -> RecommendRule로 판정 -> 일치도 정렬 -> 상위 30개
 * 입력값은 계산에만 쓰고 DB, 로그에 남기지 않음 (B8)
 */
@Service
@RequiredArgsConstructor
public class RecommendServiceImpl implements RecommendService {

	private static final int MAX_ITEMS = 30;
	private static final String CANDIDATE_KEY = "ON";	// MemoryCache.RECOMMEND 칸 안 키

	private static final String NOTE_EMPTY = "조건에 맞는 상품을 찾지 못했어요";
	private static final String NOTE_OVERDUE = "최근 1년 안에 연체가 있으면 금융회사 심사에서 승인이 어려울 수 있어요";
	private static final String NOTE_BIRTH = "회원 생년월일로 확인했어요";
	private static final String NOTE_DEBT_UNKNOWN = "기존 대출 정보가 없어서 정확도가 낮아요";

	private final LoanProductRepository loanProductRepository;
	private final TagRepository tagRepository;
	private final ProductTagRepository productTagRepository;
	private final ProductRateRepository productRateRepository;
	private final MemoryCache memoryCache;
	private final RecommendRule recommendRule;

	// 판정에 쓰는 나이 범위 (회원 생년월일이 있으면 그 나이 하나)
	private record AgeRange(int min, int max, boolean birthNote) {}

	@Override
	@Transactional(readOnly = true)
	public RecommendResponseDTO getRecommendations(RecommendRequestDTO request, LoginMemberDTO loginMember) {
		validate(request);
		List<Candidate> candidates = getCandidates();
		if (candidates.isEmpty()) {
			// 게시 상품이 아예 없음 = 데이터 문제 (걸러서 0건과 다름)
			throw new BusinessException(ErrorCode.SERVER_ERROR);
		}
		AgeRange age = ageRange(request, loginMember);

		// 1. 걸러내기 + 항목 판정, 제외는 처음 걸린 사유 1개로만 셈
		Map<Filter, Integer> excludedCounts = new EnumMap<>(Filter.class);
		List<Evaluation> passed = new ArrayList<>();
		for (Candidate candidate : candidates) {
			Evaluation e = recommendRule.evaluate(candidate, request, age.min(), age.max());
			if (e.failed != null) {
				excludedCounts.merge(e.failed, 1, Integer::sum);
			} else {
				passed.add(e);
			}
		}

		// 2. 후보 안 금리, 월 상환 순위 -> 일치도
		rankRatesAndPayments(passed);
		for (Evaluation e : passed) {
			e.matchRate = recommendRule.matchRate(recommendRule.conditionScore(e),
					recommendRule.priorityScore(e, request.getPriorities()));
		}

		// 3. 정렬 -> 상위 30개
		passed.sort(Comparator
				.comparingDouble((Evaluation e) -> -e.matchRate)
				.thenComparing(e -> e.rateMid, Comparator.nullsLast(Comparator.naturalOrder()))
				.thenComparing(e -> e.candidate.getProduct().getCompanyName(), Comparator.nullsLast(Comparator.naturalOrder()))
				.thenComparing(e -> e.candidate.getProduct().getProductName(), Comparator.nullsLast(Comparator.naturalOrder())));

		List<RecommendItemDTO> items = new ArrayList<>();
		for (int i = 0; i < Math.min(MAX_ITEMS, passed.size()); i++) {
			items.add(toItem(i + 1, passed.get(i), request));
		}

		List<RecommendResponseDTO.ExcludedItem> excluded = new ArrayList<>();
		for (Filter filter : Filter.values()) {
			Integer count = excludedCounts.get(filter);
			if (count != null) {
				excluded.add(new RecommendResponseDTO.ExcludedItem(filter.getSummary(), count));
			}
		}

		String hint = passed.isEmpty() ? hint(candidates, request, age) : null;
		return new RecommendResponseDTO(passed.size(), excluded, notes(request, age, passed.isEmpty()), hint, items);
	}

	@Override
	@Transactional(readOnly = true)
	public EligibilityResponseDTO getEligibility(Long productId, RecommendRequestDTO request, LoginMemberDTO loginMember) {
		validate(request);
		Candidate candidate = getCandidates().stream()
				.filter(c -> productId.equals(c.getProduct().getProductId()))
				.findFirst()
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		AgeRange age = ageRange(request, loginMember);

		Evaluation e = recommendRule.evaluate(candidate, request, age.min(), age.max());
		List<String> reasons = e.failed != null
				? List.of(e.failed.getReason())
				: recommendRule.reasons(e, request.getPriorities(), false);
		return new EligibilityResponseDTO(recommendRule.eligibilityResult(e), reasons,
				e.estRateMin, e.estRateMax, e.estRateMin == null ? null : e.rateEstimated,
				e.monthlyPayment, e.calcNote);
	}

	// 표시로 못 하는 검사 (B2): 용도에 맞는 갚을 기간, 우선순위 중복, 기존 대출 값
	private void validate(RecommendRequestDTO request) {
		if (!RecommendRule.isValidMonths(request.getPurpose(), request.getMonths())) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "갚을 기간을 확인해 주세요.");
		}
		if (new HashSet<>(request.getPriorities()).size() != request.getPriorities().size()) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "가장 중요한 것을 확인해 주세요.");
		}
		if (!Boolean.TRUE.equals(request.getDebtUnknown()) && request.getDebtMonthly() == null) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "기존 대출 월 상환을 확인해 주세요.");
		}
	}

	// 회원은 세션 생년월일 나이가 고른 나이보다 우선
	private AgeRange ageRange(RecommendRequestDTO request, LoginMemberDTO loginMember) {
		int memberAge = loginMember == null ? -1
				: RecommendRule.ageOf(loginMember.getBirthYear(), loginMember.getBirthDay(), LocalDate.now());
		boolean birthNote = memberAge >= 0 && !RecommendRule.ageGroupOf(memberAge).equals(request.getAgeGroup());
		return new AgeRange(RecommendRule.ageMinOf(request.getAgeGroup(), memberAge),
				RecommendRule.ageMaxOf(request.getAgeGroup(), memberAge), birthNote);
	}

	// 추천 후보 (게시 상품 + 태그 + 신용 구간 금리). 캐시가 비었으면 새 목록을 다 만든 뒤 한 번에 넣음
	private List<Candidate> getCandidates() {
		Object cached = memoryCache.get(MemoryCache.RECOMMEND, CANDIDATE_KEY);
		if (cached instanceof List<?> list) {
			return list.stream().map(Candidate.class::cast).toList();
		}

		List<LoanProduct> products = loanProductRepository.findByProductStatus(ProductStatus.ON);
		if (products.isEmpty()) return List.of();

		Map<Long, Tag> tagById = new HashMap<>();
		for (Tag tag : tagRepository.findAll()) {
			tagById.put(tag.getTagId(), tag);
		}
		Map<Long, List<Tag>> tagsByProduct = new HashMap<>();
		for (ProductTag productTag : productTagRepository.findAll()) {
			Tag tag = tagById.get(productTag.getTagId());
			if (tag != null) {
				tagsByProduct.computeIfAbsent(productTag.getProductId(), id -> new ArrayList<>()).add(tag);
			}
		}
		Map<Long, List<ProductRate>> ratesByProduct = new HashMap<>();
		for (ProductRate rate : productRateRepository.findByRateKind(RateKind.CREDIT)) {
			ratesByProduct.computeIfAbsent(rate.getProductId(), id -> new ArrayList<>()).add(rate);
		}

		List<Candidate> candidates = new ArrayList<>();
		for (LoanProduct product : products) {
			List<Tag> tags = new ArrayList<>(tagsByProduct.getOrDefault(product.getProductId(), List.of()));
			tags.sort(Comparator.comparing(Tag::getTagId));
			candidates.add(new Candidate(product, tags,
					ratesByProduct.getOrDefault(product.getProductId(), List.of())));
		}
		List<Candidate> result = List.copyOf(candidates);
		memoryCache.put(MemoryCache.RECOMMEND, CANDIDATE_KEY, result);
		return result;
	}

	// 후보 안 예상 금리 가운데 값, 월 상환 순위 (낮을수록 1등)
	private void rankRatesAndPayments(List<Evaluation> passed) {
		List<BigDecimal> rates = passed.stream().map(e -> e.rateMid).filter(Objects::nonNull).toList();
		List<Long> payments = passed.stream().map(e -> e.monthlyPayment).filter(Objects::nonNull).toList();
		for (Evaluation e : passed) {
			if (e.rateMid != null) {
				e.rateRank = RecommendRule.rankOf(e.rateMid, rates);
				e.rateCount = rates.size();
			}
			if (e.monthlyPayment != null) {
				e.paymentRank = RecommendRule.rankOf(e.monthlyPayment, payments);
				e.paymentCount = payments.size();
			}
		}
	}

	private RecommendItemDTO toItem(int rankNo, Evaluation e, RecommendRequestDTO request) {
		Candidate c = e.candidate;
		return new RecommendItemDTO(
				rankNo,
				ProductSummaryDTO.from(c.getProduct(), c.getTags()),
				BigDecimal.valueOf(e.matchRate).setScale(2, RoundingMode.HALF_UP),
				e.estRateMin,
				e.estRateMax,
				e.estRateMin == null ? null : e.rateEstimated,
				e.monthlyPayment,
				e.calcNote,
				recommendRule.judgeTags(e),
				recommendRule.reasons(e, request.getPriorities(), true));
	}

	// 결과 위 안내 문구
	private List<String> notes(RecommendRequestDTO request, AgeRange age, boolean empty) {
		List<String> notes = new ArrayList<>();
		if (empty) notes.add(NOTE_EMPTY);
		if (Boolean.TRUE.equals(request.getOverdue())) notes.add(NOTE_OVERDUE);
		if (request.getMonths() == 0) {
			notes.add(RecommendRule.termOf(request.getPurpose(), 0) / 12 + "년 기준으로 계산했어요");
		}
		if (age.birthNote()) notes.add(NOTE_BIRTH);
		if (Boolean.TRUE.equals(request.getDebtUnknown())) notes.add(NOTE_DEBT_UNKNOWN);
		return notes;
	}

	// 0건 hint: 나이, 지역, 소득, 신용, 한도를 하나씩 풀어 다시 세고 가장 많이 늘어나는 1개 (용도는 풀지 않음)
	private String hint(List<Candidate> candidates, RecommendRequestDTO request, AgeRange age) {
		Relax best = null;
		long bestCount = 0;
		for (Relax relax : Relax.values()) {
			if (relax == Relax.NONE) continue;
			if (relax == Relax.REGION && request.getRegion() == null) continue;
			if (relax == Relax.CREDIT_UP && RecommendRule.higherBand(request.getCreditBand()) == null) continue;

			long count = candidates.stream()
					.filter(c -> recommendRule.firstFail(c, request, age.min(), age.max(), relax) == null)
					.count();
			if (count > bestCount) {
				best = relax;
				bestCount = count;
			}
		}
		return best == null ? null : best.hintText(bestCount);
	}
}
