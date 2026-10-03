package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.AdminDashboardResponse;
import com.minkamarket.ecommerce.dto.UsuarioResponse;
import com.minkamarket.ecommerce.enums.RolUsuario;
import com.minkamarket.ecommerce.repository.PedidoRepository;
import com.minkamarket.ecommerce.repository.ProductoRepository;
import com.minkamarket.ecommerce.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class AdminService {

    private final ProductoRepository productoRepository;
    private final PedidoRepository pedidoRepository;
    private final UsuarioRepository usuarioRepository;
    private final AuthService authService;

    public AdminService(ProductoRepository productoRepository,
                        PedidoRepository pedidoRepository,
                        UsuarioRepository usuarioRepository,
                        AuthService authService) {
        this.productoRepository = productoRepository;
        this.pedidoRepository = pedidoRepository;
        this.usuarioRepository = usuarioRepository;
        this.authService = authService;
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse dashboard() {
        BigDecimal ventas = pedidoRepository.sumarVentasNoCanceladas();
        return new AdminDashboardResponse(
                productoRepository.countByActivoTrue(),
                productoRepository.countByActivoTrueAndStockLessThanEqual(5),
                pedidoRepository.count(),
                usuarioRepository.countByRol(RolUsuario.CLIENTE),
                ventas == null ? BigDecimal.ZERO : ventas
        );
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> listarUsuarios() {
        return usuarioRepository.findAllByOrderByCreadoEnDesc().stream()
                .map(authService::toResponse)
                .toList();
    }
}
