package chorong.member.dto;

import chorong.member.entity.Member;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.regex.Pattern;
/*
 * 소셜(카카오, 네이버)에서 받은 값. 신규 회원이면 가입 대기 세션(PENDING_SIGNUP)에 10분 담아 둠
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SocialUserDTO implements Serializable {

    private static final long serialVersionUID = 1L;
    private static final int MAX_NICKNAME_LENGTH = 12;
    private static final Pattern BIRTH_YEAR = Pattern.compile("^\\d{4}$");
    private static final Pattern BIRTH_DAY = Pattern.compile("^\\d{2}-\\d{2}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private String loginType;           // KAKAO, NAVER
    private String socialId;            // 카카오 id / 네이버 response.id
    private String memberNickname;
    private String birthYear;           // 'YYYY', 없으면 null
    private String birthDay;            // 'MM-DD', 없으면 null
    private LocalDateTime pendingAt;    // 가입 대기에 담은 시각 (10분 확인용)

    /** provider(kakao, naver)별로 사용자 정보를 꺼냄. 고유번호가 없거나 모르는 provider면 IllegalArgumentException */
    public static SocialUserDTO of(String provider, Map<String, Object> attributes) {
        if ("kakao".equals(provider)) {
            return ofKakao(attributes);
        }
        if ("naver".equals(provider)) {
            return ofNaver(attributes);
        }
        throw new IllegalArgumentException("지원하지 않는 로그인 제공자입니다.");
    }

    // 카카오: 고유번호, 닉네임 (생년월일은 받지 않음)
    private static SocialUserDTO ofKakao(Map<String, Object> attributes) {
        Object profile = get(get(attributes, "kakao_account"), "profile");
        SocialUserDTO dto = new SocialUserDTO();
        dto.loginType = "KAKAO";
        dto.socialId = toText(attributes.get("id"));
        dto.memberNickname = makeNickname(toText(get(profile, "nickname")));
        checkSocialId(dto);
        return dto;
    }

    // 네이버: response.id, 닉네임, 출생연도, 생일 (형식이 틀리거나 하나라도 비면 둘 다 비움)
    private static SocialUserDTO ofNaver(Map<String, Object> attributes) {
        Object response = attributes.get("response");
        SocialUserDTO dto = new SocialUserDTO();
        dto.loginType = "NAVER";
        dto.socialId = toText(get(response, "id"));
        dto.memberNickname = makeNickname(toText(get(response, "nickname")));
        String year = toText(get(response, "birthyear"));
        String day = toText(get(response, "birthday"));
        if (year != null && day != null && BIRTH_YEAR.matcher(year).matches() && BIRTH_DAY.matcher(day).matches()) {
            dto.birthYear = year;
            dto.birthDay = day;
        }
        checkSocialId(dto);
        return dto;
    }

    /** 가입 화면에서 생년월일을 직접 입력받아야 하는지 (카카오이거나 네이버가 비워 보냄) */
    public boolean needBirth() {
        return birthYear == null || birthDay == null;
    }

    /** 같은 값을 가진 복사본 */
    public SocialUserDTO copy() {
        return new SocialUserDTO(loginType, socialId, memberNickname, birthYear, birthDay, pendingAt);
    }



    /** 가입 완료 때 member 만들기 (약관 동의 시각 = 지금) */
    public Member toEntity(String birthYear, String birthDay) {
        LocalDateTime now = LocalDateTime.now();
        return Member.builder()
                .loginType(this.loginType)
                .socialId(this.socialId)
                .memberNickname(this.memberNickname)
                .birthYear(birthYear)
                .birthDay(birthDay)
                .memberStatus(1)
                .termsAgreedAt(now)
                .createdAt(now)
                .build();
    }

    // 닉네임이 비어 오면 '캐링회원' + 임의 숫자 4자리, 12자 넘으면 12자로 자름
    private static String makeNickname(String nickname) {
        if (nickname == null) {
            return "캐링회원" + String.format("%04d", RANDOM.nextInt(10000));
        }
        if (nickname.codePointCount(0, nickname.length()) > MAX_NICKNAME_LENGTH) {
            return nickname.substring(0, nickname.offsetByCodePoints(0, MAX_NICKNAME_LENGTH));
        }
        return nickname;
    }

    private static void checkSocialId(SocialUserDTO dto) {
        if (dto.socialId == null) {
            throw new IllegalArgumentException("소셜 고유번호가 없습니다.");
        }
    }

    // 소셜이 준 값은 타입을 믿지 않고 꺼냄 (B13)
    private static Object get(Object map, String key) {
        return map instanceof Map<?, ?> m ? m.get(key) : null;
    }

    // 문자로 바꾸고 앞뒤 공백 제거, 비면 null
    private static String toText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
