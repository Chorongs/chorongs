package chorong.common.config;

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
public class SecurityConfig {

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) {
		http.csrf(AbstractHttpConfigurer::disable)
			.formLogin(AbstractHttpConfigurer::disable)
			.httpBasic(AbstractHttpConfigurer::disable)
			.logout(AbstractHttpConfigurer::disable)
			.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());	// 모든 주소 허용

		return http.build();
	}
}
