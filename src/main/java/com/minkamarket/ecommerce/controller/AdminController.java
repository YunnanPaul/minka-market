package com.minkamarket.ecommerce.controller;

import com.minkamarket.ecommerce.dto.AdminDashboardResponse;
import com.minkamarket.ecommerce.dto.UsuarioResponse;
import com.minkamarket.ecommerce.service.AdminService;
import com.minkamarket.ecommerce.service.AuthService;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final AuthService authService;

    public AdminController(AdminService adminService, AuthService authService) {
        this.adminService = adminService;
        this.authService = authService;
    }

    @GetMapping("/dashboard")
    public AdminDashboardResponse dashboard(HttpSession session) {
        authService.requerirAdmin(session);
        return adminService.dashboard();
    }

    @GetMapping("/usuarios")
    public List<UsuarioResponse> usuarios(HttpSession session) {
        authService.requerirAdmin(session);
        return adminService.listarUsuarios();
    }
}
