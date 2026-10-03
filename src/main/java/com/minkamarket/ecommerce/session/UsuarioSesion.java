package com.minkamarket.ecommerce.session;

import com.minkamarket.ecommerce.enums.RolUsuario;

import java.io.Serial;
import java.io.Serializable;

public record UsuarioSesion(
        Long id,
        String nombreCompleto,
        String email,
        RolUsuario rol
) implements Serializable {

    public static final String SESSION_ATTRIBUTE = "MINKA_USUARIO";

    @Serial
    private static final long serialVersionUID = 1L;
}
