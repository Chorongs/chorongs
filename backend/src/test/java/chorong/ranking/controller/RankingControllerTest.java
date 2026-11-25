package chorong.ranking.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.ranking.dto.RankingRequestDTO;
import chorong.ranking.dto.RankingResponseDTO;
import chorong.ranking.service.RankingService;

/*
 * RANK-01, 02 GET /api/rankings?cat=&metric=&dir= 주소 테스트
 * 기대값 출처: be_ranking.md (권한: 모두, 요청 metric rate, limit, term, views / dir asc, desc) + be_common.md B2
 *   (요청 DTO 표시 + 컨트롤러 @Valid, 실패 400, 오류 응답은 GlobalExceptionHandler 그대로)
 * Service는 Mockito 가짜
 */
class RankingControllerTest {

	private RankingService rankingService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		rankingService = mock(RankingService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new RankingController(rankingService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
		when(rankingService.getRanking(any(RankingRequestDTO.class)))
				.thenReturn(new RankingResponseDTO(List.of(), 0, null));
	}

	@Test
	void 정상_요청은_200이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("cat", "").param("metric", "rate").param("dir", "asc"))
				.andExpect(status().isOk());
	}

	@Test
	void 응답은_공통_모양으로_감싸서_나간다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "rate").param("dir", "asc"))
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.total").value(0));
	}

	@Test
	void 로그인하지_않아도_호출할_수_있다() throws Exception {
		// Given (세션 없음), When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "views").param("dir", "desc"))
				.andExpect(status().isOk());
	}

	@Test
	void cat_metric_dir_값을_Service에_넘긴다() throws Exception {
		// Given, When
		mockMvc.perform(get("/api/rankings").param("cat", "은행권").param("metric", "limit").param("dir", "desc"));

		// Then
		ArgumentCaptor<RankingRequestDTO> captor = ArgumentCaptor.forClass(RankingRequestDTO.class);
		verify(rankingService).getRanking(captor.capture());
		assertEquals("은행권", captor.getValue().getCat());
		assertEquals("limit", captor.getValue().getMetric());
		assertEquals("desc", captor.getValue().getDir());
	}

	@Test
	void cat을_안_보내면_null로_넘어간다() throws Exception {
		// Given, When
		mockMvc.perform(get("/api/rankings").param("metric", "rate").param("dir", "asc"));

		// Then
		ArgumentCaptor<RankingRequestDTO> captor = ArgumentCaptor.forClass(RankingRequestDTO.class);
		verify(rankingService).getRanking(captor.capture());
		assertNull(captor.getValue().getCat());
	}

	@Test
	void 모르는_metric은_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "abc").param("dir", "asc"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 모르는_dir은_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "rate").param("dir", "up"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 대문자_metric은_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "RATE").param("dir", "asc"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void SQL을_섞은_dir은_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "rate").param("dir", "asc; drop table x"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void metric이_틀리면_Service를_부르지_않는다() throws Exception {
		// Given, When
		mockMvc.perform(get("/api/rankings").param("metric", "abc").param("dir", "asc"));

		// Then
		verifyNoInteractions(rankingService);
	}

	@Test
	void 오류_응답은_INVALID_INPUT_코드이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/rankings").param("metric", "abc").param("dir", "asc"))
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
	}

	@Test
	void Service가_400을_던지면_400으로_응답한다() throws Exception {
		// Given (모르는 cat은 Service가 확인)
		when(rankingService.getRanking(any(RankingRequestDTO.class)))
				.thenThrow(new BusinessException(ErrorCode.INVALID_INPUT));

		// When, Then
		mockMvc.perform(get("/api/rankings").param("cat", "없는금융권").param("metric", "rate").param("dir", "asc"))
				.andExpect(status().isBadRequest());
	}
}
