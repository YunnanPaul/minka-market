package com.minkamarket.ecommerce.dto;

import com.minkamarket.ecommerce.enums.EstadoPedido;
import com.minkamarket.ecommerce.enums.MetodoPago;
import com.minkamarket.ecommerce.enums.TipoEntrega;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PedidoResponse(
        Long id,
        String codigo,
        Instant fecha,
        EstadoPedido estado,
        BigDecimal subtotal,
        BigDecimal igv,
        BigDecimal costoEnvio,
        BigDecimal total,
        TipoEntrega tipoEntrega,
        MetodoPago metodoPago,
        String direccionEntrega,
        String observacion,
        Long clienteId,
        String clienteNombre,
        String clienteEmail,
        List<DetallePedidoResponse> detalles,
        PagoResponse pago
) {
}
