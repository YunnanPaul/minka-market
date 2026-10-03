package com.minkamarket.ecommerce.dto;

import java.math.BigDecimal;

public record ProductoResponse(
        Long id,
        String sku,
        String nombre,
        String marca,
        String unidadMedida,
        String descripcion,
        BigDecimal precio,
        BigDecimal precioAnterior,
        Integer stock,
        String imagenUrl,
        boolean destacado,
        boolean activo,
        Long categoriaId,
        String categoria,
        String categoriaSlug
) {
}
