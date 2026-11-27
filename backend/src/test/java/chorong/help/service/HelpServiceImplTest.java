package chorong.help.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockHttpSession;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.common.util.SessionConst;
import chorong.help.dto.FeedbackRequestDTO;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.dto.QuestionRequestDTO;
import chorong.help.dto.TermAddRequestDTO;
import chorong.help.entity.HelpContent;
import chorong.help.entity.HelpQuestion;
import chorong.help.entity.HelpStat;
import chorong.help.entity.HelpType;
import chorong.help.entity.QuestionStatus;
import chorong.help.entity.TermRequest;
import chorong.help.entity.Vote;
import chorong.help.repository.HelpContentRepository;
import chorong.help.repository.HelpQuestionRepository;
import chorong.help.repository.HelpStatRepository;
import chorong.help.repository.TermRequestRepository;

/*
 * HelpServiceImpl 테스트: getTerms (HELP-02 용어 사전), getTips (HELP-03 금융 TIP), getFaqs (HELP-01 자주 묻는 질문)
 * FAQ 기대값 출처: be_help.md HELP-01 (help_content FAQ를 help_no 순, 분류, 질문, 답, 연 횟수, 글은 그대로, 목록 캐시)
 *   + 집계 행이 없는 FAQ는 한 번도 열지 않은 것이므로 연 횟수 0 (help_stat open_count 기본값 0)
 *   + help_stat.targetKey는 helpId (helpNo 아님)
 * 열기(openFaq) 기대값 출처: be_help.md HELP-01 (help_stat open_count + 1, 없으면 행 추가)
 *   + 담당자 결정: 없는 helpId, FAQ가 아닌 helpId는 404
 * 용어 추가 요청(addTermRequest) 기대값 출처: be_help.md HELP-07 (같은 단어면 request_count + 1, last_requested_at 갱신 / 없으면 추가)
 *   + be_common.md B15 (앞뒤 공백 제거, 글자 그대로 저장)
 * 질문 남기기(addQuestion) 기대값 출처: be_help.md HELP-05 (공백 제거 후 4~300자 아니면 400, 회원이면 member_yn Y,
 *   상태 PENDING, 글 그대로 저장)
 * 도움말 평가(addFeedback) 기대값 출처: be_help.md HELP-06 (UP은 helpful_count, DOWN은 unhelpful_count + 1,
 *   cancel이면 - 1, 0 밑으로 안 내림, 없으면 행 추가) + 담당자 결정: 대상이 없거나 종류가 다르면 404
 *   + 열기 주소의 {id}가 helpId이므로 FAQ 목록에 helpId를 담음 (담당자 확인, 명세서 응답 값에는 아직 없음)
 * TIP 기대값 출처: be_help.md HELP-03 (제목, 요약, 자세히, 키워드) + be_common.md B10, MemoryCache 설명
 *   (TIP은 메모리 캐시, 상품 반영 때 비우는 칸은 추천, 랭킹, 필터 칩, 용어이고 TIP은 아님)
 * 용어 기대값 출처: be_help.md HELP-02 (help_content TERM을 help_no 순으로, 응답 = 이름, 분류, 설명, 관련 단어)
 *   + be_common.md B10 (메모리 캐시, 상품 반영 때 용어 칸 비움)
 *   + help_content 규칙 (keyword1~5 = 용어의 관련 단어, 글은 HTML로 바꾸지 않고 그대로)
 * 정렬은 Repository 메서드 이름(findByHelpTypeOrderByHelpNoAsc)에 맡기므로, 여기서는 받은 순서를 지키는지만 확인
 * DB 대신 Mockito 가짜 Repository를 쓰고, MemoryCache는 진짜를 씀
 */
class HelpServiceImplTest {

	private HelpContentRepository helpContentRepository;
	private HelpStatRepository helpStatRepository;
	private TermRequestRepository termRequestRepository;
	private HelpQuestionRepository helpQuestionRepository;
	private MemoryCache memoryCache;
	private HelpServiceImpl helpService;

	@BeforeEach
	void setUp() {
		helpContentRepository = mock(HelpContentRepository.class);
		helpStatRepository = mock(HelpStatRepository.class);
		termRequestRepository = mock(TermRequestRepository.class);
		helpQuestionRepository = mock(HelpQuestionRepository.class);
		memoryCache = new MemoryCache();
		helpService = new HelpServiceImpl(helpContentRepository, memoryCache, helpStatRepository, termRequestRepository,
				helpQuestionRepository);
	}

	private static HelpContent term(int helpNo, String title, String... keywords) {
		return HelpContent.builder()
				.helpId((long) helpNo)
				.helpType(HelpType.TERM)
				.helpNo(helpNo)
				.category("금리")
				.title(title)
				.content(title + " 설명")
				.keyword1(keywords.length > 0 ? keywords[0] : null)
				.keyword2(keywords.length > 1 ? keywords[1] : null)
				.keyword3(keywords.length > 2 ? keywords[2] : null)
				.keyword4(keywords.length > 3 ? keywords[3] : null)
				.keyword5(keywords.length > 4 ? keywords[4] : null)
				.build();
	}

