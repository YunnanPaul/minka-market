package com.minkamarket.ecommerce.dto;

import java.math.BigDecimal;
import java.util.List;

public record CarritoResponse(
        List<ItemCarritoResponse> items,
        Integer cantidadTotal,
        BigDecimal subtotal,
        BigDecimal igv,
        BigDecimal total
) {
}
