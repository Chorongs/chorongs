package chorong.common.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 쪽 나눔 응답 data = { list, total, page, size }
 * 요청 page는 1부터, size는 기본 20, 최대 50 (B10)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageInfo<T> {
	private List<T> list;	// 이번 쪽 목록
	private Long total;		// 전체 개수
	private Integer page;	// 현재 쪽 번호 (1부터)
	private Integer size;	// 한 쪽 개수
}
