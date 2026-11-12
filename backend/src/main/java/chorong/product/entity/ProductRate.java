package chorong.product.entity;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/* product_rate 테이블 (상품별 구간 금리, 최신 월만) */
@Entity
@Table(name = "product_rate")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProductRate {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "rate_id")
	private Long rateId;

	@Column(name = "product_id")
	private Long productId;

	@Enumerated(EnumType.STRING)
	@Column(name = "rate_kind")
	private RateKind rateKind;			// CREDIT, REPAY, RATE_TYPE

	@Column(name = "rate_key")
	private String rateKey;				// CREDIT이면 금감원 신용 등급 코드 (1, 4, 5, 6, 10~13)

	@Column(name = "rate_min")
	private BigDecimal rateMin;

	@Column(name = "rate_max")
	private BigDecimal rateMax;

	@Enumerated(EnumType.STRING)
	@Column(name = "rate_source")
	private RateSource rateSource;		// DISCLOSED, ESTIMATED
}
