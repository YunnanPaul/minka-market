package com.minkamarket.ecommerce.repository;

import com.minkamarket.ecommerce.entity.Producto;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    /**
     * Consulta estable para la base de datos relacional. Los filtros opcionales
     * se aplican en la capa Service para evitar parámetros JDBC nulos y mantener
     * un comportamiento consistente con PostgreSQL.
     */
    @EntityGraph(attributePaths = "categoria")
    List<Producto> findByActivoTrueOrderByDestacadoDescNombreAsc();

    @EntityGraph(attributePaths = "categoria")
    Optional<Producto> findByIdAndActivoTrue(Long id);

    @EntityGraph(attributePaths = "categoria")
    List<Producto> findAllByOrderByCreadoEnDesc();


    boolean existsBySkuIgnoreCase(String sku);

    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);

    long countByActivoTrue();

    long countByActivoTrueAndStockLessThanEqual(Integer stock);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Producto p where p.id = :id")
    Optional<Producto> findByIdForUpdate(@Param("id") Long id);
}
