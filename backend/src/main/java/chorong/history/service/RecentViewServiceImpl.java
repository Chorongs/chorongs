package chorong.history.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.history.dto.RecentViewResponseDTO;
import chorong.history.entity.RecentView;
import chorong.history.repository.RecentViewRepository;
import chorong.product.dto.ProductSummaryDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class RecentViewServiceImpl implements RecentViewService {
    private final LoanProductRepository loanProductRepository;
    private final RecentViewRepository recentViewRepository;
    private final ProductTagRepository productTagRepository;
    private final TagRepository tagRepository;

    @Override
    @Transactional(readOnly = true)
    public List<RecentViewResponseDTO> getRecentViews(Long memberId) {
        List<RecentView> recentList = recentViewRepository.findByMemberIdOrderByViewAtDesc(memberId);
        List<Long> productIds = recentList.stream().map(RecentView::getProductId).toList();                  // 상품 번호 모으기

        Map<Long, LoanProduct> productById = new HashMap<>();                                                 // 상품 번호 -> 상품
        for (LoanProduct product : loanProductRepository.findAllById(productIds)) {                           // 한 번에 조회 (상태 조건 없음)
            productById.put(product.getProductId(), product);
        }
        Map<Long, List<Tag>> tagsByProduct = tagsByProduct(productIds);                                       // 상품 번호 -> 태그 목록

        List<RecentViewResponseDTO> responses = new ArrayList<>();
        for (RecentView recentView : recentList) {                                                           // 최근 본 순서 그대로
            LoanProduct product = productById.get(recentView.getProductId());
            if (product == null) continue;                                                                    // 상품이 없으면 건너뜀
            ProductSummaryDTO summary = ProductSummaryDTO.from(product,
                    tagsByProduct.getOrDefault(product.getProductId(), List.of()));                           // 태그가 없으면 빈 목록
            responses.add(new RecentViewResponseDTO(summary, recentView.getViewedAt()));                      // 상품 요약 + 본 시각
        }
        return responses;
    }

    @Override
    @Transactional
    public void saveRecentView(Long memberId, Long productId) {
        loanProductRepository.findByProductIdAndProductStatus(productId , ProductStatus.ON)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Optional<RecentView> recentView = recentViewRepository.findByMemberIdAndProductId(memberId, productId);
        if (recentView.isPresent()) {
            recentView.get().viewedAtUpdate(LocalDateTime.now().withNano(0));
        }else {
            long recentViewCount = recentViewRepository.countByMemberId(memberId);
            if (recentViewCount >= 10) {
                Optional<RecentView> firstSavedRecent = recentViewRepository
                        .findFirstByMemberIdOrderByViewAtAsc(memberId);
                recentViewRepository.delete(firstSavedRecent.get());
            }

           RecentView newRecentView = RecentView.builder()
                   .memberId(memberId).
                   productId(productId).
                   viewedAt(LocalDateTime.now().withNano(0)).
                   build();
           try{
               recentViewRepository.save(newRecentView);
           }catch (DataIntegrityViolationException e) {
               throw new BusinessException(ErrorCode.CONFLICT);
           }
        }
    }

    @Override
    @Transactional
    public void deleteRecentView(Long memberId, Long productId) {
        Optional<RecentView> recentView = recentViewRepository.findByMemberIdAndProductId(memberId, productId);
        if (recentView.isPresent()) {
            recentViewRepository.delete(recentView.get());
        }else {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
    }

    @Override
    @Transactional
    public void deleteRecentViews(Long memberId) {
        List<RecentView> recentViewList = recentViewRepository.findByMemberIdOrderByViewAtDesc(memberId);

            recentViewRepository.deleteAll(recentViewList);
    }

    private Map<Long, List<Tag>> tagsByProduct(List<Long> productIds) {
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
