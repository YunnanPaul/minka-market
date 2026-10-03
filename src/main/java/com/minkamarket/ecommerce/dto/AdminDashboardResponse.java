package com.minkamarket.ecommerce.dto;

import java.math.BigDecimal;

public record AdminDashboardResponse(
        long productosActivos,
        long productosBajoStock,
        long pedidosRegistrados,
        long clientesRegistrados,
        BigDecimal ventasAcumuladas
) {
}
