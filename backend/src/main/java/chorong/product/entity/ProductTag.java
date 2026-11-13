package chorong.product.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/* product_tag 테이블 (상품과 태그 연결만 저장, 값은 tag) */
@Entity
@Table(name = "product_tag")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProductTag {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "pt_id")
	private Long ptId;

	@Column(name = "tag_id")
	private Long tagId;

	@Column(name = "product_id")
	private Long productId;
}
