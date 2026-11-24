package chorong.admin.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * admin_token 테이블 (관리자 로그인 토큰, 원문은 저장하지 않고 SHA-256 해시만, B17)
 * 가입 인증 토큰은 DB가 아니라 세션에 둠 (ADMIN-07)
 */
@Entity
@Table(name = "admin_token")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class AdminToken {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "token_id")
	private Long tokenId;

	@Column(name = "admin_id")
	private Long adminId;				// 어느 관리자의 토큰인지

	@Column(name = "token_hash")
	private String tokenHash;			// SHA-256 16진수 64자

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "used_yn", length = 1)
	private String usedYn;				// 'Y' 사용함(또는 무효), 'N' 안 씀

	@Column(name = "token_history")
	private LocalDateTime tokenHistory;	// 발급 일시 (+ 2시간 지나면 무효)

	/** 로그인에 쓴 토큰은 다시 못 쓰게 */
	public void use() {
		this.usedYn = "Y";
	}
}
