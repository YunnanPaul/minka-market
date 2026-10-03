package com.minkamarket.ecommerce.dto;

import com.minkamarket.ecommerce.enums.RolUsuario;

import java.time.Instant;

public record UsuarioResponse(
        Long id,
        String nombreCompleto,
        String email,
        String telefono,
        String direccion,
        RolUsuario rol,
        boolean activo,
        Instant creadoEn
) {
}
