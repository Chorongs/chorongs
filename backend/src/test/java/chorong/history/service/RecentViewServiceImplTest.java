package chorong.history.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.history.dto.RecentViewResponseDTO;
import chorong.history.entity.RecentView;
import chorong.history.repository.RecentViewRepository;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/*
 * MEM-08 최근 본 대출 (API-21), 권한 B3
 * 기대값 출처: be_member.md MEM-08
 *   POST: 있으면 viewed_at만 갱신, 없으면 추가 → 10개 넘으면 오래된 것 삭제 (같은 트랜잭션, B16)
 *   GET: 최근 10개 (본 시각 + 상품 요약) / DELETE: 한 건(내 기록) 또는 전체 / 회원 번호는 세션에서만 (B3)
 * 명세서에 없는 선택(사용자 결정): ON이 아닌 상품은 기록하지 않고 404, 동시 요청으로 unique가 막으면 409 CONFLICT,
 *   없는 기록의 한 건 삭제는 404, 전체 삭제는 기록이 없어도 오류 없음, 상품이 없는 기록은 목록에서 건너뜀
 */
@ExtendWith(MockitoExtension.class)
class RecentViewServiceImplTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long OTHER_MEMBER_ID = 2L;
    private static final Long PRODUCT_ID = 10L;
    private static final LocalDateTime NEWEST = LocalDateTime.of(2026, 11, 20, 12, 0, 0);

    @Mock
    private RecentViewRepository recentViewRepository;

    @Mock
    private LoanProductRepository loanProductRepository;

    @Mock
    private ProductTagRepository productTagRepository;

    @Mock
    private TagRepository tagRepository;

    @InjectMocks
    private RecentViewServiceImpl recentViewService;

    // ---------- 기록 POST: 처음 보는 상품 ----------

    @Test
    @DisplayName("처음 보는 상품이면 기록이 한 번 저장된다")
    void saveNewRecentViewSavesOnce() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository, times(1)).save(any(RecentView.class));
    }

    @Test
    @DisplayName("저장되는 기록의 회원 번호는 인자로 받은 회원 번호이다")
    void saveNewRecentViewMemberId() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(savedRecentView().getMemberId()).isEqualTo(MEMBER_ID);
    }

    @Test
    @DisplayName("저장되는 기록의 상품 번호는 인자로 받은 상품 번호이다")
    void saveNewRecentViewProductId() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(savedRecentView().getProductId()).isEqualTo(PRODUCT_ID);
    }

    @Test
    @DisplayName("저장되는 기록에는 본 시각이 채워진다")
    void saveNewRecentViewViewedAt() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(savedRecentView().getViewedAt()).isNotNull();
    }

    // ---------- 기록 POST: 이미 본 상품 (시각만 갱신) ----------

    @Test
    @DisplayName("이미 본 상품이면 본 시각만 새로 갱신된다")
    void saveExistingUpdatesViewedAt() {
        // Given
        givenOnProduct();
        RecentView existing = recentViewOf(MEMBER_ID, PRODUCT_ID, NEWEST.minusDays(3));
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.of(existing));

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        assertThat(existing.getViewedAt()).isAfter(NEWEST.minusDays(3));
    }

    @Test
    @DisplayName("이미 본 상품이면 새 기록을 저장하지 않는다")
    void saveExistingDoesNotSave() {
        // Given
        givenOnProduct();
        RecentView existing = recentViewOf(MEMBER_ID, PRODUCT_ID, NEWEST.minusDays(3));
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.of(existing));

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository, never()).save(any(RecentView.class));
    }

    @Test
    @DisplayName("이미 본 상품이면 오래된 기록을 지우지 않는다 (10개가 이미 차 있어도)")
    void saveExistingDoesNotDeleteOldest() {
        // Given
        givenOnProduct();
        RecentView existing = recentViewOf(MEMBER_ID, PRODUCT_ID, NEWEST.minusDays(3));
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.of(existing));

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository, never()).delete(any(RecentView.class));
    }

    // ---------- 기록 POST: 10개 정리 (B16) ----------

    @Test
    @DisplayName("기록이 9개이면 오래된 기록을 지우지 않는다")
    void saveWithNineDoesNotDelete() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(9L);

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository, never()).delete(any(RecentView.class));
    }

    @Test
    @DisplayName("기록이 이미 10개이면 가장 오래된 기록이 삭제된다")
    void saveWithTenDeletesOldest() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(10L);
        RecentView oldest = recentViewOf(MEMBER_ID, 99L, NEWEST.minusDays(30));
        when(recentViewRepository.findFirstByMemberIdOrderByViewIdAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository).delete(oldest);
    }

    @Test
    @DisplayName("기록이 이미 10개여도 새 기록은 저장된다")
    void saveWithTenStillSaves() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(10L);
        when(recentViewRepository.findFirstByMemberIdOrderByViewIdAsc(MEMBER_ID))
                .thenReturn(Optional.of(recentViewOf(MEMBER_ID, 99L, NEWEST.minusDays(30))));

        // When
        recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository, times(1)).save(any(RecentView.class));
    }

    // ---------- 기록 POST: 상품 확인 (404), 동시 요청 ----------

    @Test
    @DisplayName("없거나 ON이 아닌 상품이면 NOT_FOUND(404)")
    void saveProductNotFound() {
        // Given
        when(loanProductRepository.findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("없는 상품이면 기록을 조회하지도 저장하지도 않는다")
    void saveProductNotFoundTouchesNothing() {
        // Given
        when(loanProductRepository.findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verifyNoInteractions(recentViewRepository);
    }

    @Test
    @DisplayName("동시 요청으로 DB unique가 막으면 CONFLICT(409)")
    void saveUniqueViolation() {
        // Given
        givenOnProduct();
        givenNoExistingRecord();
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);
        when(recentViewRepository.save(any(RecentView.class))).thenThrow(new DataIntegrityViolationException("unique"));

        // When, Then
        assertThatThrownBy(() -> recentViewService.saveRecentView(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    // ---------- 목록 GET ----------

    @Test
    @DisplayName("목록은 최근 본 순서 그대로 담긴다 (첫 번째가 가장 최근)")
    void getRecentViewsKeepsOrder() {
        // Given
        givenRecentViews(3);
        givenProductsForAll(3);

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result.get(0).getProduct().getProductId()).isEqualTo(101L);
    }

    @Test
    @DisplayName("목록의 개수는 기록의 개수와 같다")
    void getRecentViewsSize() {
        // Given
        givenRecentViews(3);
        givenProductsForAll(3);

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result).hasSize(3);
    }

    @Test
    @DisplayName("응답의 본 시각(viewedAt)은 기록의 시각이다")
    void getRecentViewsViewedAt() {
        // Given
        givenRecentViews(1);
        givenProductsForAll(1);

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result.get(0).getViewedAt()).isEqualTo(NEWEST);
    }

    @Test
    @DisplayName("기록이 없으면 빈 목록이다")
    void getRecentViewsEmpty() {
        // Given
        givenRecentViews(0);

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("숨김(HIDDEN) 상품의 기록도 목록에 남는다")
    void getRecentViewsKeepsHiddenProduct() {
        // Given
        givenRecentViews(1);
        LoanProduct product = product(101L, ProductStatus.HIDDEN);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(product));

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("상품을 찾지 못한 기록은 목록에서 건너뛴다")
    void getRecentViewsSkipsMissingProduct() {
        // Given
        givenRecentViews(2);
        LoanProduct product = product(101L, ProductStatus.ON);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(product));

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("상품은 기록마다 따로 조회하지 않고 한 번에 조회한다")
    void getRecentViewsLoadsProductsOnce() {
        // Given
        givenRecentViews(5);
        givenProductsForAll(5);

        // When
        recentViewService.getRecentViews(MEMBER_ID);

        // Then
        verify(loanProductRepository, times(1)).findAllById(any());
    }

    @Test
    @DisplayName("상품에 붙은 태그가 응답의 상품 요약에 담긴다")
    void getRecentViewsIncludesTags() {
        // Given
        givenRecentViews(1);
        givenProductsForAll(1);
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
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result.get(0).getProduct().getTags()).hasSize(1);
    }

    @Test
    @DisplayName("태그가 없는 상품은 빈 태그 목록으로 응답한다")
    void getRecentViewsNoTags() {
        // Given
        givenRecentViews(1);
        givenProductsForAll(1);

        // When
        List<RecentViewResponseDTO> result = recentViewService.getRecentViews(MEMBER_ID);

        // Then
        assertThat(result.get(0).getProduct().getTags()).isEmpty();
    }

    // ---------- 한 건 삭제 DELETE /{productId} (B3) ----------

    @Test
    @DisplayName("내 기록이면 그 기록이 삭제된다")
    void deleteRecentViewDeletes() {
        // Given
        RecentView mine = recentViewOf(MEMBER_ID, PRODUCT_ID, NEWEST);
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.of(mine));

        // When
        recentViewService.deleteRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        verify(recentViewRepository, times(1)).delete(mine);
    }

    @Test
    @DisplayName("없는 기록을 지우면 NOT_FOUND(404)")
    void deleteRecentViewNotFound() {
        // Given
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> recentViewService.deleteRecentView(MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("없는 기록이면 아무것도 삭제하지 않는다")
    void deleteRecentViewNotFoundDeletesNothing() {
        // Given
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> recentViewService.deleteRecentView(MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(recentViewRepository, never()).delete(any(RecentView.class));
    }

    @Test
    @DisplayName("남의 기록을 가리키는 상품 번호로 지우면 NOT_FOUND(404)")
    void deleteOthersRecentViewNotFound() {
        // Given: 상품 10은 회원 1만 봄 (회원 2의 조회에는 나오지 않음)
        when(recentViewRepository.findByMemberIdAndProductId(OTHER_MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> recentViewService.deleteRecentView(OTHER_MEMBER_ID, PRODUCT_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("남의 기록을 가리키는 상품 번호로 지워도 남의 기록은 삭제되지 않는다")
    void deleteOthersRecentViewNotDeleted() {
        // Given
        when(recentViewRepository.findByMemberIdAndProductId(OTHER_MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> recentViewService.deleteRecentView(OTHER_MEMBER_ID, PRODUCT_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(recentViewRepository, never()).delete(any(RecentView.class));
    }

    @Test
    @DisplayName("삭제되는 기록은 요청한 회원의 기록이다")
    void deleteRecentViewDeletesMyRecord() {
        // Given
        RecentView mine = recentViewOf(MEMBER_ID, PRODUCT_ID, NEWEST);
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.of(mine));

        // When
        recentViewService.deleteRecentView(MEMBER_ID, PRODUCT_ID);

        // Then
        ArgumentCaptor<RecentView> captor = ArgumentCaptor.forClass(RecentView.class);
        verify(recentViewRepository).delete(captor.capture());
        assertThat(captor.getValue().getMemberId()).isEqualTo(MEMBER_ID);
    }

    // ---------- 전체 삭제 DELETE ----------

    @Test
    @DisplayName("전체 삭제는 내 기록 전부를 삭제한다")
    void deleteRecentViewsDeletesAll() {
        // Given
        List<RecentView> mine = List.of(recentViewOf(MEMBER_ID, 101L, NEWEST), recentViewOf(MEMBER_ID, 102L, NEWEST));
        when(recentViewRepository.findByMemberIdOrderByViewIdDesc(MEMBER_ID)).thenReturn(mine);

        // When
        recentViewService.deleteRecentViews(MEMBER_ID);

        // Then
        verify(recentViewRepository).deleteAll(mine);
    }

    @Test
    @DisplayName("기록이 하나도 없어도 전체 삭제는 오류가 없다")
    void deleteRecentViewsEmptyNoError() {
        // Given
        when(recentViewRepository.findByMemberIdOrderByViewIdDesc(MEMBER_ID)).thenReturn(new ArrayList<>());

        // When, Then
        assertThatCode(() -> recentViewService.deleteRecentViews(MEMBER_ID)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("전체 삭제는 요청한 회원 번호로 기록을 찾는다 (남의 기록은 건드리지 않음)")
    void deleteRecentViewsQueriesWithCallersMemberId() {
        // Given
        when(recentViewRepository.findByMemberIdOrderByViewIdDesc(MEMBER_ID)).thenReturn(new ArrayList<>());

        // When
        recentViewService.deleteRecentViews(MEMBER_ID);

        // Then
        verify(recentViewRepository).findByMemberIdOrderByViewIdDesc(MEMBER_ID);
    }

    // ---------- 도우미 ----------

    private void givenOnProduct() {
        LoanProduct product = mock(LoanProduct.class);
        when(loanProductRepository.findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.ON))
                .thenReturn(Optional.of(product));
    }

    private void givenNoExistingRecord() {
        when(recentViewRepository.findByMemberIdAndProductId(MEMBER_ID, PRODUCT_ID)).thenReturn(Optional.empty());
    }

    // 최근 본 순으로 정렬된 기록 count개: 0번째가 가장 최근, 상품 번호는 101부터 차례로
    private void givenRecentViews(int count) {
        List<RecentView> recentViews = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            recentViews.add(recentViewOf(MEMBER_ID, 101L + i, NEWEST.minusMinutes(i)));
        }
        when(recentViewRepository.findByMemberIdOrderByViewIdDesc(MEMBER_ID)).thenReturn(recentViews);
    }

    // 기록 count개에 맞는 상품(ON)이 모두 있는 것으로 가정
    private void givenProductsForAll(int count) {
        List<LoanProduct> products = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            products.add(product(101L + i, ProductStatus.ON));
        }
        when(loanProductRepository.findAllById(any())).thenReturn(products);
    }

    // 서비스가 쓰는 값만 정한 상품 (일부는 쓰이지 않을 수 있어 lenient)
    private LoanProduct product(Long productId, ProductStatus status) {
        LoanProduct product = mock(LoanProduct.class);
        lenient().when(product.getProductId()).thenReturn(productId);
        lenient().when(product.getProductStatus()).thenReturn(status);
        return product;
    }

    private RecentView recentViewOf(Long memberId, Long productId, LocalDateTime viewedAt) {
        return RecentView.builder().memberId(memberId).productId(productId).viewedAt(viewedAt).build();
    }

    // save에 넘어간 RecentView를 꺼낸다
    private RecentView savedRecentView() {
        ArgumentCaptor<RecentView> captor = ArgumentCaptor.forClass(RecentView.class);
        verify(recentViewRepository).save(captor.capture());
        return captor.getValue();
    }
}
