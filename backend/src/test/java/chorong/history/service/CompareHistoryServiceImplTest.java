package chorong.history.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.history.dto.CompareHistoryRequestDTO;
import chorong.history.dto.CompareHistoryResponseDTO;
import chorong.history.entity.CompareHistory;
import chorong.history.repository.CompareHistoryRepository;
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
import org.mockito.InOrder;
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
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/*
 * MEM-10 비교 내역 저장 (API-23), 권한 B3
 * 기대값 출처: be_member.md MEM-10, db/schema.sql compare_history
 *   POST: A, B 다름 확인 (같으면 400) → 없는 상품 404 → 순서 상관없이 같은 조합이 있으면 409 '이미 저장한 조합'
 *         → 없으면 저장 (작은 번호가 product_a_id) → 10개 넘으면 오래된 것 삭제
 *   GET: 최근 10개 (compareId, comparedAt, productA, productB = ProductSummaryDTO)
 *   DELETE: {compareId} 있으면 그 1건 (내 것만, 없거나 남의 것은 404), 없으면 내 기록 전체
 * 명세서에 없는 선택(사용자 결정): 상품은 판매 중(ON)만 허용, 동시 요청으로 unique가 막으면 409 CONFLICT,
 *   전체 삭제는 기록이 없어도 오류 없음, 한쪽이라도 상품이 없는 기록은 목록에서 건너뜀
 */
