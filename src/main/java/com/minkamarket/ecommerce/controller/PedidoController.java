package com.minkamarket.ecommerce.controller;

import com.minkamarket.ecommerce.dto.CrearPedidoRequest;
import com.minkamarket.ecommerce.dto.PedidoResponse;
import com.minkamarket.ecommerce.service.AuthService;
import com.minkamarket.ecommerce.service.PedidoService;
import com.minkamarket.ecommerce.session.UsuarioSesion;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pedidos")
public class PedidoController {

    private final PedidoService pedidoService;
    private final AuthService authService;

    public PedidoController(PedidoService pedidoService, AuthService authService) {
        this.pedidoService = pedidoService;
        this.authService = authService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PedidoResponse crear(@Valid @RequestBody CrearPedidoRequest request,
                                HttpSession session) {
        UsuarioSesion usuario = authService.requerirUsuario(session);
        return pedidoService.crearPedido(usuario, request, session);
    }

    @GetMapping("/mios")
    public List<PedidoResponse> listarMios(HttpSession session) {
        UsuarioSesion usuario = authService.requerirUsuario(session);
        return pedidoService.listarDelUsuario(usuario.id());
    }

    @GetMapping("/{id}")
    public PedidoResponse obtener(@PathVariable Long id, HttpSession session) {
        UsuarioSesion usuario = authService.requerirUsuario(session);
        return pedidoService.obtenerDelUsuario(id, usuario.id());
    }
}
