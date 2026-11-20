package chorong.wish.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.wish.entity.Wish;
import chorong.wish.repository.WishRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * MEM-04 찜 취소 (DELETE /api/me/likes/{productId}) 권한 B3
 * 기대값 출처: be_member.md MEM-04 (내 찜만 삭제, 남의 찜 삭제 불가) + backend/Skills.md (남의 자원과 없는 자원은 같은 404)
 */
@ExtendWith(MockitoExtension.class)
class WishServiceImplDeleteWishTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long OTHER_MEMBER_ID = 2L;
    private static final Long PRODUCT_ID = 10L;

    @Mock
    private WishRepository wishRepository;

    @InjectMocks
    private WishServiceImpl wishService;

    // ---------- 내 찜 삭제 ----------

    @Test
    @DisplayName("내 찜이면 그 찜이 한 번 삭제된다")
    void deleteWishDeletesOnce() {
        // Given
        when(wishRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(wishOf(MEMBER_ID)));

        // When
        wishService.deleteWish(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(wishRepository, times(1)).delete(any(Wish.class));
    }

    @Test
    @DisplayName("삭제되는 찜은 요청한 회원의 찜이다")
    void deleteWishDeletesMyWish() {
        // Given
        when(wishRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(wishOf(MEMBER_ID)));

        // When
        wishService.deleteWish(MEMBER_ID, PRODUCT_ID);

        // Then
        ArgumentCaptor<Wish> captor = ArgumentCaptor.forClass(Wish.class);
        verify(wishRepository).delete(captor.capture());
        assertThat(captor.getValue().getMemberId()).isEqualTo(MEMBER_ID);
    }

    // ---------- 없는 찜 (404) ----------

    @Test
    @DisplayName("찜하지 않은 상품을 취소하면 NOT_FOUND(404)")
    void deleteWishNotFound() {
        // Given
        when(wishRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> wishService.deleteWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("찜하지 않은 상품이면 아무것도 삭제하지 않는다")
    void deleteWishNotFoundDeletesNothing() {
        // Given
        when(wishRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> wishService.deleteWish(MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(wishRepository, never()).delete(any(Wish.class));
    }

    // ---------- 남의 찜 (B3 공격 요청) ----------

    @Test
    @DisplayName("남의 찜을 가리키는 상품 번호로 취소하면 NOT_FOUND(404)")
    void deleteOthersWishNotFound() {
        // Given: 상품 10은 회원 1만 찜함 (회원 2의 조회에는 나오지 않음)
        when(wishRepository.findByMemberIdAndProductId(OTHER_MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> wishService.deleteWish(OTHER_MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("남의 찜을 가리키는 상품 번호로 취소해도 남의 찜은 삭제되지 않는다")
    void deleteOthersWishNotDeleted() {
        // Given
        when(wishRepository.findByMemberIdAndProductId(OTHER_MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> wishService.deleteWish(OTHER_MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(wishRepository, never()).delete(any(Wish.class));
    }

    @Test
    @DisplayName("찜은 요청한 회원 번호와 함께 조회한다 (남의 번호로 조회하지 않음)")
    void deleteWishQueriesWithCallersMemberId() {
        // Given
        when(wishRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID))
                .thenReturn(Optional.of(wishOf(MEMBER_ID)));

        // When
        wishService.deleteWish(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(wishRepository).findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID);
    }

    // ---------- 도우미 ----------

    private Wish wishOf(Long memberId) {
        return Wish.builder()
                .memberId(memberId)
                .productId(PRODUCT_ID)
                .createdAt(LocalDateTime.of(2026, 11, 20, 12, 0, 0))
                .build();
    }
}
