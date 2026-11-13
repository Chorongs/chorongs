package chorong.common.config;

import chorong.member.service.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;

/*
 * Spring Security 최소 틀 (SET-02): 기본 보안 기능을 끄고 로그인 확인은 인터셉터로
 * - CSRF는 끄고 SameSite=Lax 쿠키 + JSON 요청만 받음 (B7)
 * - 소셜 로그인(oauth2Login) 등 최종 설정은 MEM-05에서 이어서 마무리
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
	private final CustomOAuth2UserService customOAuth2UserService;
	private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception{
		http.csrf(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
				.authorizeHttpRequests(auth -> auth
						.requestMatchers("/", "/login/**", "/oauth2/**", "/css/**", "/js/**", "/images/**").permitAll()
						// 그 외 모든 요청은 로그인(인증)된 사용자만 접근 가능
						.anyRequest().authenticated())
				//OAuth2 로그인 설정 및 서비스 연결
				.oauth2Login(oauth2 -> oauth2
						.userInfoEndpoint(userInfo -> userInfo
								.userService(customOAuth2UserService))
						.successHandler(oAuth2LoginSuccessHandler));
		return http.build();
	}
}

