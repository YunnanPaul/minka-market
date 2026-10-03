package com.minkamarket.ecommerce.dto;

import java.math.BigDecimal;

public record DetallePedidoResponse(
        Long productoId,
        String sku,
        String nombre,
        String imagenUrl,
        Integer cantidad,
        BigDecimal precioUnitario,
        BigDecimal subtotal
) {
}
