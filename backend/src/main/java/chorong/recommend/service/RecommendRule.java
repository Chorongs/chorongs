package chorong.recommend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import chorong.product.entity.IncomeBasis;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.LoanType;
import chorong.product.entity.ProductRate;
import chorong.product.entity.RateSource;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.recommend.dto.RecommendRequestDTO;

/*
 * 맞춤 추천(LOAN-01, 02)과 내 조건 판정(LOAN-05)이 같이 쓰는 판정 규칙 한 곳 (명세서 '추천 규칙' 시트)
 * 걸러내기 7개, 항목 판정, 예상 금리, 월 상환, 일치도, 이유 문장, 판단 태그
 * 입력값은 계산에만 쓰고 저장, 로그하지 않음 (B8)
 */
@Component
public class RecommendRule {

	/** 걸러내기 7개 (선언 순서 = 판정 순서). summary: 제외 요약 문구, reason: 상품 1개 판정(LOAN-05)의 사유 */
	public enum Filter {
		PURPOSE("용도가 다른 상품", "용도가 다른 상품이에요"),
		TARGET("신청 대상이 아닌 상품", "신청 대상이 아니에요"),
		REGION("사는 지역이 다른 상품", "사는 지역이 달라요"),
		AGE("나이 조건이 맞지 않는 상품", "나이 조건이 맞지 않아요"),
		CREDIT("신용점수 기준에 맞지 않는 상품", "신용점수 기준에 맞지 않아요"),
		INCOME("소득 기준에 맞지 않는 상품", "소득 기준에 맞지 않아요"),
		LIMIT("한도가 필요 금액보다 작은 상품", "한도가 필요 금액보다 작아요");

		private final String summary;
		private final String reason;

		Filter(String summary, String reason) {
			this.summary = summary;
			this.reason = reason;
		}

		public String getSummary() {
			return summary;
		}

		public String getReason() {
			return reason;
		}
	}

	/** 판정 결과: 통과, 주의, 부족, 출처에 칸 자체가 없음, 제외 */
	public enum Judge {
		PASS, WARN, SHORT, MISSING, FAIL
	}

	/** 0건 hint: 조건 하나만 풀어 다시 셀 때 (선언 순서 = 개수가 같을 때 먼저 고르는 순서) */
	public enum Relax {
		NONE(null),
		AGE("나이 조건을 빼면 %d개"),
		REGION("사는 지역을 고르지 않으면 %d개"),
		INCOME("소득 조건을 빼면 %d개"),
		CREDIT_UP("신용 구간이 한 칸 높으면 %d개"),
		LIMIT("필요 금액을 줄이면 %d개");

		private final String hintFormat;

		Relax(String hintFormat) {
			this.hintFormat = hintFormat;
		}

		public String hintText(long count) {
			return String.format(Locale.ROOT, hintFormat, count);
		}
	}

	// ---- 입력 코드, 칩 값 ----
	public static final String YOUTH = "YOUTH";
	public static final String ADULT = "ADULT";
	public static final String PURPOSE_ETC = "기타";
	private static final String PURPOSE_LIVING = "생활비";
	private static final Set<String> LONG_TERM_PURPOSES = Set.of("전월세", "주택 구입");
	private static final Set<Integer> SHORT_MONTHS = Set.of(0, 12, 36, 60);
	private static final Set<Integer> LONG_MONTHS = Set.of(0, 60, 120, 180);
	private static final int DEFAULT_SHORT_MONTHS = 36;
	private static final int DEFAULT_LONG_MONTHS = 120;

	private static final int YOUTH_MIN_AGE = 19;
	private static final int YOUTH_MAX_AGE = 34;
	private static final int NO_AGE_LIMIT = 999;
	private static final int MAX_SCORE = 1000;

	private static final String TARGET_ALL = "제한 없음";
	private static final String TARGET_LOW_CREDIT = "저신용/서민";
	private static final String TARGET_OFFICE = "직장인";
	private static final String TARGET_BIZ = "사업자";
	private static final String TARGET_YOUTH = "청년/학생";
	private static final String TARGET_SPECIAL = "특별 지원 대상";
	private static final String TARGET_DETAIL_FARM = "농어업";
	private static final String REGION_ALL = "전국";
	private static final String CREDIT_ANY = "신용 무관";
	private static final String AMOUNT_UNLIMITED = "한도 제한 없음";
	private static final String REPAY_EQUAL = "원리금균등";
	private static final String REPAY_BULLET = "만기일시";
	private static final String GROUPED_PREFIX = "032000";		// 신협 묶음 상품 번호 앞자리

