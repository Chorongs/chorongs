package chorong.wish.service;

import chorong.common.dto.PageInfo;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.wish.dto.WishResponseDTO;
import chorong.wish.entity.Wish;
import chorong.wish.repository.WishRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/*
 * MEM-04 찜 목록 (GET /api/me/likes?page=&size=)
 * 기대값 출처: be_member.md MEM-04 (응답 PageInfo: list, total, page, size / 최신순 / 판매 종료, 숨김 상품도 목록에 남김)
 *            be_common.md 쪽 나눔 (page 1부터, size 기본 20, 최대 50)
 * 명세서에 없는 선택(사용자 결정): 범위를 벗어난 값은 400 INVALID_INPUT, size 최소 1, 상품이 없는 찜은 건너뜀
 */
@ExtendWith(MockitoExtension.class)
class WishServiceImplGetWishesTest {

    private static final Long MEMBER_ID = 1L;
    private static final LocalDateTime NEWEST = LocalDateTime.of(2026, 11, 19, 12, 0, 0);

    @Mock
    private WishRepository wishRepository;

    @Mock
    private LoanProductRepository loanProductRepository;

    @Mock
    private ProductTagRepository productTagRepository;

    @Mock
    private TagRepository tagRepository;

    @InjectMocks
    private WishServiceImpl wishService;

    // ---------- 쪽 나눔 (전체 25개, 한 쪽 10개) ----------

    @Test
    @DisplayName("전체 개수(total)는 자르기 전의 찜 개수이다")
    void getWishesTotal() {
        // Given
        givenWishes(25);
        givenProductsForAllWishes(25);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 3, 10);

