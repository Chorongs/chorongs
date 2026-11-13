package chorong.recommend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import chorong.recommend.entity.RecommendResult;

public interface RecommendResultRepository extends JpaRepository<RecommendResult, Long> {

	// 저장 묶음 번호 1개 발급 (저장 1번에 1번만 부름)
	@Query(value = "SELECT seq_recommend_save.NEXTVAL FROM dual", nativeQuery = true)
	Long nextSaveId();

	// 회원의 저장 행 전부 (최신 저장 먼저, 저장 안에서는 순위순)
	List<RecommendResult> findByMemberIdOrderBySaveIdDescRankNoAsc(Long memberId);

	// 내 저장인지
	boolean existsBySaveIdAndMemberId(Long saveId, Long memberId);

	// 내 저장 1개 삭제
	void deleteBySaveIdAndMemberId(Long saveId, Long memberId);

	// 내 저장 전체 삭제
	void deleteByMemberId(Long memberId);
}
