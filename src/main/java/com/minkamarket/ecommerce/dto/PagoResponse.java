package com.minkamarket.ecommerce.dto;

import com.minkamarket.ecommerce.enums.EstadoPago;
import com.minkamarket.ecommerce.enums.MetodoPago;

import java.math.BigDecimal;
import java.time.Instant;

public record PagoResponse(
        MetodoPago metodo,
        EstadoPago estado,
        String referencia,
        BigDecimal monto,
        Instant fecha
) {
}
