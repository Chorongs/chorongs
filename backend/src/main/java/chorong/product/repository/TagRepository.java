package chorong.product.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.Tag;

public interface TagRepository extends JpaRepository<Tag, Long> {

	// 태그 번호 목록으로 태그 조회 (번호순)
	List<Tag> findByTagIdInOrderByTagId(Collection<Long> tagIds);
}