	// 신용 구간 -> NICE 점수 범위 (최저, 최고)
	private static final Map<String, List<Integer>> BAND_SCORES = Map.of(
			"BAND1", List.of(901, 1000),
			"BAND2", List.of(801, 900),
			"BAND3", List.of(701, 800),
			"BAND4", List.of(601, 700),
			"BAND5", List.of(0, 600));

	// 신용 구간 -> product_rate.rate_key (BAND5는 네 칸의 최저~최고)
	private static final Map<String, List<String>> BAND_RATE_KEYS = Map.of(
			"BAND1", List.of("1"),
			"BAND2", List.of("4"),
			"BAND3", List.of("5"),
			"BAND4", List.of("6"),
			"BAND5", List.of("10", "11", "12", "13"));

	private static final List<String> BANDS = List.of("BAND1", "BAND2", "BAND3", "BAND4", "BAND5");

	// ---- 설정값 (application.properties recommend.*) ----
	private final double penaltyWarn;		// 주의 1개 감점
	private final double penaltyShort;		// 부족 1개 감점
	private final double penaltyMissing;	// 출처에 칸 없는 항목 1개 감점
	private final double weightCondition;	// 조건 점수 비율
	private final double weightPriority;	// 고른 기준 점수 비율
	private final int burdenMax;			// 월 부담 충족 상한 (%)
	private final int burdenEasy;			// 월 부담 '여유' 상한 (%)

	public RecommendRule(
			@Value("${recommend.penalty-warn}") double penaltyWarn,
			@Value("${recommend.penalty-short}") double penaltyShort,
			@Value("${recommend.penalty-missing}") double penaltyMissing,
			@Value("${recommend.weight-condition}") double weightCondition,
			@Value("${recommend.weight-priority}") double weightPriority,
			@Value("${recommend.burden-max}") int burdenMax,
			@Value("${recommend.burden-easy}") int burdenEasy) {
		this.penaltyWarn = penaltyWarn;
		this.penaltyShort = penaltyShort;
		this.penaltyMissing = penaltyMissing;
		this.weightCondition = weightCondition;
		this.weightPriority = weightPriority;
		this.burdenMax = burdenMax;
		this.burdenEasy = burdenEasy;
	}

	/** 추천 후보 1개 = 게시 상품 + 태그 + 신용 구간 금리 (메모리 캐시에 보관) */
	public static class Candidate {
		private final LoanProduct product;
		private final List<Tag> tags;
		private final List<ProductRate> creditRates;

		public Candidate(LoanProduct product, List<Tag> tags, List<ProductRate> creditRates) {
			this.product = product;
			this.tags = List.copyOf(tags);
			this.creditRates = List.copyOf(creditRates);
		}

		public LoanProduct getProduct() {
			return product;
		}

		public List<Tag> getTags() {
			return new ArrayList<>(tags);
		}

		public List<ProductRate> getCreditRates() {
			return new ArrayList<>(creditRates);
		}

		/** 태그 종류 하나의 값 목록 (예: PURPOSE -> 생활비, 대환) */
		public List<String> values(TagType tagType) {
			List<String> values = new ArrayList<>();
			for (Tag tag : tags) {
				if (tag.getTagType() == tagType) {
					values.add(tag.getTagValue());
				}
			}
			return values;
		}
	}

	/** 상품 1개 판정 결과 (같은 패키지의 Service만 읽음) */
	public static class Evaluation {
		final Candidate candidate;
		Filter failed;								// 처음 걸린 걸러내기, 통과면 null

		// 걸러내기 7개 + 항목 판정 4개 (일치도 조건 점수 항목)
		Judge purpose;
		Judge target;
		Judge region;
		Judge age;
		Judge credit;
		Judge income;
		Judge limit;
		Judge overdue;
		Judge term;
		Judge burden;
		Judge extra;

		boolean purposeCheck;		// 용도 '기타' -> '용도 확인 필요'
		boolean creditNoCriteria;	// '신용 무관'
		boolean creditRanged;		// 상품 점수 범위가 있음
		boolean ageCondition;		// 나이 조건 있음
		boolean incomeCondition;	// 소득 조건 있음
		boolean limitUnlimited;		// '한도 제한 없음'
		boolean grouped;			// 신협 묶음

		BigDecimal estRateMin;		// 예상 금리 (연 %)
		BigDecimal estRateMax;
		BigDecimal rateMid;			// 가운데 값 (월 상환, 금리 순위)
		boolean rateEstimated;
		Long monthlyPayment;		// 원
		String calcNote;
		Double burdenRatio;			// 월 부담 비율 (%)
		int termMonths;				// 갚을 기간 (모름이면 가정한 값)

