package com.minkamarket.ecommerce.controller;

import com.minkamarket.ecommerce.dto.LoginRequest;
import com.minkamarket.ecommerce.dto.RegistroRequest;
import com.minkamarket.ecommerce.dto.UsuarioResponse;
import com.minkamarket.ecommerce.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/registro")
    public ResponseEntity<UsuarioResponse> registrar(@Valid @RequestBody RegistroRequest request,
                                                     HttpServletRequest servletRequest) {
        HttpSession session = servletRequest.getSession(true);
        UsuarioResponse response = authService.registrar(request, session);
        servletRequest.changeSessionId();
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public UsuarioResponse login(@Valid @RequestBody LoginRequest request,
                                 HttpServletRequest servletRequest) {
        HttpSession session = servletRequest.getSession(true);
        UsuarioResponse response = authService.iniciarSesion(request, session);
        servletRequest.changeSessionId();
        return response;
    }

    @GetMapping("/me")
    public ResponseEntity<UsuarioResponse> me(HttpSession session) {
        UsuarioResponse usuario = authService.usuarioActual(session);
        return usuario == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(usuario);
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return Map.of("message", "Sesión cerrada correctamente.");
    }
}