@ExtendWith(MockitoExtension.class)
class CompareHistoryServiceImplTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long COMPARE_ID = 500L;
    private static final Long SMALL_ID = 10L;
    private static final Long BIG_ID = 30L;
    private static final LocalDateTime NEWEST = LocalDateTime.of(2026, 11, 20, 12, 0, 0);

    @Mock
    private CompareHistoryRepository compareHistoryRepository;

    @Mock
    private LoanProductRepository loanProductRepository;

    @Mock
    private ProductTagRepository productTagRepository;

    @Mock
    private TagRepository tagRepository;

    @InjectMocks
    private CompareHistoryServiceImpl compareHistoryService;

    // ---------- 기록 POST: 입력 확인 ----------

    @Test
    @DisplayName("A와 B가 같은 상품이면 400 (INVALID_INPUT)")
    void saveSameProductInvalidInput() {
        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, SMALL_ID)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("상품 번호가 커도(1000) 같은 상품이면 400 (객체 비교가 아니라 값 비교)")
    void saveSameLargeProductInvalidInput() {
        // Given: 각각 따로 만든 Long 객체 (1000은 Long 캐시 범위 밖이라 서로 다른 객체)
        CompareHistoryRequestDTO dto = new CompareHistoryRequestDTO();
        dto.setProductAId(Long.valueOf(1000L));
        dto.setProductBId(Long.valueOf(1000L));

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, dto))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("A와 B가 같으면 상품 조회도 저장도 하지 않는다")
    void saveSameProductTouchesNothing() {
        // When
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, SMALL_ID)))
                .isInstanceOf(BusinessException.class);

        // Then
        verifyNoInteractions(compareHistoryRepository, loanProductRepository);
    }

    @Test
    @DisplayName("A 상품이 없으면 404")
    void saveProductANotFound() {
        // Given
        when(loanProductRepository.findByProductIdAndProductStatus(SMALL_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("B 상품이 없으면 404")
    void saveProductBNotFound() {
        // Given
        givenOnProduct(SMALL_ID);
        when(loanProductRepository.findByProductIdAndProductStatus(BIG_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("없는 상품이면 기록을 저장하지 않는다")
    void saveProductNotFoundDoesNotSave() {
        // Given
        when(loanProductRepository.findByProductIdAndProductStatus(SMALL_ID, ProductStatus.ON))
                .thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .isInstanceOf(BusinessException.class);

        // Then
        verifyNoInteractions(compareHistoryRepository);
    }

    // ---------- 기록 POST: 처음 저장하는 조합 ----------

    @Test
    @DisplayName("처음 저장하는 조합이면 기록이 한 번 저장된다")
    void saveNewSavesOnce() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        verify(compareHistoryRepository, times(1)).save(any(CompareHistory.class));
    }

    @Test
    @DisplayName("저장되는 기록의 회원 번호는 인자로 받은 회원 번호이다")
    void saveNewMemberId() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        assertThat(savedCompare().getMemberId()).isEqualTo(MEMBER_ID);
    }

    @Test
    @DisplayName("작은 번호가 A, 큰 번호가 B로 저장된다")
    void saveNewSmallerIsA() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        assertThat(savedCompare().getProductAId()).isEqualTo(SMALL_ID);
        assertThat(savedCompare().getProductBId()).isEqualTo(BIG_ID);
    }

    @Test
    @DisplayName("순서를 바꿔 (큰 번호, 작은 번호)로 보내도 작은 번호가 A로 저장된다")
    void saveNewReversedOrderStillSmallerIsA() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(BIG_ID, SMALL_ID));

        // Then
        assertThat(savedCompare().getProductAId()).isEqualTo(SMALL_ID);
        assertThat(savedCompare().getProductBId()).isEqualTo(BIG_ID);
    }

    @Test
    @DisplayName("저장되는 기록에는 비교 시각이 채워진다")
    void saveNewComparedAt() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        assertThat(savedCompare().getComparedAt()).isNotNull();
    }

    // ---------- 기록 POST: 이미 저장한 조합 (409) ----------

    @Test
    @DisplayName("같은 조합이 이미 있으면 409 (CONFLICT)")
    void saveExistingPairConflict() {
        // Given
        givenBothOnProducts();
        when(compareHistoryRepository.existsByMemberIdAndProductAIdAndProductBId(MEMBER_ID, SMALL_ID, BIG_ID))
                .thenReturn(true);

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    @Test
    @DisplayName("409의 안내 문구에 '이미 저장한 조합'이 들어 있다")
    void saveExistingPairConflictMessage() {
        // Given
        givenBothOnProducts();
        when(compareHistoryRepository.existsByMemberIdAndProductAIdAndProductBId(MEMBER_ID, SMALL_ID, BIG_ID))
                .thenReturn(true);

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .hasMessageContaining("이미 저장한 조합");
    }

    @Test
    @DisplayName("순서를 바꿔 보내도 같은 조합이면 409")
    void saveExistingPairReversedOrderConflict() {
        // Given: DB에는 (작은, 큰) 순서로 들어 있다
        givenBothOnProducts();
        when(compareHistoryRepository.existsByMemberIdAndProductAIdAndProductBId(MEMBER_ID, SMALL_ID, BIG_ID))
                .thenReturn(true);

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(BIG_ID, SMALL_ID)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    @Test
    @DisplayName("같은 조합이 이미 있으면 새로 저장하지 않고 아무것도 지우지 않는다")
    void saveExistingPairDoesNotSaveOrDelete() {
        // Given
        givenBothOnProducts();
        when(compareHistoryRepository.existsByMemberIdAndProductAIdAndProductBId(MEMBER_ID, SMALL_ID, BIG_ID))
                .thenReturn(true);

        // When
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(compareHistoryRepository, never()).save(any(CompareHistory.class));
        verify(compareHistoryRepository, never()).delete(any(CompareHistory.class));
    }

    // ---------- 기록 POST: 10개 유지 ----------

    @Test
    @DisplayName("기록이 9개이면 새로 저장해도 지우지 않는다")
    void saveWithNineDoesNotDelete() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(9L);

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        verify(compareHistoryRepository, never()).delete(any(CompareHistory.class));
        verify(compareHistoryRepository, times(1)).save(any(CompareHistory.class));
    }

    @Test
    @DisplayName("기록이 10개일 때 새로 저장하면 가장 오래된 것을 지운다")
    void saveWithTenDeletesOldest() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(10L);
        CompareHistory oldest = compareOf(7L, MEMBER_ID, 1L, 2L, NEWEST.minusDays(30));
        when(compareHistoryRepository.findFirstByMemberIdOrderByCompareIdAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        verify(compareHistoryRepository, times(1)).delete(oldest);
        verify(compareHistoryRepository, times(1)).save(any(CompareHistory.class));
    }

    @Test
    @DisplayName("10개를 넘은 상태여도 오래된 것 하나를 지우고 새로 저장한다")
    void saveWithElevenDeletesOnlyOne() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(11L);
        CompareHistory oldest = compareOf(7L, MEMBER_ID, 1L, 2L, NEWEST.minusDays(30));
        when(compareHistoryRepository.findFirstByMemberIdOrderByCompareIdAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        verify(compareHistoryRepository, times(1)).delete(any(CompareHistory.class));
    }

    @Test
    @DisplayName("오래된 것을 먼저 지운 다음 새 기록을 저장한다")
    void saveDeletesBeforeSave() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(10L);
        CompareHistory oldest = compareOf(7L, MEMBER_ID, 1L, 2L, NEWEST.minusDays(30));
        when(compareHistoryRepository.findFirstByMemberIdOrderByCompareIdAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID));

        // Then
        InOrder order = inOrder(compareHistoryRepository);
        order.verify(compareHistoryRepository).delete(oldest);
        order.verify(compareHistoryRepository).save(any(CompareHistory.class));
    }

    @Test
    @DisplayName("동시 요청으로 DB unique가 막으면 CONFLICT(409)")
    void saveUniqueViolation() {
        // Given
        givenBothOnProducts();
        givenNoExistingPair();
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);
        when(compareHistoryRepository.save(any(CompareHistory.class))).thenThrow(new DataIntegrityViolationException("unique"));

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.saveCompareHistory(MEMBER_ID, request(SMALL_ID, BIG_ID)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    // ---------- 목록 GET ----------

    @Test
    @DisplayName("목록은 최근 비교 순서 그대로 담긴다 (첫 번째가 가장 최근)")
    void getKeepsOrder() {
        // Given
        givenCompares(3);
        givenProductsForAll(3);

        // When
        List<CompareHistoryResponseDTO> result = compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then
        assertThat(result).extracting(CompareHistoryResponseDTO::getCompareId).containsExactly(500L, 501L, 502L);
    }

    @Test
    @DisplayName("한 줄에 compareId와 comparedAt이 기록의 값으로 담긴다")
    void getMapsCompareIdAndComparedAt() {
        // Given
        givenCompares(1);
        givenProductsForAll(1);

        // When
        CompareHistoryResponseDTO row = compareHistoryService.getCompareHistories(MEMBER_ID).get(0);

        // Then
        assertThat(row.getCompareId()).isEqualTo(COMPARE_ID);
        assertThat(row.getComparedAt()).isEqualTo(NEWEST);
    }

    @Test
    @DisplayName("productA는 A 번호의 상품, productB는 B 번호의 상품이다")
    void getMapsProductAAndB() {
        // Given
        givenCompares(1);
        givenProductsForAll(1);

        // When
        CompareHistoryResponseDTO row = compareHistoryService.getCompareHistories(MEMBER_ID).get(0);

        // Then: 첫 기록은 A=101, B=201
        assertThat(row.getProductA().getProductId()).isEqualTo(101L);
        assertThat(row.getProductB().getProductId()).isEqualTo(201L);
    }

    @Test
    @DisplayName("기록이 없으면 빈 목록이다")
    void getEmpty() {
        // Given
        givenCompares(0);

        // When
        List<CompareHistoryResponseDTO> result = compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then
        assertThat(result).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("숨김(HIDDEN) 상품이 낀 기록도 목록에 남는다")
    void getKeepsHiddenProduct() {
        // Given
        givenCompares(1);
        LoanProduct hidden = product(101L, ProductStatus.HIDDEN);
        LoanProduct on = product(201L, ProductStatus.ON);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(hidden, on));

        // When
        List<CompareHistoryResponseDTO> result = compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then
        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("A 상품을 찾지 못한 기록은 목록에서 건너뛴다")
    void getSkipsMissingProductA() {
        // Given
        givenCompares(2);
        LoanProduct a2 = product(102L, ProductStatus.ON);
        LoanProduct b1 = product(201L, ProductStatus.ON);
        LoanProduct b2 = product(202L, ProductStatus.ON);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(a2, b1, b2));

        // When
        List<CompareHistoryResponseDTO> result = compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then: 첫 기록(A=101 없음)은 빠지고 둘째 기록만 남는다
        assertThat(result).extracting(CompareHistoryResponseDTO::getCompareId).containsExactly(501L);
    }

    @Test
    @DisplayName("B 상품을 찾지 못한 기록은 목록에서 건너뛴다")
    void getSkipsMissingProductB() {
        // Given
        givenCompares(2);
        LoanProduct a1 = product(101L, ProductStatus.ON);
        LoanProduct a2 = product(102L, ProductStatus.ON);
        LoanProduct b2 = product(202L, ProductStatus.ON);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(a1, a2, b2));

        // When
        List<CompareHistoryResponseDTO> result = compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then: 첫 기록(B=201 없음)은 빠지고 둘째 기록만 남는다
        assertThat(result).extracting(CompareHistoryResponseDTO::getCompareId).containsExactly(501L);
    }

    @Test
    @DisplayName("상품은 기록마다 따로 조회하지 않고 한 번에 조회한다")
    void getLoadsProductsOnce() {
        // Given
        givenCompares(5);
        givenProductsForAll(5);

        // When
        compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then
        verify(loanProductRepository, times(1)).findAllById(any());
    }

    @Test
    @DisplayName("여러 기록에 같은 상품이 있어도 상품 번호는 한 번씩만 조회한다")
    void getLoadsSameProductOnce() {
        // Given: 두 기록 모두 (10, 30)
        List<CompareHistory> compares = List.of(
                compareOf(500L, MEMBER_ID, SMALL_ID, BIG_ID, NEWEST),
                compareOf(501L, MEMBER_ID, SMALL_ID, BIG_ID, NEWEST.minusMinutes(1)));
        when(compareHistoryRepository.findByMemberIdOrderByCompareIdDesc(MEMBER_ID)).thenReturn(compares);
        LoanProduct small = product(SMALL_ID, ProductStatus.ON);
        LoanProduct big = product(BIG_ID, ProductStatus.ON);
        when(loanProductRepository.findAllById(any())).thenReturn(List.of(small, big));

        // When
        compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then
        ArgumentCaptor<Iterable<Long>> captor = idsCaptor();
        verify(loanProductRepository).findAllById(captor.capture());
        List<Long> askedIds = new ArrayList<>();
        captor.getValue().forEach(askedIds::add);
        assertThat(askedIds).containsExactlyInAnyOrder(SMALL_ID, BIG_ID);
    }

    @Test
    @DisplayName("상품에 붙은 태그가 응답의 상품 요약에 담긴다")
    void getIncludesTags() {
        // Given
        givenCompares(1);
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
        CompareHistoryResponseDTO row = compareHistoryService.getCompareHistories(MEMBER_ID).get(0);

        // Then: 태그는 101번(A)에만 붙어 있다
        assertThat(row.getProductA().getTags()).hasSize(1);
        assertThat(row.getProductB().getTags()).isEmpty();
    }

    @Test
    @DisplayName("목록은 인자로 받은 회원 번호의 기록만 조회한다 (B3)")
    void getUsesGivenMemberId() {
        // Given
        givenCompares(0);

        // When
        compareHistoryService.getCompareHistories(MEMBER_ID);

        // Then
        verify(compareHistoryRepository).findByMemberIdOrderByCompareIdDesc(MEMBER_ID);
    }

    // ---------- 한 건 삭제 ----------

    @Test
    @DisplayName("내 기록이면 그 1건을 삭제한다")
    void deleteOneDeletes() {
        // Given
        CompareHistory mine = compareOf(COMPARE_ID, MEMBER_ID, SMALL_ID, BIG_ID, NEWEST);
        when(compareHistoryRepository.findByMemberIdAndCompareId(MEMBER_ID, COMPARE_ID)).thenReturn(Optional.of(mine));

        // When
        compareHistoryService.deleteCompareHistory(MEMBER_ID, COMPARE_ID);

        // Then
        verify(compareHistoryRepository, times(1)).delete(mine);
    }

    @Test
    @DisplayName("없는 기록이면 404")
    void deleteOneNotFound() {
        // Given
        when(compareHistoryRepository.findByMemberIdAndCompareId(MEMBER_ID, COMPARE_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.deleteCompareHistory(MEMBER_ID, COMPARE_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("없는 기록이면 아무것도 삭제하지 않는다")
    void deleteOneNotFoundDeletesNothing() {
        // Given
        when(compareHistoryRepository.findByMemberIdAndCompareId(MEMBER_ID, COMPARE_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> compareHistoryService.deleteCompareHistory(MEMBER_ID, COMPARE_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(compareHistoryRepository, never()).delete(any(CompareHistory.class));
    }

    @Test
    @DisplayName("남의 기록 번호로 지우면 같은 404이고 남의 기록은 삭제되지 않는다 (B3)")
    void deleteOthersRecordNotDeleted() {
        // Given: 남의 compareId는 내 회원 번호로 찾으면 나오지 않는다
        when(compareHistoryRepository.findByMemberIdAndCompareId(MEMBER_ID, 999L)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> compareHistoryService.deleteCompareHistory(MEMBER_ID, 999L))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(compareHistoryRepository, never()).delete(any(CompareHistory.class));
    }

    @Test
    @DisplayName("한 건 삭제는 회원 번호와 기록 번호를 함께 넣어 찾는다 (B3)")
    void deleteOneLooksUpWithMemberId() {
        // Given
        CompareHistory mine = compareOf(COMPARE_ID, MEMBER_ID, SMALL_ID, BIG_ID, NEWEST);
        when(compareHistoryRepository.findByMemberIdAndCompareId(MEMBER_ID, COMPARE_ID)).thenReturn(Optional.of(mine));

        // When
        compareHistoryService.deleteCompareHistory(MEMBER_ID, COMPARE_ID);

        // Then
        verify(compareHistoryRepository).findByMemberIdAndCompareId(MEMBER_ID, COMPARE_ID);
        verify(compareHistoryRepository, never()).findById(any());
        verify(compareHistoryRepository, never()).deleteById(any());
    }

    // ---------- 전체 삭제 ----------

    @Test
    @DisplayName("전체 삭제는 내 기록 전체를 삭제한다")
    void deleteAllDeletesMine() {
        // Given
        List<CompareHistory> mine = List.of(
                compareOf(500L, MEMBER_ID, 1L, 2L, NEWEST), compareOf(501L, MEMBER_ID, 3L, 4L, NEWEST));
        when(compareHistoryRepository.findByMemberIdOrderByCompareIdDesc(MEMBER_ID)).thenReturn(mine);

        // When
        compareHistoryService.deleteCompareHistories(MEMBER_ID);

        // Then
        verify(compareHistoryRepository).deleteAll(mine);
    }

    @Test
    @DisplayName("전체 삭제는 인자로 받은 회원 번호의 기록만 찾는다 (B3)")
    void deleteAllUsesGivenMemberId() {
        // Given
        when(compareHistoryRepository.findByMemberIdOrderByCompareIdDesc(MEMBER_ID)).thenReturn(List.of());

        // When
        compareHistoryService.deleteCompareHistories(MEMBER_ID);

        // Then
        verify(compareHistoryRepository).findByMemberIdOrderByCompareIdDesc(MEMBER_ID);
    }

    @Test
    @DisplayName("지울 기록이 없어도 오류 없이 끝난다")
    void deleteAllWithNoRecords() {
        // Given
        when(compareHistoryRepository.findByMemberIdOrderByCompareIdDesc(MEMBER_ID)).thenReturn(List.of());

        // When, Then
        assertThatCode(() -> compareHistoryService.deleteCompareHistories(MEMBER_ID)).doesNotThrowAnyException();
    }

    // ---------- 도우미 ----------

    // 판매 중(ON)인 상품 한 개
    private void givenOnProduct(Long productId) {
        when(loanProductRepository.findByProductIdAndProductStatus(productId, ProductStatus.ON))
                .thenReturn(Optional.of(mock(LoanProduct.class)));
    }

    // SMALL_ID, BIG_ID 두 상품 모두 판매 중
    private void givenBothOnProducts() {
        givenOnProduct(SMALL_ID);
        givenOnProduct(BIG_ID);
    }

    // 이 회원에게 SMALL_ID, BIG_ID 조합이 아직 없는 상태
    private void givenNoExistingPair() {
        when(compareHistoryRepository.existsByMemberIdAndProductAIdAndProductBId(MEMBER_ID, SMALL_ID, BIG_ID))
                .thenReturn(false);
    }

    private CompareHistoryRequestDTO request(Long productAId, Long productBId) {
        CompareHistoryRequestDTO dto = new CompareHistoryRequestDTO();
        dto.setProductAId(productAId);
        dto.setProductBId(productBId);
        return dto;
    }

    // 최근 비교 순으로 정렬된 기록 count개: 0번째가 가장 최근, 기록 번호 500부터,
    // i번째 기록의 A는 101 + i, B는 201 + i
    private void givenCompares(int count) {
        List<CompareHistory> compares = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            compares.add(compareOf(COMPARE_ID + i, MEMBER_ID, 101L + i, 201L + i, NEWEST.minusMinutes(i)));
        }
        when(compareHistoryRepository.findByMemberIdOrderByCompareIdDesc(MEMBER_ID)).thenReturn(compares);
    }

    // 기록 count개에 맞는 상품(A 101.., B 201..)이 모두 있는 것으로 가정
    private void givenProductsForAll(int count) {
        List<LoanProduct> products = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            products.add(product(101L + i, ProductStatus.ON));
            products.add(product(201L + i, ProductStatus.ON));
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

    private CompareHistory compareOf(Long compareId, Long memberId, Long productAId, Long productBId,
                                     LocalDateTime comparedAt) {
        return CompareHistory.builder().compareId(compareId).memberId(memberId)
                .productAId(productAId).productBId(productBId).comparedAt(comparedAt).build();
    }

    // save에 넘어간 CompareHistory를 꺼낸다
    private CompareHistory savedCompare() {
        ArgumentCaptor<CompareHistory> captor = ArgumentCaptor.forClass(CompareHistory.class);
        verify(compareHistoryRepository).save(captor.capture());
        return captor.getValue();
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<Iterable<Long>> idsCaptor() {
        return ArgumentCaptor.forClass((Class<Iterable<Long>>) (Class<?>) Iterable.class);
    }
}
