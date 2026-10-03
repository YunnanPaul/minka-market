package com.minkamarket.ecommerce.repository;

import com.minkamarket.ecommerce.entity.Pedido;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface PedidoRepository extends JpaRepository<Pedido, Long> {

    @EntityGraph(attributePaths = {"usuario", "detalles", "detalles.producto", "pago"})
    List<Pedido> findByUsuarioIdOrderByFechaDesc(Long usuarioId);

    @EntityGraph(attributePaths = {"usuario", "detalles", "detalles.producto", "pago"})
    Optional<Pedido> findOneById(Long id);

    @EntityGraph(attributePaths = {"usuario", "detalles", "detalles.producto", "pago"})
    List<Pedido> findAllByOrderByFechaDesc();

    @Query(value = "select coalesce(sum(total), 0) from pedidos where estado <> 'CANCELADO'", nativeQuery = true)
    BigDecimal sumarVentasNoCanceladas();
}