        // Then
        assertThat(result.getTotal()).isEqualTo(25L);
    }

    @Test
    @DisplayName("마지막 쪽에는 남은 개수만 담긴다 (25개 중 3쪽은 5개)")
    void getWishesLastPageSize() {
        // Given
        givenWishes(25);
        givenProductsForAllWishes(25);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 3, 10);

        // Then
        assertThat(result.getList()).hasSize(5);
    }

    @Test
    @DisplayName("1쪽은 가장 최신 찜부터 시작한다")
    void getWishesFirstPageStartsWithNewest() {
        // Given
        givenWishes(25);
        givenProductsForAllWishes(25);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 10);

        // Then
        assertThat(result.getList().get(0).getProduct().getProductId()).isEqualTo(101L);
    }

    @Test
    @DisplayName("2쪽은 1쪽 다음 찜부터 시작한다 (11번째)")
    void getWishesSecondPageStartsAfterFirstPage() {
        // Given
        givenWishes(25);
        givenProductsForAllWishes(25);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 2, 10);

        // Then
        assertThat(result.getList().get(0).getProduct().getProductId()).isEqualTo(111L);
    }

    @Test
    @DisplayName("응답의 page는 요청한 쪽 번호이다")
    void getWishesPage() {
        // Given
        givenWishes(25);
        givenProductsForAllWishes(25);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 2, 10);

        // Then
        assertThat(result.getPage()).isEqualTo(2);
    }

    @Test
    @DisplayName("응답의 size는 요청한 한 쪽 개수이다")
    void getWishesSize() {
        // Given
        givenWishes(25);
        givenProductsForAllWishes(25);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 2, 10);

        // Then
        assertThat(result.getSize()).isEqualTo(10);
    }

    @Test
    @DisplayName("응답의 찜한 시각(createdAt)은 찜의 시각이다")
    void getWishesCreatedAt() {
        // Given
        givenWishes(1);
        givenProductsForAllWishes(1);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList().get(0).getCreatedAt()).isEqualTo(NEWEST);
    }

    // ---------- 빈 목록, 범위 밖 쪽 ----------

    @Test
    @DisplayName("찜이 없는 회원이 1쪽을 부르면 빈 목록이다 (오류 아님)")
    void getWishesNoWishesEmptyList() {
        // Given
        givenWishes(0);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList()).isEmpty();
    }

    @Test
    @DisplayName("찜이 없는 회원의 total은 0이다")
    void getWishesNoWishesTotalZero() {
        // Given
        givenWishes(0);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getTotal()).isEqualTo(0L);
    }

    @Test
    @DisplayName("찜 개수를 벗어난 쪽이면 INVALID_INPUT(400)")
    void getWishesPageOutOfRange() {
        // Given
        givenWishes(25);

        // When, Then
        assertThatThrownBy(() -> wishService.getWishes(MEMBER_ID, 4, 10))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ---------- page, size 검증 (400) ----------

    @Test
    @DisplayName("page가 0이면 INVALID_INPUT(400)")
    void getWishesPageZero() {
        // When, Then
        assertThatThrownBy(() -> wishService.getWishes(MEMBER_ID, 0, 20))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("page가 음수이면 INVALID_INPUT(400)")
    void getWishesPageNegative() {
        // When, Then
        assertThatThrownBy(() -> wishService.getWishes(MEMBER_ID, -1, 20))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("size가 0이면 INVALID_INPUT(400)")
    void getWishesSizeZero() {
        // When, Then
        assertThatThrownBy(() -> wishService.getWishes(MEMBER_ID, 1, 0))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("size가 최대 50을 넘으면 INVALID_INPUT(400)")
    void getWishesSizeOverMax() {
        // When, Then
        assertThatThrownBy(() -> wishService.getWishes(MEMBER_ID, 1, 51))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("size가 50이면 허용된다 (최대 경계)")
    void getWishesSizeMaxAllowed() {
        // Given
        givenWishes(0);

        // When, Then
        assertThatCode(() -> wishService.getWishes(MEMBER_ID, 1, 50)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("size가 1이면 허용된다 (최소 경계)")
    void getWishesSizeMinAllowed() {
        // Given
        givenWishes(0);

        // When, Then
        assertThatCode(() -> wishService.getWishes(MEMBER_ID, 1, 1)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("잘못된 page, size이면 찜 목록을 조회하지 않는다")
    void getWishesInvalidInputDoesNotQuery() {
        // When
        assertThatThrownBy(() -> wishService.getWishes(MEMBER_ID, 0, 20))
                .isInstanceOf(BusinessException.class);

        // Then
        verifyNoInteractions(wishRepository);
    }

    // ---------- 상품 (판매 종료, 숨김은 남김 / 없으면 건너뜀) ----------

    @Test
    @DisplayName("숨김(HIDDEN) 상품의 찜도 목록에 남는다")
    void getWishesKeepsHiddenProduct() {
        // Given
        givenWishes(1);
        LoanProduct product = product(101L, ProductStatus.HIDDEN);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(product));

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList()).hasSize(1);
    }

    @Test
    @DisplayName("판매 종료(CLOSED) 상품의 찜도 목록에 남는다")
    void getWishesKeepsClosedProduct() {
        // Given
        givenWishes(1);
        LoanProduct product = product(101L, ProductStatus.CLOSED);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(product));

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList()).hasSize(1);
    }

    @Test
    @DisplayName("상품을 찾지 못한 찜은 목록에서 건너뛴다")
    void getWishesSkipsMissingProduct() {
        // Given
        givenWishes(2);
        LoanProduct product = product(101L, ProductStatus.ON);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(product));

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList()).hasSize(1);
    }

    @Test
    @DisplayName("상품은 찜마다 따로 조회하지 않고 한 번에 조회한다")
    void getWishesLoadsProductsOnce() {
        // Given
        givenWishes(5);
        givenProductsForAllWishes(5);

        // When
        wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        verify(loanProductRepository, times(1)).findAllById(any());
    }

    // ---------- 태그 ----------

    @Test
    @DisplayName("상품에 붙은 태그가 응답의 상품 요약에 담긴다")
    void getWishesIncludesTags() {
        // Given
        givenWishes(1);
        givenProductsForAllWishes(1);
        ProductTag productTag = mock(ProductTag.class);
        when(productTag.getProductId()).thenReturn(101L);
        when(productTag.getTagId()).thenReturn(7L);
        Tag tag = mock(Tag.class);
        when(tag.getTagId()).thenReturn(7L);
        when(tag.getTagType()).thenReturn(TagType.SECTOR);
        when(tag.getTagValue()).thenReturn("인터넷은행");
        when(productTagRepository.findByProductIdIn(any())).thenReturn(List.of(productTag));
        when(tagRepository.findByTagIdInOrderByTagId(any())).thenReturn(List.of(tag));

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList().get(0).getProduct().getTags()).hasSize(1);
    }

    @Test
    @DisplayName("태그가 없는 상품은 빈 태그 목록으로 응답한다")
    void getWishesNoTags() {
        // Given
        givenWishes(1);
        givenProductsForAllWishes(1);

        // When
        PageInfo<WishResponseDTO> result = wishService.getWishes(MEMBER_ID, 1, 20);

        // Then
        assertThat(result.getList().get(0).getProduct().getTags()).isEmpty();
    }

    // ---------- 도우미 ----------

    // 최신순으로 정렬된 찜 count개: 0번째가 가장 최신, 상품 번호는 101부터 차례로
    private void givenWishes(int count) {
        List<Wish> wishes = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            wishes.add(Wish.builder()
                    .memberId(MEMBER_ID)
                    .productId(101L + i)
                    .createdAt(NEWEST.minusMinutes(i))
                    .build());
        }
        when(wishRepository.findByMemberIdOrderByCreatedAtDesc(MEMBER_ID)).thenReturn(wishes);
    }

    // 찜 count개에 맞는 상품(ON)이 모두 있는 것으로 가정
    private void givenProductsForAllWishes(int count) {
        List<LoanProduct> products = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            products.add(product(101L + i, ProductStatus.ON));
        }
        when(loanProductRepository.findAllById(any())).thenReturn(products);
    }

    // 서비스가 쓰는 값만 정한 상품 (이번 쪽에 없는 상품은 쓰이지 않으므로 lenient)
    private LoanProduct product(Long productId, ProductStatus status) {
        LoanProduct product = mock(LoanProduct.class);
        lenient().when(product.getProductId()).thenReturn(productId);
        lenient().when(product.getProductStatus()).thenReturn(status);
        return product;
    }
}
