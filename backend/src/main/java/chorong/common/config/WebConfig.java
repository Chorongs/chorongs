package chorong.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import chorong.common.interceptor.AdminInterceptor;
import chorong.common.interceptor.LoginInterceptor;
import lombok.RequiredArgsConstructor;

/*
 * Spring MVC 공통 설정: CORS (B6), 인터셉터 등록
 */
@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

	private final AdminInterceptor adminInterceptor;

	@Value("${front.url}")
	private String frontUrl;

	/** 프론트 주소만 허용 + 쿠키 같이 (전체 허용 * 금지) */
	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/**")
				.allowedOrigins(frontUrl)
				.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
				.allowCredentials(true);
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		// 회원 로그인 확인 (신고 주소는 POST만 있음)
		registry.addInterceptor(new LoginInterceptor())
				.addPathPatterns("/api/me/**", "/api/products/*/reports");

		// 관리자 확인 (로그인, 가입 주소는 제외)
		registry.addInterceptor(adminInterceptor)
				.addPathPatterns("/api/admin/**")
				.excludePathPatterns("/api/admin/auth/**", "/api/admin/join/**");
	}
}
