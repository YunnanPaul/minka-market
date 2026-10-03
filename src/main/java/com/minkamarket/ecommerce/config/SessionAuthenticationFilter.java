package com.minkamarket.ecommerce.config;

import com.minkamarket.ecommerce.session.UsuarioSesion;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

/** Integra la autenticación almacenada en HttpSession con Spring Security. */
public final class SessionAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            HttpSession session = request.getSession(false);
            Object value = session == null
                    ? null
                    : session.getAttribute(UsuarioSesion.SESSION_ATTRIBUTE);

            if (value instanceof UsuarioSesion usuario && usuario.rol() != null) {
                var authority = new SimpleGrantedAuthority("ROLE_" + usuario.rol().name());
                var authentication = new UsernamePasswordAuthenticationToken(
                        usuario,
                        null,
                        List.of(authority)
                );
                authentication.setDetails(
                        new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }
}