		Integer rateRank;			// 후보 안 금리 순위 (금리 없으면 null)
		int rateCount;
		Integer paymentRank;		// 후보 안 월 상환 순위 (계산 못 하면 null)
		int paymentCount;
		double matchRate;			// 일치도 0~100 (정렬은 소수점까지)

		Evaluation(Candidate candidate) {
			this.candidate = candidate;
		}

		/** 일치도 조건 점수 항목 11개 (걸러내기를 통과한 상품만) */
		List<Judge> items() {
			return List.of(purpose, target, region, age, credit, income, overdue, limit, term, burden, extra);
		}
	}

	// =================== 판정 ===================

	/** 상품 1개 판정: 걸러내기 7개 (처음 걸린 사유에서 멈춤) -> 항목 판정 -> 예상 금리, 월 상환, 월 부담 */
	public Evaluation evaluate(Candidate c, RecommendRequestDTO req, int ageMin, int ageMax) {
		LoanProduct p = c.getProduct();
		Evaluation e = new Evaluation(c);

		e.purposeCheck = PURPOSE_ETC.equals(req.getPurpose());
		e.purpose = judgePurpose(c, req.getPurpose());
		if (e.purpose == Judge.FAIL) return failed(e, Filter.PURPOSE);

		e.target = judgeTarget(c, req.getJob(), isYouth(ageMin, ageMax));
		if (e.target == Judge.FAIL) return failed(e, Filter.TARGET);

		e.region = judgeRegion(c, req.getRegion());
		if (e.region == Judge.FAIL) return failed(e, Filter.REGION);

		e.ageCondition = p.getAgeMin() != null || p.getAgeMax() != null;
		e.age = judgeAge(p, ageMin, ageMax);
		if (e.age == Judge.FAIL) return failed(e, Filter.AGE);

		e.creditNoCriteria = !isCreditMissing(p) && c.values(TagType.CREDIT).contains(CREDIT_ANY);
		e.creditRanged = p.getCreditMin() != null || p.getCreditMax() != null;
		e.credit = judgeCredit(c, req.getCreditBand());
		if (e.credit == Judge.FAIL) return failed(e, Filter.CREDIT);

		e.incomeCondition = p.getIncomeBasis() != null || p.getIncomeMin() != null || p.getIncomeMax() != null;
		e.income = judgeIncome(p, req.getIncome());
		if (e.income == Judge.FAIL) return failed(e, Filter.INCOME);

		e.limitUnlimited = c.values(TagType.AMOUNT).contains(AMOUNT_UNLIMITED);
		e.limit = judgeLimit(c, req.getNeed());
		if (e.limit == Judge.FAIL) return failed(e, Filter.LIMIT);

		// 항목 판정 (제외 안 함)
		e.overdue = Boolean.TRUE.equals(req.getOverdue()) ? Judge.WARN : Judge.PASS;
		e.termMonths = termOf(req.getPurpose(), req.getMonths());
		e.term = judgeTerm(p, e.termMonths);
		e.extra = p.getExtraCond() != null && !p.getExtraCond().isBlank() ? Judge.WARN : Judge.PASS;

		estimateRate(e, c, req.getCreditBand());
		calcPayment(e, c, req.getNeed());
		judgeBurden(e, req);
		return e;
	}

	/** 걸러내기 7개만 돌려 처음 걸린 사유 (통과면 null). hint는 조건 하나를 풀어(relax) 다시 셈 */
	public Filter firstFail(Candidate c, RecommendRequestDTO req, int ageMin, int ageMax, Relax relax) {
		LoanProduct p = c.getProduct();
		if (judgePurpose(c, req.getPurpose()) == Judge.FAIL) return Filter.PURPOSE;
		if (judgeTarget(c, req.getJob(), isYouth(ageMin, ageMax)) == Judge.FAIL) return Filter.TARGET;

		String region = relax == Relax.REGION ? null : req.getRegion();
		if (judgeRegion(c, region) == Judge.FAIL) return Filter.REGION;
		if (relax != Relax.AGE && judgeAge(p, ageMin, ageMax) == Judge.FAIL) return Filter.AGE;

		String band = relax == Relax.CREDIT_UP ? higherBand(req.getCreditBand()) : req.getCreditBand();
		if (band != null && judgeCredit(c, band) == Judge.FAIL) return Filter.CREDIT;
		if (relax != Relax.INCOME && judgeIncome(p, req.getIncome()) == Judge.FAIL) return Filter.INCOME;
		if (relax != Relax.LIMIT && judgeLimit(c, req.getNeed()) == Judge.FAIL) return Filter.LIMIT;
		return null;
	}

	private Evaluation failed(Evaluation e, Filter filter) {
		e.failed = filter;
		return e;
	}

