package com.minkamarket.ecommerce.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record ActualizarCantidadRequest(
        @NotNull @Min(1) Integer cantidad
) {
}
