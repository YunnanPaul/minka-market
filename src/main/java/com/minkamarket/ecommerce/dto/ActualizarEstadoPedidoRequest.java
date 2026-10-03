package com.minkamarket.ecommerce.dto;

import com.minkamarket.ecommerce.enums.EstadoPedido;
import jakarta.validation.constraints.NotNull;

public record ActualizarEstadoPedidoRequest(
        @NotNull EstadoPedido estado
) {
}
