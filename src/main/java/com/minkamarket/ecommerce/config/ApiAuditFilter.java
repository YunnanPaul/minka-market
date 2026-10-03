package com.minkamarket.ecommerce.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Registra trazabilidad de la API sin almacenar contraseñas ni cuerpos de petición. */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class ApiAuditFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiAuditFilter.class);

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        long startedAt = System.nanoTime();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
            int status = response.getStatus();
            if (status >= 400) {
                log.warn("API {} {} -> {} ({} ms)",
                        request.getMethod(), request.getRequestURI(), status, elapsedMs);
            } else if (!"GET".equalsIgnoreCase(request.getMethod())) {
                log.info("API {} {} -> {} ({} ms)",
                        request.getMethod(), request.getRequestURI(), status, elapsedMs);
            }
        }
    }
}
