package com.minkamarket.ecommerce.controller;

import com.minkamarket.ecommerce.dto.ActualizarEstadoPedidoRequest;
import com.minkamarket.ecommerce.dto.PedidoResponse;
import com.minkamarket.ecommerce.service.AuthService;
import com.minkamarket.ecommerce.service.PedidoService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/pedidos")
public class AdminPedidoController {

    private final PedidoService pedidoService;
    private final AuthService authService;

    public AdminPedidoController(PedidoService pedidoService, AuthService authService) {
        this.pedidoService = pedidoService;
        this.authService = authService;
    }

    @GetMapping
    public List<PedidoResponse> listar(HttpSession session) {
        authService.requerirAdmin(session);
        return pedidoService.listarTodos();
    }

    @PatchMapping("/{id}/estado")
    public PedidoResponse actualizarEstado(@PathVariable Long id,
                                           @Valid @RequestBody ActualizarEstadoPedidoRequest request,
                                           HttpSession session) {
        authService.requerirAdmin(session);
        return pedidoService.actualizarEstado(id, request.estado());
    }
}