	private void givenTerms(HelpContent... terms) {
		when(helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.TERM)).thenReturn(List.of(terms));
	}

	// ---------- 조회, 변환 ----------

	@Test
	void 용어_TERM만_help_no_순_메서드로_조회한다() {
		// Given
		givenTerms(term(1, "금리"));

		// When
		helpService.getTerms();

		// Then
		verify(helpContentRepository).findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
	}

	@Test
	void FAQ와_TIP은_조회하지_않는다() {
		// Given
		givenTerms(term(1, "금리"));

		// When
		helpService.getTerms();

		// Then
		verify(helpContentRepository, never()).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
		verify(helpContentRepository, never()).findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
	}

	@Test
	void 조회한_순서_그대로_돌려준다() {
		// Given
		givenTerms(term(1, "금리"), term(2, "담보"), term(3, "신용"));

		// When
		List<HelpContentResponseDTO> terms = helpService.getTerms();

		// Then
		assertEquals(List.of(1, 2, 3), terms.stream().map(HelpContentResponseDTO::getHelpNo).toList());
	}

	@Test
	void 이름_분류_설명을_담는다() {
		// Given
		givenTerms(term(1, "금리"));

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertEquals("금리", dto.getTitle());
		assertEquals("금리", dto.getCategory());
		assertEquals("금리 설명", dto.getContent());
	}

	@Test
	void 설명의_HTML_태그는_바꾸지_않고_글자_그대로_담는다() {
		// Given
		HelpContent content = HelpContent.builder().helpId(1L).helpType(HelpType.TERM).helpNo(1)
				.title("금리").content("<b>금리</b> & 이자").build();
		givenTerms(content);

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertEquals("<b>금리</b> & 이자", dto.getContent());
	}

	@Test
	void 분류가_없으면_null로_담는다() {
		// Given
		HelpContent content = HelpContent.builder().helpId(1L).helpType(HelpType.TERM).helpNo(1)
				.title("금리").content("설명").build();
		givenTerms(content);

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertNull(dto.getCategory());
	}

	// ---------- 관련 단어 ----------

	@Test
	void 관련_단어는_keyword1부터_순서대로_담는다() {
		// Given
		givenTerms(term(1, "금리", "이자", "연이율", "고정금리", "변동금리", "우대금리"));

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertEquals(List.of("이자", "연이율", "고정금리", "변동금리", "우대금리"), dto.getKeywords());
	}

	@Test
	void 비어_있는_관련_단어_칸은_담지_않는다() {
		// Given
		givenTerms(term(1, "금리", "이자", "연이율"));

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertEquals(List.of("이자", "연이율"), dto.getKeywords());
	}

	@Test
	void 관련_단어가_하나도_없으면_빈_목록이다() {
		// Given
		givenTerms(term(1, "금리"));

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertEquals(List.of(), dto.getKeywords());
	}

	@Test
	void 용어마다_관련_단어_목록이_따로이다() {
		// Given
		givenTerms(term(1, "금리", "이자"), term(2, "담보", "근저당"));

		// When
		List<HelpContentResponseDTO> terms = helpService.getTerms();

		// Then
		assertEquals(List.of("근저당"), terms.get(1).getKeywords());
	}

	// ---------- 빈 목록 ----------

	@Test
	void 용어가_없으면_빈_목록이다() {
		// Given
		givenTerms();

		// When
		List<HelpContentResponseDTO> terms = helpService.getTerms();

		// Then
		assertEquals(List.of(), terms);
	}

	// ---------- 메모리 캐시 (B10) ----------

	@Test
	void 두_번_불러도_DB는_한_번만_읽는다() {
		// Given
		givenTerms(term(1, "금리"));
		helpService.getTerms();

		// When
		helpService.getTerms();

		// Then
		verify(helpContentRepository, times(1)).findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
	}

	@Test
	void 캐시에서_꺼낸_목록은_처음_응답과_같은_내용이다() {
		// Given
		givenTerms(term(1, "금리", "이자"));
		List<HelpContentResponseDTO> first = helpService.getTerms();

		// When
		List<HelpContentResponseDTO> second = helpService.getTerms();

		// Then
		assertEquals(first, second);
	}

	@Test
	void 용어_칸에_저장된다() {
		// Given
		givenTerms(term(1, "금리"));

		// When
		helpService.getTerms();

		// Then
		assertNotNull(memoryCache.get(MemoryCache.TERM, "terms"));
	}

	@Test
	void 빈_목록도_캐시에_저장해_다시_읽지_않는다() {
		// Given
		givenTerms();
		helpService.getTerms();

		// When
		helpService.getTerms();

		// Then
		verify(helpContentRepository, times(1)).findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
	}

	@Test
	void 상품_반영_때_용어_캐시를_비우면_다시_읽는다() {
		// Given
		givenTerms(term(1, "금리"));
		helpService.getTerms();
		memoryCache.clearProductCaches();

		// When
		helpService.getTerms();

		// Then
		verify(helpContentRepository, times(2)).findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
	}

	// ---------- 캐시 목록 보호 ----------

	@Test
	void 처음_응답_목록은_수정할_수_없다() {
		// Given
		givenTerms(term(1, "금리"));

		// When
		List<HelpContentResponseDTO> terms = helpService.getTerms();

		// Then
		assertThrows(UnsupportedOperationException.class, () -> terms.add(new HelpContentResponseDTO()));
	}

	@Test
	void 캐시에서_꺼낸_목록은_수정할_수_없다() {
		// Given
		givenTerms(term(1, "금리"));
		helpService.getTerms();

		// When
		List<HelpContentResponseDTO> terms = helpService.getTerms();

		// Then
		assertThrows(UnsupportedOperationException.class, () -> terms.add(new HelpContentResponseDTO()));
	}

	@Test
	void 관련_단어_목록은_수정할_수_없다() {
		// Given
		givenTerms(term(1, "금리", "이자"));

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertThrows(UnsupportedOperationException.class, () -> dto.getKeywords().add("추가"));
	}

	// ========== HELP-03 금융 TIP (getTips) ==========

	private static HelpContent tip(int helpNo, String title, String... keywords) {
		return HelpContent.builder()
				.helpId(100L + helpNo)
				.helpType(HelpType.TIP)
				.helpNo(helpNo)
				.title(title)
				.summary(title + " 한 줄 설명")
				.content(title + " 자세히")
				.keyword1(keywords.length > 0 ? keywords[0] : null)
				.keyword2(keywords.length > 1 ? keywords[1] : null)
				.keyword3(keywords.length > 2 ? keywords[2] : null)
				.keyword4(keywords.length > 3 ? keywords[3] : null)
				.keyword5(keywords.length > 4 ? keywords[4] : null)
				.build();
	}

	private void givenTips(HelpContent... tips) {
		when(helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.TIP)).thenReturn(List.of(tips));
	}

	@Test
	void TIP은_help_no_순_메서드로_조회한다() {
		// Given
		givenTips(tip(1, "상환"));

		// When
		helpService.getTips();

		// Then
		verify(helpContentRepository).findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
	}

	@Test
	void TIP_목록에서는_FAQ와_용어를_조회하지_않는다() {
		// Given
		givenTips(tip(1, "상환"));

		// When
		helpService.getTips();

		// Then
		verify(helpContentRepository, never()).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
		verify(helpContentRepository, never()).findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
	}

	@Test
	void TIP은_조회한_순서_그대로_돌려준다() {
		// Given
		givenTips(tip(1, "상환"), tip(2, "계약"), tip(3, "연체"));

		// When
		List<HelpContentResponseDTO> tips = helpService.getTips();

		// Then
		assertEquals(List.of(1, 2, 3), tips.stream().map(HelpContentResponseDTO::getHelpNo).toList());
	}

	@Test
	void TIP은_제목_요약_자세히를_담는다() {
		// Given
		givenTips(tip(1, "상환"));

		// When
		HelpContentResponseDTO dto = helpService.getTips().get(0);

		// Then
		assertEquals("상환", dto.getTitle());
		assertEquals("상환 한 줄 설명", dto.getSummary());
		assertEquals("상환 자세히", dto.getContent());
	}

	@Test
	void TIP_키워드는_keyword1부터_순서대로_담는다() {
		// Given
		givenTips(tip(1, "상환", "금리", "수수료", "상환", "계약", "연체"));

		// When
		HelpContentResponseDTO dto = helpService.getTips().get(0);

		// Then
		assertEquals(List.of("금리", "수수료", "상환", "계약", "연체"), dto.getKeywords());
	}

	@Test
	void TIP의_비어_있는_키워드_칸은_담지_않는다() {
		// Given
		givenTips(tip(1, "상환", "불법/사기"));

		// When
		HelpContentResponseDTO dto = helpService.getTips().get(0);

		// Then
		assertEquals(List.of("불법/사기"), dto.getKeywords());
	}

	@Test
	void TIP이_없으면_빈_목록이다() {
		// Given
		givenTips();

		// When
		List<HelpContentResponseDTO> tips = helpService.getTips();

		// Then
		assertEquals(List.of(), tips);
	}

	@Test
	void TIP을_두_번_불러도_DB는_한_번만_읽는다() {
		// Given
		givenTips(tip(1, "상환"));
		helpService.getTips();

		// When
		helpService.getTips();

		// Then
		verify(helpContentRepository, times(1)).findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
	}

	@Test
	void TIP_캐시에서_꺼낸_목록은_처음_응답과_같은_내용이다() {
		// Given
		givenTips(tip(1, "상환", "상환"));
		List<HelpContentResponseDTO> first = helpService.getTips();

		// When
		List<HelpContentResponseDTO> second = helpService.getTips();

		// Then
		assertEquals(first, second);
	}

	@Test
	void TIP_캐시_칸을_비우면_다시_읽는다() {
		// Given
		givenTips(tip(1, "상환"));
		helpService.getTips();
		memoryCache.clear(MemoryCache.TIP);

		// When
		helpService.getTips();

		// Then
		verify(helpContentRepository, times(2)).findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
	}

	@Test
	void 상품_반영으로_캐시를_비워도_TIP은_남는다() {
		// Given
		givenTips(tip(1, "상환"));
		helpService.getTips();
		memoryCache.clearProductCaches();

		// When
		helpService.getTips();

		// Then
		verify(helpContentRepository, times(1)).findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
	}

	@Test
	void 용어를_먼저_불러도_TIP_목록에는_TIP만_담긴다() {
		// Given
		givenTerms(term(1, "금리"));
		givenTips(tip(1, "상환"));
		helpService.getTerms();

		// When
		List<HelpContentResponseDTO> tips = helpService.getTips();

		// Then
		assertEquals(List.of("상환"), tips.stream().map(HelpContentResponseDTO::getTitle).toList());
	}

	@Test
	void TIP_첫_응답_목록은_수정할_수_없다() {
		// Given
		givenTips(tip(1, "상환"));

		// When
		List<HelpContentResponseDTO> tips = helpService.getTips();

		// Then
		assertThrows(UnsupportedOperationException.class, () -> tips.add(new HelpContentResponseDTO()));
	}

	@Test
	void TIP_캐시에서_꺼낸_목록은_수정할_수_없다() {
		// Given
		givenTips(tip(1, "상환"));
		helpService.getTips();

		// When
		List<HelpContentResponseDTO> tips = helpService.getTips();

		// Then
		assertThrows(UnsupportedOperationException.class, () -> tips.add(new HelpContentResponseDTO()));
	}

	@Test
	void TIP_키워드_목록은_수정할_수_없다() {
		// Given
		givenTips(tip(1, "상환", "상환"));

		// When
		HelpContentResponseDTO dto = helpService.getTips().get(0);

		// Then
		assertThrows(UnsupportedOperationException.class, () -> dto.getKeywords().add("추가"));
	}

	// ========== HELP-01 자주 묻는 질문 (getFaqs) ==========
	// help_stat 가짜는 아무것도 정해 주지 않음 = 집계 행이 하나도 없는 상태

	private static HelpContent faq(int helpNo, String title) {
		return HelpContent.builder()
				.helpId(200L + helpNo)
				.helpType(HelpType.FAQ)
				.helpNo(helpNo)
				.category("사이트 이용")
				.title(title)
				.content(title + " 답")
				.build();
	}

	private void givenFaqs(HelpContent... faqs) {
		when(helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ)).thenReturn(List.of(faqs));
	}

	@Test
	void FAQ는_help_no_순_메서드로_조회한다() {
		// Given
		givenFaqs(faq(1, "가입"));

		// When
		helpService.getFaqs();

		// Then
		verify(helpContentRepository).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
	}

	@Test
	void FAQ는_조회한_순서_그대로_돌려준다() {
		// Given
		givenFaqs(faq(1, "가입"), faq(2, "탈퇴"), faq(3, "비교"));

		// When
		List<HelpContentResponseDTO> faqs = helpService.getFaqs();

		// Then
		assertEquals(List.of(1, 2, 3), faqs.stream().map(HelpContentResponseDTO::getHelpNo).toList());
	}

	@Test
	void FAQ는_분류_질문_답을_담는다() {
		// Given
		givenFaqs(faq(1, "가입"));

		// When
		HelpContentResponseDTO dto = helpService.getFaqs().get(0);

		// Then
		assertEquals("사이트 이용", dto.getCategory());
		assertEquals("가입", dto.getTitle());
		assertEquals("가입 답", dto.getContent());
	}

	@Test
	void 집계가_없는_FAQ의_연_횟수는_0이다() {
		// Given
		givenFaqs(faq(1, "가입"));

		// When
		HelpContentResponseDTO dto = helpService.getFaqs().get(0);

		// Then
		assertEquals(0, dto.getOpenCount());
	}

	@Test
	void FAQ가_없으면_빈_목록이다() {
		// Given
		givenFaqs();

		// When
		List<HelpContentResponseDTO> faqs = helpService.getFaqs();

		// Then
		assertEquals(List.of(), faqs);
	}

	@Test
	void FAQ를_두_번_불러도_DB는_한_번만_읽는다() {
		// Given
		givenFaqs(faq(1, "가입"));
		helpService.getFaqs();

		// When
		helpService.getFaqs();

		// Then
		verify(helpContentRepository, times(1)).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
	}

	@Test
	void FAQ_캐시_칸을_비우면_다시_읽는다() {
		// Given
		givenFaqs(faq(1, "가입"));
		helpService.getFaqs();
		memoryCache.clear(MemoryCache.FAQ);

		// When
		helpService.getFaqs();

		// Then
		verify(helpContentRepository, times(2)).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
	}

	@Test
	void 상품_반영으로_캐시를_비워도_FAQ는_남는다() {
		// Given
		givenFaqs(faq(1, "가입"));
		helpService.getFaqs();
		memoryCache.clearProductCaches();

		// When
		helpService.getFaqs();

		// Then
		verify(helpContentRepository, times(1)).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
	}

	@Test
	void FAQ_첫_응답_목록은_수정할_수_없다() {
		// Given
		givenFaqs(faq(1, "가입"));

		// When
		List<HelpContentResponseDTO> faqs = helpService.getFaqs();

		// Then
		assertThrows(UnsupportedOperationException.class, () -> faqs.add(new HelpContentResponseDTO()));
	}

	@Test
	void FAQ_캐시에서_꺼낸_목록은_수정할_수_없다() {
		// Given
		givenFaqs(faq(1, "가입"));
		helpService.getFaqs();

		// When
		List<HelpContentResponseDTO> faqs = helpService.getFaqs();

		// Then
		assertThrows(UnsupportedOperationException.class, () -> faqs.add(new HelpContentResponseDTO()));
	}

	// ---------- 연 횟수 (help_stat) ----------

	// 대상 번호가 targetKey인 집계 행 하나만 있는 상태. 조회 메서드 이름에 기대지 않도록, 넘겨받은 값에 targetKey가 있으면 그 행을 돌려줌
	private void givenStat(String targetKey, int openCount) {
		HelpStat stat = HelpStat.builder().targetKey(targetKey).openCount(openCount).build();
		helpStatRepository = mock(HelpStatRepository.class, invocation ->
				Arrays.asList(invocation.getArguments()).contains(targetKey) ? Optional.of(stat) : Optional.empty());
		helpService = new HelpServiceImpl(helpContentRepository, memoryCache, helpStatRepository, termRequestRepository,
				helpQuestionRepository);
	}

	@Test
	void 연_횟수는_helpId가_대상_번호인_집계에서_가져온다() {
		// Given (faq(1)의 helpId = 201)
		givenFaqs(faq(1, "가입"));
		givenStat("201", 7);

		// When
		HelpContentResponseDTO dto = helpService.getFaqs().get(0);

		// Then
		assertEquals(7, dto.getOpenCount());
	}

	@Test
	void helpNo가_대상_번호인_집계는_쓰지_않는다() {
		// Given (faq(1)의 helpNo = 1)
		givenFaqs(faq(1, "가입"));
		givenStat("1", 9);

		// When
		HelpContentResponseDTO dto = helpService.getFaqs().get(0);

		// Then
		assertEquals(0, dto.getOpenCount());
	}

	@Test
	void FAQ마다_자기_연_횟수를_담는다() {
		// Given
		givenFaqs(faq(1, "가입"), faq(2, "탈퇴"));
		givenStat("202", 5);

		// When
		List<HelpContentResponseDTO> faqs = helpService.getFaqs();

		// Then
		assertEquals(List.of(0, 5), faqs.stream().map(HelpContentResponseDTO::getOpenCount).toList());
	}

	// ---------- helpId (열기 주소, help_stat 대상 번호에 쓰는 값) ----------

	@Test
	void FAQ에_helpId를_담는다() {
		// Given (faq(1)의 helpId = 201)
		givenFaqs(faq(1, "가입"));

		// When
		HelpContentResponseDTO dto = helpService.getFaqs().get(0);

		// Then
		assertEquals(201L, dto.getHelpId());
	}

	@Test
	void 용어에_helpId를_담는다() {
		// Given (term(3)의 helpId = 3)
		givenTerms(term(3, "금리"));

		// When
		HelpContentResponseDTO dto = helpService.getTerms().get(0);

		// Then
		assertEquals(3L, dto.getHelpId());
	}

	@Test
	void TIP에_helpId를_담는다() {
		// Given (tip(1)의 helpId = 101)
		givenTips(tip(1, "상환"));

		// When
		HelpContentResponseDTO dto = helpService.getTips().get(0);

		// Then
		assertEquals(101L, dto.getHelpId());
	}

	// ========== HELP-01 FAQ 열기 (openFaq) ==========

	// helpId 201인 FAQ가 있고, +1 쿼리가 바꾼 행 수가 changedRows인 상태
	private void givenOpenTarget(int changedRows) {
		when(helpContentRepository.findByHelpTypeAndHelpId(HelpType.FAQ, 201L)).thenReturn(Optional.of(faq(1, "가입")));
		when(helpStatRepository.increaseOpenCount("201")).thenReturn(changedRows);
	}

	private HelpStat savedStat() {
		ArgumentCaptor<HelpStat> captor = ArgumentCaptor.forClass(HelpStat.class);
		verify(helpStatRepository).save(captor.capture());
		return captor.getValue();
	}

	@Test
	void FAQ_내용에_없는_번호를_열면_404이다() {
		// Given (가짜 Repository는 아무것도 찾지 못함 = 없는 번호 또는 FAQ가 아닌 번호)

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> helpService.openFaq(999L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 열_대상이_없으면_집계를_건드리지_않는다() {
		// Given (없는 번호)

		// When
		assertThrows(BusinessException.class, () -> helpService.openFaq(999L));

		// Then
		verifyNoInteractions(helpStatRepository);
	}

	@Test
	void 집계_행이_있으면_helpId로_1을_더한다() {
		// Given
		givenOpenTarget(1);

		// When
		helpService.openFaq(201L);

		// Then
		verify(helpStatRepository).increaseOpenCount("201");
	}

	@Test
	void 집계_행이_있으면_새_행을_만들지_않는다() {
		// Given
		givenOpenTarget(1);

		// When
		helpService.openFaq(201L);

		// Then
		verify(helpStatRepository, never()).save(any(HelpStat.class));
	}

	@Test
	void 집계_행이_없으면_FAQ_종류와_helpId로_새_행을_저장한다() {
		// Given
		givenOpenTarget(0);

		// When
		helpService.openFaq(201L);

		// Then
		HelpStat stat = savedStat();
		assertEquals(HelpType.FAQ, stat.getTargetType());
		assertEquals("201", stat.getTargetKey());
	}

	@Test
	void 새_집계_행의_연_횟수는_1이다() {
		// Given
		givenOpenTarget(0);

		// When
		helpService.openFaq(201L);

		// Then
		assertEquals(1, savedStat().getOpenCount());
	}

	@Test
	void 새_집계_행의_평가_횟수는_0이다() {
		// Given
		givenOpenTarget(0);

		// When
		helpService.openFaq(201L);

		// Then
		HelpStat stat = savedStat();
		assertEquals(0, stat.getHelpfulCount());
		assertEquals(0, stat.getUnhelpfulCount());
	}

	@Test
	void 열고_나면_FAQ_목록을_다시_읽는다() {
		// Given
		givenFaqs(faq(1, "가입"));
		givenOpenTarget(1);
		helpService.getFaqs();
		helpService.openFaq(201L);

		// When
		helpService.getFaqs();

		// Then
		verify(helpContentRepository, times(2)).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
	}

	@Test
	void 처음_열어_행을_만든_뒤에도_FAQ_목록을_다시_읽는다() {
		// Given
		givenFaqs(faq(1, "가입"));
		givenOpenTarget(0);
		helpService.getFaqs();
		helpService.openFaq(201L);

		// When
		helpService.getFaqs();

		// Then
		verify(helpContentRepository, times(2)).findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
	}

	// ========== HELP-07 용어 추가 요청 (addTermRequest) ==========

	private static final LocalDateTime OLD = LocalDateTime.of(2026, 1, 1, 9, 0);

	// "DSR"을 이미 3번 요청받은 상태
	private TermRequest givenRequestedWord() {
		TermRequest saved = TermRequest.builder().requestId(1L).termWord("DSR").requestCount(3)
				.createdAt(OLD).lastRequestedAt(OLD).build();
		when(termRequestRepository.findByTermWord("DSR")).thenReturn(Optional.of(saved));
		return saved;
	}

	private TermRequest savedRequest() {
		ArgumentCaptor<TermRequest> captor = ArgumentCaptor.forClass(TermRequest.class);
		verify(termRequestRepository).save(captor.capture());
		return captor.getValue();
	}

	@Test
	void 처음_요청한_단어는_새_행으로_저장한다() {
		// Given (같은 단어 없음)

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		assertEquals("DSR", savedRequest().getTermWord());
	}

	@Test
	void 새_행의_요청_횟수는_1이다() {
		// Given (같은 단어 없음)

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		assertEquals(1, savedRequest().getRequestCount());
	}

	@Test
	void 새_행에는_처음_요청_시각과_최근_요청_시각을_담는다() {
		// Given (같은 단어 없음)

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		TermRequest saved = savedRequest();
		assertNotNull(saved.getCreatedAt());
		assertNotNull(saved.getLastRequestedAt());
	}

	@Test
	void 앞뒤_공백을_지우고_저장한다() {
		// Given (같은 단어 없음)

		// When
		helpService.addTermRequest(new TermAddRequestDTO("  DSR  "));

		// Then
		assertEquals("DSR", savedRequest().getTermWord());
	}

	@Test
	void 요청_단어의_태그_글자는_바꾸지_않고_저장한다() {
		// Given (같은 단어 없음)

		// When
		helpService.addTermRequest(new TermAddRequestDTO("<b>총부채 원리금</b>"));

		// Then
		assertEquals("<b>총부채 원리금</b>", savedRequest().getTermWord());
	}

	@Test
	void 같은_단어면_요청_횟수가_1_늘어난다() {
		// Given
		TermRequest saved = givenRequestedWord();

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		assertEquals(4, saved.getRequestCount());
	}

	@Test
	void 앞뒤_공백만_다른_단어도_같은_단어로_센다() {
		// Given
		TermRequest saved = givenRequestedWord();

		// When
		helpService.addTermRequest(new TermAddRequestDTO(" DSR "));

		// Then
		assertEquals(4, saved.getRequestCount());
	}

	@Test
	void 같은_단어면_최근_요청_시각을_갱신한다() {
		// Given
		TermRequest saved = givenRequestedWord();

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		assertTrue(saved.getLastRequestedAt().isAfter(OLD));
	}

	@Test
	void 같은_단어면_처음_요청_시각은_그대로다() {
		// Given
		TermRequest saved = givenRequestedWord();

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		assertEquals(OLD, saved.getCreatedAt());
	}

	@Test
	void 같은_단어면_새_행을_만들지_않는다() {
		// Given
		givenRequestedWord();

		// When
		helpService.addTermRequest(new TermAddRequestDTO("DSR"));

		// Then
		verify(termRequestRepository, never()).save(any(TermRequest.class));
	}

	// ========== HELP-05 질문 남기기 (addQuestion) ==========

	private static MockHttpSession memberSession() {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(7L, "회원", "1990", "01-01"));
		return session;
	}

	private void ask(String content) {
		helpService.addQuestion(new QuestionRequestDTO(content), null);
	}

	private HelpQuestion savedQuestion() {
		ArgumentCaptor<HelpQuestion> captor = ArgumentCaptor.forClass(HelpQuestion.class);
		verify(helpQuestionRepository).save(captor.capture());
		return captor.getValue();
	}

	private void assertInvalidQuestion(String content) {
		BusinessException e = assertThrows(BusinessException.class, () -> ask(content));
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 비회원의_질문도_저장한다() {
		// Given (세션 없음)

		// When
		ask("대출 비교는 어떻게 하나요");

		// Then
		assertEquals("대출 비교는 어떻게 하나요", savedQuestion().getContent());
	}

	@Test
	void 세션이_없으면_회원_여부는_N이다() {
		// Given (세션 없음)

		// When
		ask("질문 있어요");

		// Then
		assertEquals("N", String.valueOf(savedQuestion().getMemberYn()));
	}

	@Test
	void 로그인하지_않은_세션이면_회원_여부는_N이다() {
		// Given
		MockHttpSession session = new MockHttpSession();

		// When
		helpService.addQuestion(new QuestionRequestDTO("질문 있어요"), session);

		// Then
		assertEquals("N", String.valueOf(savedQuestion().getMemberYn()));
	}

	@Test
	void 로그인한_회원이면_회원_여부는_Y다() {
		// Given
		MockHttpSession session = memberSession();

		// When
		helpService.addQuestion(new QuestionRequestDTO("질문 있어요"), session);

		// Then
		assertEquals("Y", String.valueOf(savedQuestion().getMemberYn()));
	}

	@Test
	void 새_질문의_상태는_PENDING이다() {
		// Given, When
		ask("질문 있어요");

		// Then
		assertEquals(QuestionStatus.PENDING, savedQuestion().getQuestionStatus());
	}

	@Test
	void 새_질문에는_남긴_시각을_담는다() {
		// Given, When
		ask("질문 있어요");

		// Then
		assertNotNull(savedQuestion().getCreatedAt());
	}

	@Test
	void 질문의_앞뒤_공백을_지우고_저장한다() {
		// Given, When
		ask("  질문 있어요  ");

		// Then
		assertEquals("질문 있어요", savedQuestion().getContent());
	}

	@Test
	void 질문의_태그_글자는_바꾸지_않고_저장한다() {
		// Given, When
		ask("<b>금리</b> & 한도?");

		// Then
		assertEquals("<b>금리</b> & 한도?", savedQuestion().getContent());
	}

	@Test
	void 질문이_3자면_400이다() {
		// Given, When, Then
		assertInvalidQuestion("가".repeat(3));
	}

	@Test
	void 공백을_지우면_2자인_질문은_400이다() {
		// Given, When, Then
		assertInvalidQuestion("  가나  ");
	}

	@Test
	void 질문이_301자면_400이다() {
		// Given, When, Then
		assertInvalidQuestion("가".repeat(301));
	}

	@Test
	void 길이가_틀린_질문은_저장하지_않는다() {
		// Given, When
		assertThrows(BusinessException.class, () -> ask("가"));

		// Then
		verifyNoInteractions(helpQuestionRepository);
	}

	@Test
	void 질문이_4자면_저장한다() {
		// Given, When
		ask("가".repeat(4));

		// Then
		assertEquals(4, savedQuestion().getContent().length());
	}

	@Test
	void 질문이_300자면_저장한다() {
		// Given, When
		ask("가".repeat(300));

		// Then
		assertEquals(300, savedQuestion().getContent().length());
	}

	// ========== HELP-06 도움말 평가 (addFeedback) ==========

	// helpId 201인 FAQ가 있는 상태
	private void givenFeedbackTarget() {
		when(helpContentRepository.findByHelpTypeAndHelpId(HelpType.FAQ, 201L)).thenReturn(Optional.of(faq(1, "가입")));
	}

	// 그 FAQ의 집계 행이 이미 있는 상태 (도움돼요 helpful, 별로예요 unhelpful)
	private HelpStat givenFeedbackStat(int helpful, int unhelpful) {
		givenFeedbackTarget();
		HelpStat stat = HelpStat.builder().statId(1L).targetType(HelpType.FAQ).targetKey("201")
				.openCount(5).helpfulCount(helpful).unhelpfulCount(unhelpful).build();
		when(helpStatRepository.findByTargetKeyAndTargetType("201", HelpType.FAQ)).thenReturn(Optional.of(stat));
		return stat;
	}

	private void feedback(Vote vote, boolean cancel) {
		helpService.addFeedback(new FeedbackRequestDTO(HelpType.FAQ, 201L, vote, cancel));
	}

	@Test
	void 평가_대상이_없거나_종류가_다르면_404이다() {
		// Given (가짜 Repository는 아무것도 찾지 못함)

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> feedback(Vote.UP, false));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 평가_대상이_없으면_집계를_건드리지_않는다() {
		// Given (없는 대상)

		// When
		assertThrows(BusinessException.class, () -> feedback(Vote.UP, false));

		// Then
		verifyNoInteractions(helpStatRepository);
	}

	@Test
	void 첫_평가는_보낸_종류와_helpId로_행을_만든다() {
		// Given
		givenFeedbackTarget();

		// When
		feedback(Vote.UP, false);

		// Then
		HelpStat stat = savedStat();
		assertEquals(HelpType.FAQ, stat.getTargetType());
		assertEquals("201", stat.getTargetKey());
	}

	@Test
	void 첫_평가가_UP이면_도움돼요만_1이다() {
		// Given
		givenFeedbackTarget();

		// When
		feedback(Vote.UP, false);

		// Then
		HelpStat stat = savedStat();
		assertEquals(1, stat.getHelpfulCount());
		assertEquals(0, stat.getUnhelpfulCount());
	}

	@Test
	void 첫_평가가_DOWN이면_별로예요만_1이다() {
		// Given
		givenFeedbackTarget();

		// When
		feedback(Vote.DOWN, false);

		// Then
		HelpStat stat = savedStat();
		assertEquals(0, stat.getHelpfulCount());
		assertEquals(1, stat.getUnhelpfulCount());
	}

	@Test
	void 평가로_만든_행의_연_횟수는_0이다() {
		// Given
		givenFeedbackTarget();

		// When
		feedback(Vote.UP, false);

		// Then
		assertEquals(0, savedStat().getOpenCount());
	}

	@Test
	void 행이_없는_취소는_0인_행을_추가한다() {
		// Given (명세: 0 밑으로 안 내림, 없으면 행 추가)
		givenFeedbackTarget();

		// When
		feedback(Vote.UP, true);

		// Then
		HelpStat stat = savedStat();
		assertEquals(0, stat.getHelpfulCount());
		assertEquals(0, stat.getUnhelpfulCount());
	}

	@Test
	void 행이_있으면_UP은_도움돼요를_1_늘린다() {
		// Given
		HelpStat stat = givenFeedbackStat(3, 2);

		// When
		feedback(Vote.UP, false);

		// Then
		assertEquals(4, stat.getHelpfulCount());
		assertEquals(2, stat.getUnhelpfulCount());
	}

	@Test
	void 행이_있으면_DOWN은_별로예요를_1_늘린다() {
		// Given
		HelpStat stat = givenFeedbackStat(3, 2);

		// When
		feedback(Vote.DOWN, false);

		// Then
		assertEquals(3, stat.getHelpfulCount());
		assertEquals(3, stat.getUnhelpfulCount());
	}

	@Test
	void UP_취소는_도움돼요를_1_줄인다() {
		// Given
		HelpStat stat = givenFeedbackStat(3, 2);

		// When
		feedback(Vote.UP, true);

		// Then
		assertEquals(2, stat.getHelpfulCount());
		assertEquals(2, stat.getUnhelpfulCount());
	}

	@Test
	void DOWN_취소는_별로예요를_1_줄인다() {
		// Given
		HelpStat stat = givenFeedbackStat(3, 2);

		// When
		feedback(Vote.DOWN, true);

		// Then
		assertEquals(3, stat.getHelpfulCount());
		assertEquals(1, stat.getUnhelpfulCount());
	}

	@Test
	void 취소해도_0_밑으로_내려가지_않는다() {
		// Given
		HelpStat stat = givenFeedbackStat(0, 0);

		// When
		feedback(Vote.UP, true);
		feedback(Vote.DOWN, true);

		// Then
		assertEquals(0, stat.getHelpfulCount());
		assertEquals(0, stat.getUnhelpfulCount());
	}

	@Test
	void UP_취소는_별로예요를_바꾸지_않는다() {
		// Given (도움돼요가 0인 상태)
		HelpStat stat = givenFeedbackStat(0, 3);

		// When
		feedback(Vote.UP, true);

		// Then
		assertEquals(3, stat.getUnhelpfulCount());
	}

	@Test
	void DOWN_취소는_도움돼요를_바꾸지_않는다() {
		// Given (별로예요가 0인 상태)
		HelpStat stat = givenFeedbackStat(3, 0);

		// When
		feedback(Vote.DOWN, true);

		// Then
		assertEquals(3, stat.getHelpfulCount());
	}

	@Test
	void 행이_있고_cancel이_없으면_1_늘린다() {
		// Given (담당자 결정: cancel을 보내지 않으면 취소가 아님)
		HelpStat stat = givenFeedbackStat(3, 2);

		// When
		helpService.addFeedback(new FeedbackRequestDTO(HelpType.FAQ, 201L, Vote.UP, null));

		// Then
		assertEquals(4, stat.getHelpfulCount());
	}

	@Test
	void 행이_없고_cancel이_없으면_1인_행을_만든다() {
		// Given
		givenFeedbackTarget();

		// When
		helpService.addFeedback(new FeedbackRequestDTO(HelpType.FAQ, 201L, Vote.UP, null));

		// Then
		assertEquals(1, savedStat().getHelpfulCount());
	}

	@Test
	void 첫_평가_저장이_겹치면_409이다() {
		// Given (담당자 결정: 동시에 처음 저장해 unique 제약에 걸리면 CONFLICT)
		givenFeedbackTarget();
		when(helpStatRepository.save(any(HelpStat.class))).thenThrow(new DataIntegrityViolationException("uq_help_stat"));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> feedback(Vote.UP, false));

		// Then
		assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
	}

	@Test
	void 평가는_연_횟수를_바꾸지_않는다() {
		// Given
		HelpStat stat = givenFeedbackStat(3, 2);

		// When
		feedback(Vote.UP, false);

		// Then
		assertEquals(5, stat.getOpenCount());
	}
}
