package com.minkamarket.ecommerce.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProductoRequest(
        @NotBlank(message = "Ingrese el SKU.")
        @Size(max = 40, message = "El SKU no puede superar 40 caracteres.")
        String sku,

        @NotBlank(message = "Ingrese el nombre del producto.")
        @Size(max = 160, message = "El nombre no puede superar 160 caracteres.")
        String nombre,

        @NotBlank(message = "Ingrese la marca.")
        @Size(max = 100, message = "La marca no puede superar 100 caracteres.")
        String marca,

        @NotBlank(message = "Ingrese la presentación o unidad de medida.")
        @Size(max = 40, message = "La presentación no puede superar 40 caracteres.")
        String unidadMedida,

        @NotBlank(message = "Ingrese la descripción del producto.")
        @Size(max = 1000, message = "La descripción no puede superar 1000 caracteres.")
        String descripcion,

        @NotNull(message = "Ingrese el precio actual.")
        @DecimalMin(value = "0.01", message = "El precio debe ser mayor que cero.")
        @Digits(integer = 10, fraction = 2, message = "El precio admite hasta 10 enteros y 2 decimales.")
        BigDecimal precio,

        @DecimalMin(value = "0.01", message = "El precio anterior debe ser mayor que cero.")
        @Digits(integer = 10, fraction = 2, message = "El precio anterior admite hasta 10 enteros y 2 decimales.")
        BigDecimal precioAnterior,

        @NotNull(message = "Ingrese el stock.")
        @Min(value = 0, message = "El stock no puede ser negativo.")
        Integer stock,

        @Size(max = 500, message = "La ruta de imagen no puede superar 500 caracteres.")
        String imagenUrl,

        Boolean destacado,
        Boolean activo,

        @NotNull(message = "Seleccione una categoría.")
        @Positive(message = "Seleccione una categoría válida.")
        Long categoriaId
) {
}
