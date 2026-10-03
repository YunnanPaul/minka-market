package com.minkamarket.ecommerce.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record AgregarCarritoRequest(
        @NotNull Long productoId,
        @NotNull @Min(1) Integer cantidad
) {
}
