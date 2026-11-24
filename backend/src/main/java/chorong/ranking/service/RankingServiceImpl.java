package chorong.ranking.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import chorong.ranking.dto.RankingRequestDTO;
import chorong.ranking.dto.RankingResponseDTO;
import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.List;

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

	private record GroupDef(String value, List<String> members) {
	}
	private static final List<RankingServiceImpl.GroupDef> FIN_GROUPS = List.of(
			new RankingServiceImpl.GroupDef("은행권", List.of("시중은행", "지방은행", "특수은행", "인터넷은행")),
			new RankingServiceImpl.GroupDef("비은행권", List.of("저축은행", "캐피탈", "생명보험", "신협", "카드사", "손해보험")),
			new RankingServiceImpl.GroupDef("정책금융", List.of("신용보증재단", "서민금융기관", "공공기관", "지자체", "협약 금융회사", "복지기관", "기타")));


	@Override
	@Transactional(readOnly = true)
	public RankingResponseDTO getRanking(RankingRequestDTO request) {
		List<String> catValues = new ArrayList<>();
		List<Long> productIds = new ArrayList<>();

		//DTO의 cat에 값이 있을 때
		if(request.getCat() != null && !request.getCat().trim().equals("")) {
			for(RankingServiceImpl.GroupDef val : FIN_GROUPS) {
				if(val.value().equals(request.getCat().trim())) {
					catValues = val.members;
				}
			}
			//GroupDef에서 value를 못 찾아 배열이 비어있을 경우 400 에러 발생
			if(catValues.isEmpty()) throw new BusinessException(ErrorCode.INVALID_INPUT);
			List<Tag> tags = tagRepository.findByTagTypeAndTagValueIn(TagType.SECTOR, catValues);
			//tag_id만 가지는 리스트로 변환
			List<Long> tagIds = tags.stream().map(Tag::getTagId).distinct().toList();
			List<ProductTag> productTags = productTagRepository.findByTagIdIn(tagIds);
			//tagIds 중 하나라도 가진 상품의 productId만 가지는 리스트로 변환
			productIds = productTags.stream().map(ProductTag::getProductId).distinct().toList();
		}






		throw new UnsupportedOperationException("RANK-01, 02 아직 구현 전");
	}
}