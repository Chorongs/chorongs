package chorong.wish.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;
import chorong.wish.entity.Wish;
import chorong.wish.repository.WishRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/*
 * MEM-04 찜하기 (POST /api/me/likes/{productId})
 * 기대값 출처: be_member.md MEM-04 (처리 순서: 상품 확인 404 → 30개면 409 LIKE_FULL → 저장 / 이미 찜 409 ALREADY_LIKED)
 * ON 상품만 찜 가능한 것은 명세서가 아니라 구현 쪽 선택 (이력에 기록)
 */
@ExtendWith(MockitoExtension.class)
class WishServiceImplTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long PRODUCT_ID = 10L;

    @Mock
    private WishRepository wishRepository;

    @Mock
    private LoanProductRepository loanProductRepository;

    @InjectMocks
    private WishServiceImpl wishService;

    // ---------- 정상 ----------

    @Test
    @DisplayName("ON 상품이고 중복이 아니면 찜이 한 번 저장된다")
    void saveWishSavesOnce() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        wishService.saveWish(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(wishRepository, times(1)).save(any(Wish.class));
    }

    @Test
    @DisplayName("저장되는 찜의 회원 번호는 인자로 받은 회원 번호이다")
    void saveWishSavesMemberId() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        wishService.saveWish(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(savedWish().getMemberId()).isEqualTo(MEMBER_ID);
    }

    @Test
    @DisplayName("저장되는 찜의 상품 번호는 인자로 받은 상품 번호이다")
    void saveWishSavesProductId() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        wishService.saveWish(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(savedWish().getProductId()).isEqualTo(PRODUCT_ID);
    }

    @Test
    @DisplayName("저장되는 찜에는 찜한 시각이 채워진다")
    void saveWishSavesCreatedAt() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        wishService.saveWish(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(savedWish().getCreatedAt()).isNotNull();
    }

    // ---------- 상품 확인 (404) ----------

    @Test
    @DisplayName("없거나 ON이 아닌 상품이면 NOT_FOUND(404)")
    void saveWishProductNotFound() {
        // Given
        when(loanProductRepository.findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("없는 상품이면 찜 목록을 조회하지도 저장하지도 않는다")
    void saveWishProductNotFoundTouchesNoWish() {
        // Given
        when(loanProductRepository.findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verifyNoInteractions(wishRepository);
    }

    // ---------- 중복 (409 ALREADY_LIKED) ----------

    @Test
    @DisplayName("이미 찜한 상품이면 ALREADY_LIKED(409)")
    void saveWishAlreadyLiked() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(true);

        // When, Then
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ALREADY_LIKED));
    }

    @Test
    @DisplayName("이미 찜한 상품이면 저장하지 않는다")
    void saveWishAlreadyLikedNotSaved() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(true);

        // When
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(wishRepository, never()).save(any(Wish.class));
    }

    @Test
    @DisplayName("동시 요청으로 DB unique가 막으면 ALREADY_LIKED(409)")
    void saveWishUniqueViolation() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);
        when(wishRepository.save(any(Wish.class))).thenThrow(new DataIntegrityViolationException("unique"));

        // When, Then
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ALREADY_LIKED));
    }

    // ---------- 개수 (409 LIKE_FULL, 회원당 30개) ----------

    @Test
    @DisplayName("이미 30개를 찜했으면 LIKE_FULL(409)")
    void saveWishFull() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(30L);

        // When, Then
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LIKE_FULL));
    }

    @Test
    @DisplayName("30개가 가득 찬 회원은 저장되지 않는다")
    void saveWishFullNotSaved() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(30L);

        // When
        assertThatThrownBy(() -> wishService.saveWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(wishRepository, never()).save(any(Wish.class));
    }

    @Test
    @DisplayName("29개를 찜한 회원은 30번째를 찜할 수 있다")
    void saveWishTwentyNine() {
        // Given
        givenOnProduct();
        when(wishRepository.existsByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(false);
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(29L);

        // When
        wishService.saveWish(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(wishRepository, times(1)).save(any(Wish.class));
    }

    // ---------- 도우미 ----------

    // ON 상태인 상품이 있는 것으로 가정 (ON만 조회하는지도 함께 확인됨: 다른 상태로 조회하면 stub이 맞지 않음)
    private void givenOnProduct() {
        when(loanProductRepository.findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.ON))
                .thenReturn(Optional.of(mock(LoanProduct.class)));
    }

    // save에 넘어간 Wish를 꺼낸다
    private Wish savedWish() {
        ArgumentCaptor<Wish> captor = ArgumentCaptor.forClass(Wish.class);
        verify(wishRepository).save(captor.capture());
        return captor.getValue();
    }
}
