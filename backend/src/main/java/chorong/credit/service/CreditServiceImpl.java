package chorong.credit.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import chorong.common.client.FastApiClient;
import chorong.common.dto.FastApiScoreRequestDTO;
import chorong.common.dto.FastApiScoreResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.credit.dto.CreditCheckRequestDTO;
import chorong.credit.dto.CreditCheckResponseDTO;
import chorong.credit.entity.CreditBand;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CreditServiceImpl implements CreditService {

	private static final Logger log = LoggerFactory.getLogger(CreditServiceImpl.class);

	private static final int QUESTION_COUNT = 10;
	private static final int MULTI_QUESTION = 5;		// 문항 5 이용 금융권: 보기 번호 목록, 없어도 됨
	private static final int UNKNOWN_CHOICE = 0;		// '잘 모르겠어요'

	// 문항별 보기 개수 (인덱스 = 문항 번호 - 1, '잘 모르겠어요' 제외)
	private static final int[] CHOICE_COUNT = {3, 4, 2, 4, 4, 6, 5, 3, 3, 4};
	// '잘 모르겠어요'를 고를 수 있는 문항
	private static final Set<Integer> UNKNOWN_ALLOWED = Set.of(6, 7, 8, 9, 10);
	// 점수 0, 상태와 팁에서 참고로만 쓰는 문항 (대출 건수, 금융권, 대출 잔액)
	private static final Set<Integer> REFERENCE_QUESTIONS = Set.of(4, 5, 6);

	// 문항별 점수 (0~100) -> 상태: 70 이상 양호, 40 이상 보통, 그 밖은 주의
	private static final int GOOD_MIN = 70;
	private static final int NORMAL_MIN = 40;
	private static final int MAX_ITEM_SCORE = 100;

	private static final int TIER_GOOD = 0;
	private static final int TIER_NORMAL = 1;
	private static final int TIER_CAUTION = 2;

	private static final String[] STATUS = {"양호", "보통", "주의"};
	private static final String REFERENCE_PREFIX = "참고: ";
	private static final String UNKNOWN_STATUS = "확인 필요";
	private static final String UNKNOWN_TIP = "정확한 내용을 확인한 뒤 다시 진단하면 결과가 더 정확해져요.";

	// 문항별 팁 (인덱스 = 문항 번호 - 1, 안쪽 = 양호, 보통, 주의)
	private static final String[][] TIPS = {
		// 1. 최근 1년 내 30일 이상 연체
		{"최근 1년 내 연체가 없어요. 지금처럼 납부일을 지켜 주세요.",
		 "최근 1년 내 연체가 1회 있었어요. 자동이체를 설정해 같은 일이 없도록 해 보세요.",
		 "최근 1년 내 연체가 2회 이상이에요. 신용에 가장 크게 영향을 주니 연체부터 해소해 보세요."},
		// 2. 최근 3개월 내 가장 길었던 연체
		{"최근 3개월 내 긴 연체가 없어요. 이 상태를 유지해 보세요.",
		 "최근 3개월 내 10일 이상 연체가 있었어요. 납부일 알림을 설정해 두세요.",
		 "최근 3개월 내 30일 이상 연체가 있었어요. 연체 금액부터 먼저 갚는 것이 좋아요."},
		// 3. 신용회복, 채무조정, 연체 등록 이력
		{"신용회복, 채무조정, 연체 등록 이력이 없어요.",
		 "신용회복, 채무조정, 연체 등록 이력이 있어요. 새로운 연체가 생기지 않게 관리해 보세요.",
		 "신용회복, 채무조정, 연체 등록 이력이 있어요. 새로운 연체가 생기지 않게 관리해 보세요."},
		// 4. 현재 갚고 있는 대출 건수 (참고)
		{"대출 건수가 많지 않아요. 부담 없는 수준을 유지해 보세요.",
		 "대출 건수가 있는 편이에요. 새 대출은 꼭 필요한지 따져 보세요.",
		 "대출이 4건 이상이에요. 금리가 높은 대출부터 갚거나 대환대출을 알아보세요."},
		// 5. 이용 중인 금융권 (참고)
		{"비은행 대출 이용이 적어 부담이 낮아요.",
		 "저축은행·상호금융 대출을 이용 중이에요. 더 낮은 금리의 상품이 있는지 비교해 보세요.",
		 "대부업 대출을 이용 중이에요. 금리 부담이 크니 낮은 금리의 상품으로 바꿀 수 있는지 알아보세요."},
		// 6. 총 대출 잔액 (참고)
		{"대출 잔액이 크지 않아요. 지금처럼 관리해 보세요.",
		 "대출 잔액이 큰 편이에요. 상환 계획을 세워 조금씩 줄여 보세요.",
		 "대출 잔액이 1억원 이상이에요. 이자 부담이 크니 상환 계획을 점검해 보세요."},
		// 7. 카드 한도 대비 평균 사용 비율
		{"카드 사용 비율이 안정적이에요. 한도의 60% 이하로 쓰는 습관을 이어 가세요.",
		 "카드 사용 이력이 없거나 한도 사용 비율이 높은 편이에요. 한도의 60% 이내로 쓰면 도움이 돼요.",
		 "카드 한도를 90% 이상 쓰고 있어요. 사용 금액을 줄이면 신용에 도움이 돼요."},
		// 8. 최근 6개월 현금서비스, 카드론 이용
		{"현금서비스나 카드론을 쓰지 않았어요. 좋은 습관이에요.",
		 "최근 6개월 중 1~2개월 현금서비스나 카드론을 썼어요. 급할 때만 쓰고 빨리 갚아 보세요.",
		 "현금서비스나 카드론을 3개월 이상 썼어요. 반복해서 쓰면 신용에 불리하니 줄여 보세요."},
		// 9. 최근 6개월 내 새로 만든 대출, 카드 수
		{"최근 6개월 내 새로 만든 대출이나 카드가 적어요. 이 상태를 유지해 보세요.",
		 "최근 6개월 내 새로 만든 대출이나 카드가 있어요. 한꺼번에 여러 개를 만들지 않도록 해요.",
		 "최근 6개월 내 새로 만든 대출이나 카드가 3개 이상이에요. 짧은 기간에 많이 만들면 신용에 불리해요."},
		// 10. 금융거래 기간
		{"금융거래 기간이 길어 신용 이력이 안정적이에요.",
		 "금융거래 기간이 1~3년이에요. 오래 거래할수록 신용에 유리해요.",
		 "금융거래 기간이 1년 미만이에요. 이력이 짧으면 평가가 어려우니 꾸준히 거래 이력을 쌓아 보세요."}
	};

	private final FastApiClient fastApiClient;

	@Override
	public CreditCheckResponseDTO checkCredit(CreditCheckRequestDTO request) {
		// 1. 값 확인 (문항 5 빼고 9문항 필수, 정해진 보기 번호만)
		Map<Integer, List<Integer>> answers = validateAnswers(request);

		// 2. FastAPI 점수 API 호출 (문항 답만 보냄, 3초 넘거나 실패하면 503)
		FastApiScoreResponseDTO scoreResponse = fastApiClient.scoreCredit(toScoreRequest(answers));
		Map<Integer, Integer> itemScores = validateScoreResponse(scoreResponse);
		int score = scoreResponse.getScore();

		// 3. 구간, 4. 문항별 상태와 팁
		return new CreditCheckResponseDTO(score, CreditBand.fromScore(score),
				buildItems(answers, itemScores), hasUnknownAnswer(answers));
	}

	// ---- 1. 값 확인 ----

	private Map<Integer, List<Integer>> validateAnswers(CreditCheckRequestDTO request) {
		if (request == null || request.getAnswers() == null) throw invalidInput();

		Map<Integer, List<Integer>> answers = new HashMap<>();
		for (CreditCheckRequestDTO.AnswerItem answer : request.getAnswers()) {
			if (answer == null || answer.getQuestionNo() == null || answer.getChoices() == null) throw invalidInput();

			int questionNo = answer.getQuestionNo();
			if (questionNo < 1 || questionNo > QUESTION_COUNT) throw invalidInput();
			if (answers.containsKey(questionNo)) throw invalidInput();	// 같은 문항 두 번

			validateChoices(questionNo, answer.getChoices());
			answers.put(questionNo, answer.getChoices());
		}

		// 문항 5는 대출이 없으면 빈 목록이라 빠져도 됨, 나머지 9문항은 필수
		answers.putIfAbsent(MULTI_QUESTION, List.of());
		if (answers.size() != QUESTION_COUNT) throw invalidInput();
		return answers;
	}

	private void validateChoices(int questionNo, List<Integer> choices) {
		int max = CHOICE_COUNT[questionNo - 1];

		if (questionNo == MULTI_QUESTION) {
			// 복수 선택: 0~4개, 보기 번호 1~4, 같은 번호 두 번 안 됨
			if (choices.size() > max) throw invalidInput();
			Set<Integer> seen = new HashSet<>();
			for (Integer choice : choices) {
				if (choice == null || choice < 1 || choice > max || !seen.add(choice)) throw invalidInput();
			}
			return;
		}

		// 단일 선택: 1개, '잘 모르겠어요'(0)는 허용 문항만
		if (choices.size() != 1 || choices.get(0) == null) throw invalidInput();
		int choice = choices.get(0);
		if (choice == UNKNOWN_CHOICE && UNKNOWN_ALLOWED.contains(questionNo)) return;
		if (choice < 1 || choice > max) throw invalidInput();
	}

	private BusinessException invalidInput() {
		return new BusinessException(ErrorCode.INVALID_INPUT);
	}

	// ---- 2. FastAPI 요청, 응답 ----

	private FastApiScoreRequestDTO toScoreRequest(Map<Integer, List<Integer>> answers) {
		List<FastApiScoreRequestDTO.AnswerItem> items = new ArrayList<>();
		for (int questionNo = 1; questionNo <= QUESTION_COUNT; questionNo++) {
			items.add(new FastApiScoreRequestDTO.AnswerItem(questionNo, answers.get(questionNo)));
		}
		return new FastApiScoreRequestDTO(items);
	}

	// 받은 값 확인 (B13): 점수 1~1000, 문항별 점수 0~100이 아니면 503. 문항 번호 -> 점수
	private Map<Integer, Integer> validateScoreResponse(FastApiScoreResponseDTO response) {
		Integer score = response.getScore();
		if (score == null || score < 1 || score > 1000 || response.getItemScores() == null) throw badScoreResponse();

		Map<Integer, Integer> itemScores = new HashMap<>();
		for (FastApiScoreResponseDTO.ItemScoreItem item : response.getItemScores()) {
			if (item == null || item.getQuestionNo() == null || item.getScore() == null) throw badScoreResponse();
			if (item.getScore() < 0 || item.getScore() > MAX_ITEM_SCORE) throw badScoreResponse();
			itemScores.put(item.getQuestionNo(), item.getScore());
		}
		return itemScores;
	}

	private BusinessException badScoreResponse() {
		log.warn("FastAPI 신용 진단 응답 형식 오류");	// 점수 값은 남기지 않음 (B8)
		return new BusinessException(ErrorCode.SERVICE_UNAVAILABLE);
	}

	// ---- 4. 문항별 상태, 팁 ----

	private List<CreditCheckResponseDTO.ItemItem> buildItems(Map<Integer, List<Integer>> answers,
															 Map<Integer, Integer> itemScores) {
		List<CreditCheckResponseDTO.ItemItem> items = new ArrayList<>();
		for (int questionNo = 1; questionNo <= QUESTION_COUNT; questionNo++) {
			List<Integer> choices = answers.get(questionNo);

			if (isUnknown(questionNo, choices)) {
				items.add(new CreditCheckResponseDTO.ItemItem(questionNo, UNKNOWN_STATUS, UNKNOWN_TIP));
			} else if (REFERENCE_QUESTIONS.contains(questionNo)) {
				// 점수 0: 고른 보기로 상태를 정하고 '참고'로 표시
				int tier = referenceTier(questionNo, choices);
				items.add(new CreditCheckResponseDTO.ItemItem(questionNo,
						REFERENCE_PREFIX + STATUS[tier], TIPS[questionNo - 1][tier]));
			} else {
				Integer itemScore = itemScores.get(questionNo);
				if (itemScore == null) throw badScoreResponse();
				int tier = scoreTier(itemScore);
				items.add(new CreditCheckResponseDTO.ItemItem(questionNo, STATUS[tier], TIPS[questionNo - 1][tier]));
			}
		}
		return items;
	}

	private int scoreTier(int itemScore) {
		if (itemScore >= GOOD_MIN) return TIER_GOOD;
		if (itemScore >= NORMAL_MIN) return TIER_NORMAL;
		return TIER_CAUTION;
	}

	// 문항 4, 5, 6: 고른 보기로 상태를 정함 (보기 순서는 선택지 시트 기준)
	private int referenceTier(int questionNo, List<Integer> choices) {
		switch (questionNo) {
			case 4:		// 0건, 1건, 2~3건, 4건 이상
				return choices.get(0) == 4 ? TIER_CAUTION : TIER_GOOD;
			case 5:		// 은행, 카드·캐피탈, 저축은행·상호금융, 대부업 (가장 위험한 금융권 기준)
				if (choices.contains(4)) return TIER_CAUTION;
				if (choices.contains(3)) return TIER_NORMAL;
				return TIER_GOOD;
			default:	// 문항 6: 대출 없음, 1천만 미만, 1천~3천만, 3천~5천만, 5천~1억, 1억 이상
				if (choices.get(0) == 6) return TIER_CAUTION;
				if (choices.get(0) >= 4) return TIER_NORMAL;
				return TIER_GOOD;
		}
	}

	private boolean isUnknown(int questionNo, List<Integer> choices) {
		return questionNo != MULTI_QUESTION && choices.get(0) == UNKNOWN_CHOICE;
	}

	private boolean hasUnknownAnswer(Map<Integer, List<Integer>> answers) {
		for (Map.Entry<Integer, List<Integer>> entry : answers.entrySet()) {
			if (isUnknown(entry.getKey(), entry.getValue())) return true;
		}
		return false;
	}
}
