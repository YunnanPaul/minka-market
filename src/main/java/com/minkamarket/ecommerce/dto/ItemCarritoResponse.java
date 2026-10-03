package com.minkamarket.ecommerce.dto;

import java.math.BigDecimal;

public record ItemCarritoResponse(
        Long productoId,
        String sku,
        String nombre,
        String imagenUrl,
        BigDecimal precioUnitario,
        Integer cantidad,
        Integer stockDisponible,
        BigDecimal subtotal
) {
}
