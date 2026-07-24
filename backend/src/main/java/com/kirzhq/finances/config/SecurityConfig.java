package com.kirzhq.finances.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.webauthn.management.JdbcPublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.JdbcUserCredentialRepository;
import org.springframework.security.web.webauthn.management.PublicKeyCredentialUserEntityRepository;
import org.springframework.security.web.webauthn.management.UserCredentialRepository;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.http.HttpStatus;

import java.io.IOException;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
            @Value("${app.auth.rp-id}") String rpId,
            @Value("${app.auth.origin}") String origin) throws Exception {
        CookieCsrfTokenRepository csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        CsrfTokenRequestAttributeHandler requestHandler = new CsrfTokenRequestAttributeHandler();
        requestHandler.setCsrfRequestAttributeName(null);

        return http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/login", "/error", "/favicon.ico").permitAll()
                        .anyRequest().authenticated())
                .formLogin(form -> form.defaultSuccessUrl("/", true))
                .exceptionHandling(exceptions -> exceptions.defaultAuthenticationEntryPointFor(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                        request -> request.getRequestURI().startsWith("/api/")))
                .logout(logout -> logout.logoutSuccessUrl("/login"))
                .csrf(configurer -> configurer
                        .csrfTokenRepository(csrf)
                        .csrfTokenRequestHandler(requestHandler))
                .webAuthn(webAuthn -> webAuthn
                        .rpName("Мои финансы")
                        .rpId(rpId)
                        .allowedOrigins(origin))
                .addFilterAfter(new CsrfCookieFilter(), org.springframework.security.web.authentication.AnonymousAuthenticationFilter.class)
                .build();
    }

    @Bean
    UserDetailsService userDetailsService(
            @Value("${app.auth.username:finance}") String username,
            @Value("${app.auth.setup-password}") String password) {
        return new InMemoryUserDetailsManager(User.withUsername(username)
                .password("{noop}" + password)
                .roles("USER")
                .build());
    }

    @Bean
    PublicKeyCredentialUserEntityRepository passkeyUsers(JdbcOperations jdbc) {
        return new JdbcPublicKeyCredentialUserEntityRepository(jdbc);
    }

    @Bean
    UserCredentialRepository passkeyCredentials(JdbcOperations jdbc) {
        return new JdbcUserCredentialRepository(jdbc);
    }

    private static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            CsrfToken token = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (token != null) token.getToken();
            chain.doFilter(request, response);
        }
    }
}