	// 1 자금 용도: 칩에 있으면 통과, 칩 없음 주의, '기타'는 생활비 + 기타 상품만 주의로 남김
	private Judge judgePurpose(Candidate c, String purpose) {
		List<String> purposes = c.values(TagType.PURPOSE);
		if (purposes.isEmpty()) return Judge.WARN;
		if (PURPOSE_ETC.equals(purpose)) {
			return purposes.contains(PURPOSE_LIVING) || purposes.contains(PURPOSE_ETC) ? Judge.WARN : Judge.FAIL;
		}
		return purposes.contains(purpose) ? Judge.PASS : Judge.FAIL;
	}

	// 2 지원 대상: 직업별 대상과 하나라도 겹치면 통과
	private Judge judgeTarget(Candidate c, String job, boolean youth) {
		Set<String> allowed = new HashSet<>(List.of(TARGET_ALL, TARGET_LOW_CREDIT));
		if ("OFFICE".equals(job)) allowed.add(TARGET_OFFICE);
		if ("BIZ".equals(job)) allowed.add(TARGET_BIZ);
		if ("STUDENT".equals(job) || youth) allowed.add(TARGET_YOUTH);

		String detail = c.getProduct().getTargetDetail();
		boolean farmProduct = detail != null && detail.contains(TARGET_DETAIL_FARM);
		for (String target : c.values(TagType.TARGET)) {
			if (allowed.contains(target)) return Judge.PASS;
			if (TARGET_SPECIAL.equals(target) && "FARM".equals(job) && farmProduct) return Judge.PASS;
		}
		return Judge.FAIL;
	}

	// 3 지원 지역: 전국 또는 고른 시도 통과, 칩 없음이나 지역 안 고름은 주의
	private Judge judgeRegion(Candidate c, String region) {
		List<String> regions = c.values(TagType.REGION);
		if (regions.contains(REGION_ALL)) return Judge.PASS;
		if (regions.isEmpty() || region == null) return Judge.WARN;
		return regions.contains(region) ? Judge.PASS : Judge.FAIL;
	}

	// 4 나이: 내 나이 범위가 상품 범위 안이면 통과, 걸치면 주의, 안 겹치면 제외 (둘 다 null = 조건 없음)
	private Judge judgeAge(LoanProduct p, int ageMin, int ageMax) {
		if (p.getAgeMin() == null && p.getAgeMax() == null) return Judge.PASS;
		int low = p.getAgeMin() == null ? 0 : p.getAgeMin();
		int high = p.getAgeMax() == null ? NO_AGE_LIMIT : p.getAgeMax();
		return compareRange(ageMin, ageMax, low, high);
	}

	// 5 신용점수 구간: 전세, 주담대는 출처에 칸 없음 / 신용 무관 통과 / 점수 범위로 통과, 주의, 제외 / 범위 없음 주의
	private Judge judgeCredit(Candidate c, String band) {
		LoanProduct p = c.getProduct();
		if (isCreditMissing(p)) return Judge.MISSING;
		if (c.values(TagType.CREDIT).contains(CREDIT_ANY)) return Judge.PASS;
		if (p.getCreditMin() == null && p.getCreditMax() == null) return Judge.WARN;

		List<Integer> bandScore = BAND_SCORES.get(band);
		int low = p.getCreditMin() == null ? 0 : p.getCreditMin();
		int high = p.getCreditMax() == null ? MAX_SCORE : p.getCreditMax();
		return compareRange(bandScore.get(0), bandScore.get(1), low, high);
	}

	// 6 소득: 글 조건 주의 / 부부합산은 본인 소득이 상한을 넘으면 제외, 아니면 주의 / 본인 기준은 범위 밖 제외
	private Judge judgeIncome(LoanProduct p, int income) {
		IncomeBasis basis = p.getIncomeBasis();
		Integer min = p.getIncomeMin();
		Integer max = p.getIncomeMax();
		if (basis == IncomeBasis.OTHER) return Judge.WARN;
		if (basis == IncomeBasis.COUPLE) {
			return max != null && income > max ? Judge.FAIL : Judge.WARN;
		}
		if ((min != null && income < min) || (max != null && income > max)) return Judge.FAIL;
		return Judge.PASS;
	}

	// 7 한도: 금감원 개인신용은 출처에 칸 없음 / 한도 제한 없음 통과 / 숫자 한도로 통과, 제외 / 숫자 없음 주의
	private Judge judgeLimit(Candidate c, int need) {
		LoanProduct p = c.getProduct();
		if (p.getLoanType() == LoanType.CREDIT) return Judge.MISSING;
		if (c.values(TagType.AMOUNT).contains(AMOUNT_UNLIMITED)) return Judge.PASS;
		if (p.getLimitAmount() != null) return p.getLimitAmount() >= need ? Judge.PASS : Judge.FAIL;
		return Judge.WARN;
	}

