package chorong.product.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.LoanProduct;

public interface LoanProductRepository extends JpaRepository<LoanProduct, Long> {
}
