package chorong.recommend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.dto.ProductSummaryDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.recommend.dto.RecommendSaveRequestDTO;
import chorong.recommend.dto.SavedRecommendResponseDTO;
import chorong.recommend.entity.RecommendResult;
import chorong.recommend.repository.RecommendResultRepository;
import lombok.RequiredArgsConstructor;

/*
 * 추천 결과 저장, 목록, 삭제 (LOAN-04)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 묶음 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class RecommendResultServiceImpl implements RecommendResultService {

	private static final int MAX_SAVES = 10;	// 회원당 저장 묶음 수

	// 직업 코드 -> 라벨 글
	private static final Map<String, String> JOB_NAMES = Map.of(
			"OFFICE", "직장인",
			"BIZ", "사업자",
			"FREELANCER", "프리랜서",
			"STUDENT", "학생/취준생",
			"PART_TIME", "알바/계약직",
			"HOMEMAKER", "주부",
			"NO_INCOME", "무직/무소득",
			"FARM", "농/어업인");

	private final RecommendResultRepository recommendResultRepository;
	private final LoanProductRepository loanProductRepository;
	private final ProductTagRepository productTagRepository;
	private final TagRepository tagRepository;

	@Override
	@Transactional
	public Long saveRecommendResult(Long memberId, RecommendSaveRequestDTO request) {
		// 1. 값 확인: 용도에 맞는 기간, 상품 번호 중복 없음, 모두 있는 상품
		if (!RecommendRule.isValidMonths(request.getPurpose(), request.getMonths())) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "갚을 기간을 확인해 주세요.");
		}
		List<Long> productIds = request.getProductIds();
		if (new HashSet<>(productIds).size() != productIds.size()
				|| loanProductRepository.findAllById(productIds).size() != productIds.size()) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "저장할 상품을 확인해 주세요.");
		}

		// 2. 라벨 -> 3. 묶음 번호 1개 발급 -> 상품마다 1행 (같은 라벨, 같은 시각)
		String label = conditionLabel(request);
		Long saveId = recommendResultRepository.nextSaveId();
		LocalDateTime now = LocalDateTime.now().withNano(0);
		recommendResultRepository.saveAll(request.toEntities(saveId, memberId, label, now));

		// 4. 10개 넘으면 가장 오래된 묶음부터 삭제
		List<Long> saveIds = recommendResultRepository.findByMemberIdOrderBySaveIdDescRankNoAsc(memberId).stream()
				.map(RecommendResult::getSaveId)
				.distinct()
				.toList();
		for (int i = MAX_SAVES; i < saveIds.size(); i++) {
			recommendResultRepository.deleteBySaveIdAndMemberId(saveIds.get(i), memberId);
		}
		return saveId;
	}

	@Override
	@Transactional(readOnly = true)
	public SavedRecommendResponseDTO getRecommendResults(Long memberId) {
		List<RecommendResult> rows = recommendResultRepository.findByMemberIdOrderBySaveIdDescRankNoAsc(memberId);
		if (rows.isEmpty()) return new SavedRecommendResponseDTO(new ArrayList<>());

		// 상품은 지금 정보 (판매 종료, 숨김은 productStatus로 표시)
		List<Long> productIds = rows.stream().map(RecommendResult::getProductId).distinct().toList();
		Map<Long, LoanProduct> productById = new HashMap<>();
		for (LoanProduct product : loanProductRepository.findAllById(productIds)) {
			productById.put(product.getProductId(), product);
		}
		Map<Long, List<Tag>> tagsByProduct = tagsByProduct(productIds);

		// saveId로 묶음 (최신 저장 먼저, 행 순서 그대로)
		Map<Long, SavedRecommendResponseDTO.SaveItem> saves = new LinkedHashMap<>();
		for (RecommendResult row : rows) {
			LoanProduct product = productById.get(row.getProductId());
			if (product == null) continue;
			SavedRecommendResponseDTO.SaveItem save = saves.computeIfAbsent(row.getSaveId(),
					id -> new SavedRecommendResponseDTO.SaveItem(id, row.getConditionLabel(), row.getCreatedAt(), new ArrayList<>()));
			save.getProducts().add(new SavedRecommendResponseDTO.ProductItem(row.getRankNo(),
					ProductSummaryDTO.from(product, tagsByProduct.getOrDefault(product.getProductId(), List.of()))));
		}
		return new SavedRecommendResponseDTO(new ArrayList<>(saves.values()));
	}

	@Override
	@Transactional
	public void deleteRecommendResult(Long memberId, Long saveId) {
		// 남의 저장과 없는 저장은 같은 404
		if (!recommendResultRepository.existsBySaveIdAndMemberId(saveId, memberId)) {
			throw new BusinessException(ErrorCode.NOT_FOUND);
		}
		recommendResultRepository.deleteBySaveIdAndMemberId(saveId, memberId);
	}

	@Override
	@Transactional
	public void deleteRecommendResults(Long memberId) {
		recommendResultRepository.deleteByMemberId(memberId);
	}

	// 조건 라벨: 용도 금액 / 기간 / 직업 (예: '생활비 1,000만원 / 3년 / 직장인'). 나이, 신용, 지역은 넣지 않음
	static String conditionLabel(RecommendSaveRequestDTO request) {
		String term = request.getMonths() == 0 ? "기간 모름" : request.getMonths() / 12 + "년";
		return request.getPurpose() + " " + RecommendRule.formatMoney(request.getNeed())
				+ " / " + term + " / " + JOB_NAMES.get(request.getJob());
	}

	// 상품별 태그 (태그 번호순)
	private Map<Long, List<Tag>> tagsByProduct(List<Long> productIds) {
		List<ProductTag> productTags = productTagRepository.findByProductIdIn(productIds);
		Map<Long, List<Tag>> result = new HashMap<>();
		if (productTags.isEmpty()) return result;

		Map<Long, Tag> tagById = new HashMap<>();
		List<Long> tagIds = productTags.stream().map(ProductTag::getTagId).distinct().toList();
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
