package com.minkamarket.ecommerce.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegistroRequest(
        @NotBlank @Size(max = 140) String nombreCompleto,
        @NotBlank @Email @Size(max = 180) String email,
        @NotBlank @Size(min = 8, max = 72) String password,
        @NotBlank @Pattern(regexp = "[0-9+()\\- ]{7,30}", message = "El teléfono no tiene un formato válido") String telefono,
        @NotBlank @Size(max = 300) String direccion
) {
}
