package com.minkamarket.ecommerce.dto;

import com.minkamarket.ecommerce.enums.MetodoPago;
import com.minkamarket.ecommerce.enums.TipoEntrega;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CrearPedidoRequest(
        @NotNull TipoEntrega tipoEntrega,
        @NotNull MetodoPago metodoPago,
        @Size(max = 350) String direccionEntrega,
        @Size(max = 500) String observacion
) {
}
