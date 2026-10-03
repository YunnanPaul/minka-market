package com.minkamarket.ecommerce.dto;

public record CategoriaResponse(
        Long id,
        String nombre,
        String slug,
        String descripcion,
        String icono
) {
}
