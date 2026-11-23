package chorong.wish.service;

import chorong.common.dto.PageInfo;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.dto.ProductSummaryDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.wish.dto.WishResponseDTO;
import chorong.wish.entity.Wish;
import chorong.wish.repository.WishRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;


@Service
@RequiredArgsConstructor
public class WishServiceImpl implements WishService {
    private final WishRepository wishRepository;
    private final LoanProductRepository loanProductRepository;
    private final ProductTagRepository productTagRepository;
    private final TagRepository tagRepository;

    @Override
    @Transactional(readOnly = true)
    public PageInfo<WishResponseDTO> getWishes(Long memberId, int page, int size) {
        if(page < 1 || size < 1 || size > 50) throw new BusinessException(ErrorCode.INVALID_INPUT);
        List<Wish> wishes = wishRepository.findByMemberIdOrderByWishIdDesc(memberId);
        int from = (page - 1) * size;
        int to = Math.min(from + size, wishes.size());
        if(from > 0 && from >= wishes.size()) throw new BusinessException(ErrorCode.INVALID_INPUT);

        List<Wish> pageWishes = wishes.subList(from, to);
        List<Long> productIds = pageWishes.stream()
                .map(Wish::getProductId)
                .toList();
        Map<Long, List<Tag>> tagsByProduct = tagsByProduct(productIds);

        Map<Long, LoanProduct> productById = new HashMap<>();                        // 상품 번호 -> 상품
        for (LoanProduct product : loanProductRepository.findAllById(productIds)) {  // 한 번에 조회 (상태 조건 없음)
            productById.put(product.getProductId(), product);
        }

        List<WishResponseDTO> responses = new ArrayList<>();                         // 이번 쪽 응답 목록
        for (Wish wish : pageWishes) {                                               // 찜 순서(최신순) 그대로
            LoanProduct product = productById.get(wish.getProductId());              // 맵에서 상품 찾기
            if (product == null) continue;                                           // 없으면 건너뜀
            ProductSummaryDTO summary = ProductSummaryDTO.from(product,              // 상품 요약 (태그는 없으면 빈 목록)
                    tagsByProduct.getOrDefault(product.getProductId(), List.of()));
            responses.add(new WishResponseDTO(summary, wish.getCreatedAt()));        // 상품 요약 + 찜한 시각
        }

        return new PageInfo<>(responses, (long) wishes.size(), page, size);          // total은 자르기 전 전체 개수
    }

    @Override
    @Transactional
    public void saveWish(Long memberId, Long productId) {
        //판매상태가 ON 이 아니면 404 에러 발생
         loanProductRepository.findByProductIdAndProductStatus(productId ,ProductStatus.ON)
                 .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

         //memberId, productId가 하나의 행에 있다면 중복에러 발생
        boolean isWish = wishRepository.existsByMemberIdAndProductId(memberId, productId);
        if (isWish) throw new BusinessException(ErrorCode.ALREADY_LIKED);

        //찜 목록이 30개 이상이라면 저장되지 않고 에러 발생
        Long count = wishRepository.countByMemberId(memberId);
        if(count >= 30) throw new BusinessException(ErrorCode.LIKE_FULL);

        Wish wish = Wish.builder().memberId(memberId)
                    .productId(productId)
                    .createdAt(LocalDateTime.now().withNano(0))
                    .build();
        try {
            wishRepository.save(wish);
        }catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.ALREADY_LIKED);
        }

    }

    @Override
    @Transactional
    public void deleteWish(Long memberId, Long productId) {
        //memberId, productId가 비어있으면 Not Found 발생
        Optional<Wish> Wish = wishRepository.findByMemberIdAndProductId(memberId, productId);
        if (Wish.isEmpty()) throw new BusinessException(ErrorCode.NOT_FOUND);

        wishRepository.delete(Wish.get());

    }

    // 상품 번호 -> 태그 목록 (상품 한 번, 연결 한 번, 태그 한 번으로 모아서 가져옴)
    private Map<Long, List<Tag>> tagsByProduct(List<Long> productIds) {
        List<ProductTag> productTags = productTagRepository.findByProductIdIn(productIds);   // 상품들의 태그 연결 행
        Map<Long, List<Tag>> result = new HashMap<>();
        if (productTags.isEmpty()) return result;                                            // 연결이 없으면 빈 맵

        List<Long> tagIds = productTags.stream().map(ProductTag::getTagId).distinct().toList(); // 쓰인 태그 번호 (중복 제거)
        Map<Long, Tag> tagById = new HashMap<>();
        for (Tag tag : tagRepository.findByTagIdInOrderByTagId(tagIds)) {
            tagById.put(tag.getTagId(), tag);                                                // 태그 번호 -> 태그
        }
        for (ProductTag productTag : productTags) {
            Tag tag = tagById.get(productTag.getTagId());
            if (tag != null) {
                result.computeIfAbsent(productTag.getProductId(), id -> new ArrayList<>()).add(tag); // 상품별 목록에 담음
            }
        }
        for (List<Tag> tags : result.values()) {
            tags.sort(Comparator.comparing(Tag::getTagId));                       // 태그 번호 순 (화면 칩 순서)
        }
        return result;
    }
}
