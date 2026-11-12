package chorong.product.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * loan_product 테이블 (대출 상품, 서민금융진흥원 + 금융감독원 통합)
 * 값은 생성자, 변경 메서드로만 바꿈 (@Setter 안 씀) -> 불러오기, 숨기기 등 메서드는 그 기능 담당이 추가
 */
@Entity
@Table(name = "loan_product")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoanProduct {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "product_id")
	private Long productId;

	@Enumerated(EnumType.STRING)
	@Column(name = "source")
	private Source source;					// KINFA, FSS

	@Column(name = "source_code")
	private String sourceCode;				// 신협 묶음은 032000으로 시작

	@Column(name = "company_name")
	private String companyName;

	@Column(name = "product_name")
	private String productName;

	@Enumerated(EnumType.STRING)
	@Column(name = "loan_type")
	private LoanType loanType;

	@Column(name = "rate_min")
	private BigDecimal rateMin;				// 연 %

	@Column(name = "rate_max")
	private BigDecimal rateMax;				// 연 %

	@Column(name = "limit_amount")
	private Long limitAmount;				// 만원

	@Column(name = "term_max")
	private Integer termMax;				// 개월

	@Column(name = "credit_min")
	private Integer creditMin;

	@Column(name = "credit_max")
	private Integer creditMax;

	@Column(name = "age_min")
	private Integer ageMin;

	@Column(name = "age_max")
	private Integer ageMax;

	@Column(name = "income_min")
	private Integer incomeMin;				// 연 만원

	@Column(name = "income_max")
	private Integer incomeMax;				// 연 만원

	@Enumerated(EnumType.STRING)
	@Column(name = "income_basis")
	private IncomeBasis incomeBasis;		// null 조건 없음

	@Column(name = "income_note")
	private String incomeNote;

	@Column(name = "prepay_fee_max")
	private BigDecimal prepayFeeMax;		// 0 = 수수료 없음, 숫자 = 최대 %, null = 정보 없음

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "no_prepay_fee_yn", length = 1)
	private String noPrepayFeeYn;			// 'Y', 'N', null

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "online_yn", length = 1)
	private String onlineYn;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "policy_yn", length = 1)
	private String policyYn;

	@Enumerated(EnumType.STRING)
	@Column(name = "rate_type")
	private RateType rateType;				// FIXED, VARIABLE, BOTH, null

	@Column(name = "extra_cond")
	private String extraCond;				// 세대 조건만

	@Column(name = "target_detail")
	private String targetDetail;

	@Lob
	@Column(name = "raw_json")
	private String rawJson;

	@Column(name = "note")
	private String note;

	@Column(name = "view_count")
	private Long viewCount;

	@Column(name = "base_date")
	private LocalDateTime baseDate;

	@Column(name = "disclose_start")
	private LocalDateTime discloseStart;

	@Column(name = "disclose_end")
	private LocalDateTime discloseEnd;

	@Enumerated(EnumType.STRING)
	@Column(name = "product_status")
	private ProductStatus productStatus;	// ON, CLOSED, HIDDEN
}
