package chorong.common.config;

import chorong.member.service.SocialUserService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/*
 * Spring Security 설정 (SET-02 틀 + MEM-05 마무리)
 * - formLogin, httpBasic, logout 끔. 경로는 모두 permitAll, 로그인 확인은 인터셉터로
 * - CSRF는 끄고 SameSite=Lax 쿠키 + JSON 요청만 받음 (B7)
 * - oauth2Login 켬: 사용자 정보 SocialUserService, 성공 OAuth2SuccessHandler, 실패 OAuth2FailureHandler
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {
	// 핸들러는 필드에 담지 않고 Bean 메서드 인자로 받음 (SpotBugs EI_EXPOSE_REP2 피함)
	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http, SocialUserService socialUserService,
			OAuth2SuccessHandler oAuth2SuccessHandler, OAuth2FailureHandler oAuth2FailureHandler) throws Exception{
		http.csrf(AbstractHttpConfigurer::disable)
				.cors(Customizer.withDefaults())
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
				.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
				//OAuth2 로그인 설정 및 서비스 연결
				.oauth2Login(oauth2 -> oauth2
						.userInfoEndpoint(userInfo -> userInfo
								.userService(socialUserService))
						.successHandler(oAuth2SuccessHandler)
						.failureHandler(oAuth2FailureHandler));
		return http.build();
	}
}

