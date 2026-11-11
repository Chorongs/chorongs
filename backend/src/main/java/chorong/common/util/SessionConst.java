package chorong.common.util;

/*
 * 세션 키를 한 곳에 모아 둔 상수 클래스 (세션 키는 여기에만)
 */
public class SessionConst {

	public static final String LOGIN_MEMBER = "loginMember";		// 로그인 회원 (LoginMemberDTO)
	public static final String LOGIN_ADMIN = "loginAdmin";			// 로그인 관리자 (LoginAdminDTO)
	public static final String PENDING_SIGNUP = "pendingSignup";	// 가입 대기 소셜 정보 (10분)
	public static final String VIEWED_PRODUCTS = "viewedProducts";	// 본 상품 번호 Set (조회수 세션당 1회)

	// 상수만 두는 클래스라 객체 생성을 막음
	private SessionConst() {}
}