	// 기간: 금감원 개인신용은 출처에 칸 없음 / 최대 기간 없음 주의 / 최대 기간 < 갚을 기간 부족
	private Judge judgeTerm(LoanProduct p, int termMonths) {
		if (p.getLoanType() == LoanType.CREDIT) return Judge.MISSING;
		if (p.getTermMax() == null) return Judge.WARN;
		return p.getTermMax() >= termMonths ? Judge.PASS : Judge.SHORT;
	}

	// 월 부담 비율 = (기존 월 상환 + 이 상품 월 상환) x 12 / 연소득. 계산 못 하면 주의
	private void judgeBurden(Evaluation e, RecommendRequestDTO req) {
		if (e.monthlyPayment == null || req.getIncome() == 0) {
			e.burden = Judge.WARN;
			return;
		}
		boolean debtUnknown = Boolean.TRUE.equals(req.getDebtUnknown()) || req.getDebtMonthly() == null;
		long debtWon = debtUnknown ? 0 : req.getDebtMonthly() * 10000L;
		double ratio = (debtWon + e.monthlyPayment) * 12.0 * 100 / (req.getIncome() * 10000.0);
		e.burdenRatio = ratio;
		e.burden = ratio <= burdenMax ? Judge.PASS : Judge.WARN;
	}

	// 내 범위 [myLow, myHigh]가 상품 범위 [low, high] 안이면 통과, 안 겹치면 제외, 걸치면 주의
	private Judge compareRange(int myLow, int myHigh, int low, int high) {
		if (myLow >= low && myHigh <= high) return Judge.PASS;
		if (myHigh < low || myLow > high) return Judge.FAIL;
		return Judge.WARN;
	}

	// 전세, 주담대는 출처에 신용 구간 칸이 없음
	private boolean isCreditMissing(LoanProduct p) {
		return p.getLoanType() == LoanType.RENT || p.getLoanType() == LoanType.MORTGAGE;
	}

	private boolean isYouth(int ageMin, int ageMax) {
		return ageMin <= YOUTH_MAX_AGE && ageMax >= YOUTH_MIN_AGE;
	}

	// =================== 예상 금리, 월 상환 ===================

	// 금감원 개인신용, 개인사업자(신협 묶음 빼고)는 고른 구간 금리, 그 밖이나 구간 값이 없으면 상품 최저~최고
	private void estimateRate(Evaluation e, Candidate c, String band) {
		LoanProduct p = c.getProduct();
		e.grouped = p.getSourceCode() != null && p.getSourceCode().startsWith(GROUPED_PREFIX);

		BigDecimal min = null;
		BigDecimal max = null;
		boolean estimated = false;
		boolean bandRate = p.getLoanType() == LoanType.CREDIT || p.getLoanType() == LoanType.BIZ;
		if (bandRate && !e.grouped) {
			List<String> keys = BAND_RATE_KEYS.get(band);
			for (ProductRate rate : c.creditRates) {
				if (!keys.contains(rate.getRateKey())) continue;
				min = smaller(min, rate.getRateMin());
				max = larger(max, rate.getRateMax());
				if (rate.getRateSource() == RateSource.ESTIMATED) estimated = true;
			}
		}
		if (min == null && max == null) {
			min = p.getRateMin();
			max = p.getRateMax();
			estimated = false;
		}
		if (min == null) min = max;
		if (max == null) max = min;
		if (min == null) return;	// 금리 없는 상품

		e.estRateMin = min;
		e.estRateMax = max;
		e.rateEstimated = estimated;
		e.rateMid = min.add(max).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
	}

	// 금액 = 필요 금액과 한도 중 작은 값, 기간 = 갚을 기간과 최대 기간 중 짧은 값, 금리 = 예상 금리 가운데 값
	private void calcPayment(Evaluation e, Candidate c, int need) {
		if (e.rateMid == null) {
			e.calcNote = "금리는 기관 문의";
			return;
		}
		LoanProduct p = c.getProduct();
		long amount = p.getLimitAmount() == null ? need : Math.min(need, p.getLimitAmount());
		int months = p.getTermMax() == null ? e.termMonths : Math.min(e.termMonths, p.getTermMax());
		if (months <= 0) months = e.termMonths;
		boolean interestOnly = isInterestOnly(c);

		e.monthlyPayment = monthlyPayment(amount * 10000L, e.rateMid, months, interestOnly);
		e.calcNote = months + "개월, 연 " + e.rateMid.toPlainString() + "%, "
				+ (interestOnly ? "만기일시(매달 이자만)" : REPAY_EQUAL) + " 기준"
				+ (e.grouped ? " (조합마다 다름)" : "");
	}

