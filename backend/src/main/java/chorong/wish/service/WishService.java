package chorong.wish.service;

import chorong.common.dto.PageInfo;
import chorong.wish.dto.WishResponseDTO;

/*
 * 찜 목록, 찜하기, 찜 취소 (MEM-04)
 * 회원당 30개, 이미 찜 409 ALREADY_LIKED, 가득 참 409 LIKE_FULL, 없는 상품 404
 */
public interface WishService {

    // 찜 목록 (최신순, 쪽 나눔)
    // 찜 목록 (최신순, 쪽 나눔)
    PageInfo<WishResponseDTO> getWishes(Long memberId, int page, int size);

    // 찜하기 (상품 확인 → 30개면 LIKE_FULL → 저장)
    void saveWish(Long memberId, Long productId);

    // 찜 취소 (내 찜만)
    void deleteWish(Long memberId, Long productId);

}
