package chorong.history.service.compareHistory;

/*
 * 비교 내역 목록, 기록, 삭제 (MEM-10)
 * 회원당 최근 10개, 두 상품 조합 (순서 상관없이 같은 조합이면 409 '이미 저장한 조합'), 10개 넘으면 오래된 것 삭제
 * A = B면 400, 없는 상품 404, 없거나 남의 기록 한 건 삭제 404 (B3)
 * DB: 작은 번호를 product_a_id에 넣어 저장 (check product_a_id < product_b_id, unique member_id + a + b)
 */
public interface CompareHistoryService {

    // 비교 내역 목록 (최근 10개: compareId, comparedAt, productA, productB)
    void getCompareHistories();

    // 기록 (A, B 다름 확인 → 같은 조합 있으면 409, 없으면 추가 → 10개 넘으면 오래된 것 삭제)
    void saveCompareHistory();

    // 한 건 삭제 (내 기록 중 그 1건, 없거나 남의 기록은 404)
    void deleteCompareHistory();

    // 전체 삭제 (내 기록 전체)
    void deleteCompareHistories();
}
