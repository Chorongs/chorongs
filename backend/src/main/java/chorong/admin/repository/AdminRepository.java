package chorong.admin.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.admin.entity.Admin;

/*
 * admin 테이블 Repository (다른 기능도 이것을 가져다 씀)
 * findById 등 기본 메서드는 JpaRepository가 만들어 줌
 */
public interface AdminRepository extends JpaRepository<Admin, Long> {
}
