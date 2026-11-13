package chorong.recommend.dto;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * 맞춤 추천(API-06), 내 조건 판정(API-44) 입력값
 * 코드, 범위는 명세서 '추천 규칙' 시트 입력 줄 / 입력값은 저장, 로그 금지라 toString에서 모두 뺌 (B8)
 * 용도에 맞는 갚을 기간, 우선순위 중복, 기존 대출 값은 Service에서 확인
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecommendRequestDTO {

	// 허용 코드 (저장 요청 DTO도 같이 씀)
	public static final String JOB_PATTERN = "^(OFFICE|BIZ|FREELANCER|STUDENT|PART_TIME|HOMEMAKER|NO_INCOME|FARM)$";
	public static final String PURPOSE_PATTERN = "^(생활비|전월세|학자금|주택 구입|대환|창업|사업 운영|기타)$";
	private static final String AGE_GROUP_PATTERN = "^(YOUTH|ADULT)$";
	private static final String REGION_PATTERN =
			"^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)$";
	private static final String CREDIT_BAND_PATTERN = "^BAND[1-5]$";
	private static final String PRIORITY_PATTERN = "^(LOW_RATE|HIGH_LIMIT|LOW_PAYMENT|ONLINE|POLICY|NO_PREPAY_FEE)$";

	@ToString.Exclude
	@NotBlank
	@Pattern(regexp = JOB_PATTERN)
	private String job;					// 직업 코드

	@ToString.Exclude
	@NotBlank
	@Pattern(regexp = AGE_GROUP_PATTERN)
	private String ageGroup;			// YOUTH 만 19~34세, ADULT 만 35세 이상

	@ToString.Exclude
	@Pattern(regexp = REGION_PATTERN)
	private String region;				// 시도 이름, 선택 안 함 null

	@ToString.Exclude
	@NotNull
	@Min(0)
	@Max(99999)
	private Integer income;				// 연소득 (만원)

	@ToString.Exclude
	@Min(0)
	private Integer debtMonthly;		// 기존 대출 월 상환 (만원), 모르면 null 가능

	@ToString.Exclude
	@NotNull
	private Boolean debtUnknown;		// 기존 대출 '잘 모르겠어요'

	@ToString.Exclude
	@NotBlank
	@Pattern(regexp = PURPOSE_PATTERN)
	private String purpose;				// 자금 용도 (PURPOSE 칩 값)

	@ToString.Exclude
	@NotNull
	@Min(10)
	@Max(100000)
	private Integer need;				// 필요 금액 (만원)

	@ToString.Exclude
	@NotNull
	private Integer months;				// 갚을 기간 (개월), 모름 0

	@ToString.Exclude
	@NotBlank
	@Pattern(regexp = CREDIT_BAND_PATTERN)
	private String creditBand;			// BAND1~5

	@ToString.Exclude
	@NotNull
	private Boolean overdue;			// 최근 1년 연체

	@ToString.Exclude
	@NotNull
	@Size(min = 1, max = 3)
	private List<@NotNull @Pattern(regexp = PRIORITY_PATTERN) String> priorities;	// 가장 중요한 것 1~3개
}
