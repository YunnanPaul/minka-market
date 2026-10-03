package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.LoginRequest;
import com.minkamarket.ecommerce.dto.RegistroRequest;
import com.minkamarket.ecommerce.dto.UsuarioResponse;
import com.minkamarket.ecommerce.entity.Usuario;
import com.minkamarket.ecommerce.enums.RolUsuario;
import com.minkamarket.ecommerce.exception.ApiException;
import com.minkamarket.ecommerce.repository.UsuarioRepository;
import com.minkamarket.ecommerce.session.UsuarioSesion;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UsuarioRepository usuarioRepository,
                       PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UsuarioResponse registrar(RegistroRequest request, HttpSession session) {
        String email = normalizarEmail(request.email());
        if (usuarioRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "El correo electrónico ya está registrado.");
        }

        Usuario usuario = new Usuario(
                request.nombreCompleto().strip(),
                email,
                passwordEncoder.encode(request.password()),
                request.telefono().strip(),
                request.direccion().strip(),
                RolUsuario.CLIENTE,
                true
        );
        usuarioRepository.save(usuario);
        guardarSesion(usuario, session);
        return toResponse(usuario);
    }

    @Transactional(readOnly = true)
    public UsuarioResponse iniciarSesion(LoginRequest request, HttpSession session) {
        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(normalizarEmail(request.email()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos."));

        if (!usuario.isActivo() || !passwordEncoder.matches(request.password(), usuario.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos.");
        }

        guardarSesion(usuario, session);
        return toResponse(usuario);
    }

    @Transactional(readOnly = true)
    public UsuarioResponse usuarioActual(HttpSession session) {
        Usuario usuario = buscarUsuarioVigente(session);
        if (usuario == null) {
            return null;
        }
        sincronizarSesion(usuario, session);
        return toResponse(usuario);
    }

    /**
     * No confía únicamente en el rol almacenado en HttpSession. La cuenta y sus
     * permisos se vuelven a comprobar en PostgreSQL para que una desactivación o un
     * cambio de rol tenga efecto inmediato, incluso sobre sesiones ya abiertas.
     */
    @Transactional(readOnly = true)
    public UsuarioSesion requerirUsuario(HttpSession session) {
        Usuario usuario = buscarUsuarioVigente(session);
        if (usuario == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Debe iniciar sesión para continuar.");
        }
        return sincronizarSesion(usuario, session);
    }

    @Transactional(readOnly = true)
    public UsuarioSesion requerirAdmin(HttpSession session) {
        UsuarioSesion usuario = requerirUsuario(session);
        if (usuario.rol() != RolUsuario.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Esta operación requiere permisos de administrador.");
        }
        return usuario;
    }

    public UsuarioSesion obtenerSesion(HttpSession session) {
        Object value = session.getAttribute(UsuarioSesion.SESSION_ATTRIBUTE);
        return value instanceof UsuarioSesion usuario ? usuario : null;
    }

    public UsuarioResponse toResponse(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNombreCompleto(),
                usuario.getEmail(),
                usuario.getTelefono(),
                usuario.getDireccion(),
                usuario.getRol(),
                usuario.isActivo(),
                usuario.getCreadoEn()
        );
    }

    private void guardarSesion(Usuario usuario, HttpSession session) {
        session.setAttribute(UsuarioSesion.SESSION_ATTRIBUTE, crearSesion(usuario));
    }

    private Usuario buscarUsuarioVigente(HttpSession session) {
        UsuarioSesion sesion = obtenerSesion(session);
        if (sesion == null) {
            return null;
        }

        Usuario usuario = usuarioRepository.findById(sesion.id()).orElse(null);
        if (usuario == null || !usuario.isActivo()) {
            session.removeAttribute(UsuarioSesion.SESSION_ATTRIBUTE);
            return null;
        }
        return usuario;
    }

    private UsuarioSesion sincronizarSesion(Usuario usuario, HttpSession session) {
        UsuarioSesion vigente = crearSesion(usuario);
        UsuarioSesion anterior = obtenerSesion(session);
        if (!vigente.equals(anterior)) {
            session.setAttribute(UsuarioSesion.SESSION_ATTRIBUTE, vigente);
        }
        return vigente;
    }

    private UsuarioSesion crearSesion(Usuario usuario) {
        return new UsuarioSesion(
                usuario.getId(),
                usuario.getNombreCompleto(),
                usuario.getEmail(),
                usuario.getRol()
        );
    }

    private String normalizarEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
