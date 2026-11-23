package chorong.history.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.history.dto.CompareHistoryRequestDTO;
import chorong.history.dto.CompareHistoryResponseDTO;
import chorong.history.entity.CompareHistory;
import chorong.history.repository.CompareHistoryRepository;
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
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class CompareHistoryServiceImpl implements CompareHistoryService {
    private final CompareHistoryRepository compareHistoryRepository;
    private final LoanProductRepository loanProductRepository;
    private final ProductTagRepository productTagRepository;
    private final TagRepository tagRepository;

    @Override
    @Transactional(readOnly = true)
    public List<CompareHistoryResponseDTO> getCompareHistories(Long memberId) {
        List<CompareHistory> compareList = compareHistoryRepository.findByMemberIdOrderByComparedIdDesc(memberId);

        List<Long> productIds = compareList.stream()
                .flatMap(c -> Stream.of(c.getProductAId(), c.getProductBId()))     // A, B 번호를 한 줄로 펼침
                .distinct().toList();                                              // 겹치는 상품은 한 번만

        Map<Long, LoanProduct> productById = new HashMap<>();
        for (LoanProduct product : loanProductRepository.findAllById(productIds)) { // 한 번에 조회
            productById.put(product.getProductId(), product);
        }
        Map<Long, List<Tag>> tagsByProduct = tagsByProduct(productIds);

        List<CompareHistoryResponseDTO> responses = new ArrayList<>();
        for (CompareHistory compare : compareList) {                               // 최근 비교 순서 그대로
            LoanProduct productA = productById.get(compare.getProductAId());
            LoanProduct productB = productById.get(compare.getProductBId());
            if (productA == null || productB == null) continue;                     // 한쪽이라도 없으면 건너뜀
            responses.add(new CompareHistoryResponseDTO(
                    compare.getCompareId(),
                    compare.getComparedAt(),
                    ProductSummaryDTO.from(productA, tagsByProduct.getOrDefault(productA.getProductId(), List.of())),
                    ProductSummaryDTO.from(productB, tagsByProduct.getOrDefault(productB.getProductId(), List.of()))));
        }
        return responses;
    }

    @Override
    @Transactional
    public void saveCompareHistory(Long memberId, CompareHistoryRequestDTO compareReqDTO) {
        if(compareReqDTO.getProductAId().equals(compareReqDTO.getProductBId())) throw new BusinessException(ErrorCode.INVALID_INPUT);
        loanProductRepository.findByProductIdAndProductStatus(compareReqDTO.getProductAId(), ProductStatus.ON)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        loanProductRepository.findByProductIdAndProductStatus(compareReqDTO.getProductBId(), ProductStatus.ON)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        Long min = Math.min(compareReqDTO.getProductAId(), compareReqDTO.getProductBId());
        Long max = Math.max(compareReqDTO.getProductAId(), compareReqDTO.getProductBId());
        boolean isCompare = compareHistoryRepository.existsByMemberIdAndProductAIdAndProductBId(memberId, min, max);
        if (isCompare) {
            throw new BusinessException(ErrorCode.CONFLICT, "이미 저장한 조합입니다.");
        }
        long compareCount = compareHistoryRepository.countByMemberId(memberId);
        if (compareCount >= 10) {
            Optional<CompareHistory> firstSaveCompare =
                    compareHistoryRepository.findFirstByMemberIdOrderByCompareIdAsc(memberId);
            compareHistoryRepository.delete(firstSaveCompare.get());
        }
        CompareHistory compareHistory = CompareHistory.builder()
                .productAId(min)
                .productBId(max)
                .memberId(memberId)
                .comparedAt(LocalDateTime.now().withNano(0))
                .build();
        try {
            compareHistoryRepository.save(compareHistory);
        }catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }

    @Override
    @Transactional
    public void deleteCompareHistory(Long memberId, Long compareId) {
        Optional<CompareHistory>  compareHistory = compareHistoryRepository.findByMemberIdAndCompareId(memberId, compareId);
        if (compareHistory.isPresent()) {
            compareHistoryRepository.delete(compareHistory.get());
        }else {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
    }

    @Override
    @Transactional
    public void deleteCompareHistories(Long memberId) {
        List<CompareHistory> compareHistoryList = compareHistoryRepository.findByMemberIdOrderByComparedIdDesc(memberId);
        compareHistoryRepository.deleteAll(compareHistoryList);
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
