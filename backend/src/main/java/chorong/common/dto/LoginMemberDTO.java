package chorong.common.dto;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 세션에 넣는 로그인 회원 값 (키 SessionConst.LOGIN_MEMBER)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginMemberDTO implements Serializable {
	private static final long serialVersionUID = 1L;

	private Long memberId;			// 회원 번호
	private String memberNickname;	// 닉네임
	private String birthYear;		// 출생연도 'YYYY'
	private String birthDay;		// 생일 'MM-DD'
}