	// 상환 방법에 원리금균등이 있거나 모르면 원리금균등, 만기일시만 있으면 매달 이자만
	private boolean isInterestOnly(Candidate c) {
		List<String> repays = c.values(TagType.REPAY);
		return !repays.isEmpty() && !repays.contains(REPAY_EQUAL)
				&& repays.stream().allMatch(REPAY_BULLET::equals);
	}

	/** 월 상환 (원). 원리금균등: 금액 x 월 이율 / (1 - (1 + 월 이율)^-개월) / 매달 이자만: 금액 x 월 이율 */
	public static long monthlyPayment(long amountWon, BigDecimal annualRate, int months, boolean interestOnly) {
		double monthlyRate = annualRate.doubleValue() / 100 / 12;
		if (interestOnly) return Math.round(amountWon * monthlyRate);
		if (monthlyRate == 0) return Math.round((double) amountWon / months);
		return Math.round(amountWon * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
	}

	private static BigDecimal smaller(BigDecimal current, BigDecimal value) {
		if (value == null) return current;
		return current == null || value.compareTo(current) < 0 ? value : current;
	}

	private static BigDecimal larger(BigDecimal current, BigDecimal value) {
		if (value == null) return current;
		return current == null || value.compareTo(current) > 0 ? value : current;
	}

	// =================== 일치도 ===================

	/** 조건 점수: 1에서 주의 0.2, 부족 0.3, 출처에 칸 없음 0.1씩 뺌 (0 밑으로 안 내려감) */
	public double conditionScore(Evaluation e) {
		int warn = 0;
		int shortCount = 0;
		int missing = 0;
		for (Judge judge : e.items()) {
			if (judge == Judge.WARN) warn++;
			if (judge == Judge.SHORT) shortCount++;
			if (judge == Judge.MISSING) missing++;
		}
		double score = 1 - warn * penaltyWarn - shortCount * penaltyShort - missing * penaltyMissing;
		return Math.max(0, score);
	}

	/** 고른 기준 점수: 고른 1~3개 점수 평균 (값을 모르면 그 기준 0.5) */
	public double priorityScore(Evaluation e, List<String> priorities) {
		LoanProduct p = e.candidate.getProduct();
		double sum = 0;
		for (String priority : priorities) {
			sum += switch (priority) {
				case "LOW_RATE" -> e.rateRank == null ? 0.5 : rankScore(e.rateRank, e.rateCount);
				case "HIGH_LIMIT" -> e.limit == Judge.PASS ? 1 : 0.5;
				case "LOW_PAYMENT" -> e.paymentRank == null ? 0.5 : rankScore(e.paymentRank, e.paymentCount);
				case "ONLINE" -> ynScore(p.getOnlineYn());
				case "POLICY" -> ynScore(p.getPolicyYn());
				case "NO_PREPAY_FEE" -> ynScore(p.getNoPrepayFeeYn());
				default -> 0.5;
			};
		}
		return sum / priorities.size();
	}

	/** 일치도 0~100 = 100 x (0.6 x 조건 점수 + 0.4 x 고른 기준 점수) */
	public double matchRate(double conditionScore, double priorityScore) {
		return 100 * (weightCondition * conditionScore + weightPriority * priorityScore);
	}

	/** 순위 점수: 1등 1, 꼴등 0 (후보가 1개면 1) */
	public static double rankScore(int rank, int count) {
		if (count <= 1) return 1;
		return 1 - (double) (rank - 1) / (count - 1);
	}

	/** 작은 값이 1등인 순위 (같은 값은 같은 순위) */
	public static <T extends Comparable<T>> int rankOf(T value, List<T> values) {
		int rank = 1;
		for (T other : values) {
			if (other.compareTo(value) < 0) rank++;
		}
		return rank;
	}

	private static double ynScore(String yn) {
		if ("Y".equals(yn)) return 1;
		if ("N".equals(yn)) return 0;
		return 0.5;
	}

	// =================== 판정 결과, 문장, 태그 ===================

	/** 상품 1개 판정 결과 (LOAN-05): 제외 FAIL / 주의, 부족, 칸 없음이 있으면 WARN / 나머지 PASS */
	public String eligibilityResult(Evaluation e) {
		if (e.failed != null) return "FAIL";
		for (Judge judge : e.items()) {
			if (judge != Judge.PASS) return "WARN";
		}
		return "PASS";
	}

	/**
	 * 이유 문장 최대 5개: 신용 -> 나이 -> 소득 -> 고른 기준 -> 금리 순위 -> 한도 -> (기간 부족) -> 월 부담 -> 중도상환수수료
	 * 고른 기준이 금리, 한도, 월 부담, 수수료면 그 문장을 '고른 기준' 자리로 당기고 뒤에서는 뺌
	 * withRank: 후보 안 금리 순위 문장을 넣을지 (상품 1개 판정은 후보가 없어서 false)
	 */
	public List<String> reasons(Evaluation e, List<String> priorities, boolean withRank) {
		LoanProduct p = e.candidate.getProduct();
		List<String> reasons = new ArrayList<>();
		addIfPresent(reasons, creditReason(e));
		addIfPresent(reasons, e.age == Judge.PASS && e.ageCondition ? "나이 조건에 맞아요" : null);
		addIfPresent(reasons, incomeReason(e, p));

		Set<String> moved = new HashSet<>();
		for (String priority : priorities) {
			switch (priority) {
				case "ONLINE" -> addIfPresent(reasons, "Y".equals(p.getOnlineYn()) ? "비대면으로 신청할 수 있어요" : null);
				case "POLICY" -> addIfPresent(reasons, "Y".equals(p.getPolicyYn()) ? "정부/서민 지원 상품이에요" : null);
				case "LOW_RATE" -> addIfPresent(reasons, rateReason(e, withRank));
				case "HIGH_LIMIT" -> addIfPresent(reasons, limitReason(e, p));
				case "LOW_PAYMENT" -> addIfPresent(reasons, burdenReason(e));
				case "NO_PREPAY_FEE" -> addIfPresent(reasons, feeReason(p));
				default -> { }
			}
			moved.add(priority);
		}

		if (!moved.contains("LOW_RATE")) addIfPresent(reasons, rateReason(e, withRank));
		if (!moved.contains("HIGH_LIMIT")) addIfPresent(reasons, limitReason(e, p));
		addIfPresent(reasons, e.term == Judge.SHORT ? "최대 " + p.getTermMax() + "개월까지만 빌릴 수 있어요" : null);
		if (!moved.contains("LOW_PAYMENT")) addIfPresent(reasons, burdenReason(e));
		if (!moved.contains("NO_PREPAY_FEE")) addIfPresent(reasons, feeReason(p));
		return reasons.size() > 5 ? new ArrayList<>(reasons.subList(0, 5)) : reasons;
	}

	/** 판단 태그 3개: 주의 먼저, 그다음 좋은 점 */
	public List<String> judgeTags(Evaluation e) {
		LoanProduct p = e.candidate.getProduct();
		List<String> tags = new ArrayList<>();
		// 주의
		if (e.purposeCheck) tags.add("용도 확인 필요");
		if (e.credit == Judge.WARN) tags.add("신용 구간 주의");
		if (e.age == Judge.WARN) tags.add("연령 조건 있음");
		if (p.getIncomeBasis() == IncomeBasis.OTHER) tags.add("소득 조건 있음");
		if (e.limit == Judge.WARN || e.limit == Judge.MISSING) tags.add("한도 확인 필요");
		if (e.burdenRatio != null && e.burden == Judge.WARN) tags.add("월 부담 큼");
		if (e.overdue == Judge.WARN) tags.add("연체 주의");
		// 좋은 점
		if (e.rateRank != null && e.rateRank == 1) tags.add("후보 중 최저 금리");
		if ("Y".equals(p.getNoPrepayFeeYn())) tags.add("중도상환수수료 없음");
		if (e.creditNoCriteria) tags.add("신용점수 기준 없음");
		if ("Y".equals(p.getPolicyYn())) tags.add("정부/서민 지원");
		if ("Y".equals(p.getOnlineYn())) tags.add("비대면 신청");
		if (e.limit == Judge.PASS) tags.add("필요 금액 한도 안");
		if (e.burdenRatio != null && e.burdenRatio <= burdenEasy) tags.add("월 부담 여유");
		return tags.size() > 3 ? new ArrayList<>(tags.subList(0, 3)) : tags;
	}

	private String creditReason(Evaluation e) {
		if (e.credit == Judge.PASS) return e.creditNoCriteria ? "신용점수 기준이 없어요" : "신용점수 기준에 맞아요";
		if (e.credit == Judge.WARN && e.creditRanged) return "신용점수 기준이 일부만 맞아요";
		return "신용점수는 심사에서 확인해요";
	}

	private String incomeReason(Evaluation e, LoanProduct p) {
		if (p.getIncomeBasis() == IncomeBasis.COUPLE) return "배우자 소득 합산 기준이에요";
		if (p.getIncomeBasis() == IncomeBasis.OTHER) return "소득 조건이 있어요";
		return e.incomeCondition ? "소득 기준에 맞아요" : null;
	}

	private String rateReason(Evaluation e, boolean withRank) {
		if (e.rateMid == null) return "금리는 기관 문의";
		return withRank && e.rateRank != null ? "예상 금리가 후보 중 " + e.rateRank + "번째로 낮아요" : null;
	}

	private String limitReason(Evaluation e, LoanProduct p) {
		if (e.limit == Judge.WARN) return "한도는 심사에서 결정돼요";
		if (e.limit == Judge.MISSING) return "한도 확인이 필요해요";
		if (e.limitUnlimited) return "한도 제한이 없어요";
		return "최대 한도 " + formatMoney(p.getLimitAmount()) + "으로 필요 금액 안이에요";
	}

	private String burdenReason(Evaluation e) {
		if (e.burdenRatio == null) return null;
		long percent = Math.round(e.burdenRatio);
		return e.burden == Judge.PASS
				? "월 상환 부담이 연소득의 " + percent + "%예요"
				: "월 상환 부담이 연소득의 " + percent + "%로 커요";
	}

	private String feeReason(LoanProduct p) {
		if ("Y".equals(p.getNoPrepayFeeYn())) return "중도상환수수료가 없어요";
		BigDecimal fee = p.getPrepayFeeMax();
		if (fee != null && fee.signum() > 0) return "중도상환수수료가 최대 " + fee.stripTrailingZeros().toPlainString() + "%예요";
		return null;
	}

	private static void addIfPresent(List<String> list, String value) {
		if (value != null) list.add(value);
	}

	// =================== 입력 도우미 ===================

	/** 갚을 기간이 용도에 맞는 값인지 (단기 0, 12, 36, 60 / 전월세, 주택 구입 0, 60, 120, 180) */
	public static boolean isValidMonths(String purpose, Integer months) {
		if (months == null) return false;
		return LONG_TERM_PURPOSES.contains(purpose) ? LONG_MONTHS.contains(months) : SHORT_MONTHS.contains(months);
	}

	/** 계산에 쓰는 갚을 기간 (모름 0이면 단기 36, 장기 120개월) */
	public static int termOf(String purpose, int months) {
		if (months != 0) return months;
		return LONG_TERM_PURPOSES.contains(purpose) ? DEFAULT_LONG_MONTHS : DEFAULT_SHORT_MONTHS;
	}

	/** 만 나이 (생년 'YYYY', 생일 'MM-DD'), 읽을 수 없으면 -1 */
	public static int ageOf(String birthYear, String birthDay, LocalDate today) {
		if (birthYear == null || birthDay == null) return -1;
		String[] monthDay = birthDay.split("-");
		if (monthDay.length != 2) return -1;
		try {
			int year = Integer.parseInt(birthYear);
			int month = Integer.parseInt(monthDay[0]);
			int day = Integer.parseInt(monthDay[1]);
			int age = today.getYear() - year;
			if (today.getMonthValue() < month || (today.getMonthValue() == month && today.getDayOfMonth() < day)) {
				age--;
			}
			return age < 0 ? -1 : age;
		} catch (NumberFormatException e) {
			return -1;
		}
	}

	/** 판정에 쓰는 나이 범위 최저 (회원 나이가 있으면 그 나이, 없으면 고른 나이 구간) */
	public static int ageMinOf(String ageGroup, int memberAge) {
		if (memberAge >= 0) return memberAge;
		return YOUTH.equals(ageGroup) ? YOUTH_MIN_AGE : YOUTH_MAX_AGE + 1;
	}

	/** 판정에 쓰는 나이 범위 최고 */
	public static int ageMaxOf(String ageGroup, int memberAge) {
		if (memberAge >= 0) return memberAge;
		return YOUTH.equals(ageGroup) ? YOUTH_MAX_AGE : NO_AGE_LIMIT;
	}

	/** 나이 -> 나이 구간 코드 */
	public static String ageGroupOf(int age) {
		return age > YOUTH_MAX_AGE ? ADULT : YOUTH;
	}

	/** 한 칸 높은 신용 구간 (BAND1은 더 높은 칸이 없어 null) */
	public static String higherBand(String band) {
		int index = BANDS.indexOf(band);
		return index > 0 ? BANDS.get(index - 1) : null;
	}

	/** 금액 글 (만원 단위 값): 1000 -> '1,000만원', 10000 -> '1억원', 15000 -> '1억 5,000만원' (화면 formatMoney와 같은 모양) */
	public static String formatMoney(long amount) {
		if (amount >= 10000) {
			long eok = amount / 10000;
			long rest = amount % 10000;
			return rest == 0
					? String.format(Locale.ROOT, "%,d억원", eok)
					: String.format(Locale.ROOT, "%,d억 %,d만원", eok, rest);
		}
		return String.format(Locale.ROOT, "%,d만원", amount);
	}
}
