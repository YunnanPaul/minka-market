package com.minkamarket.ecommerce.entity;

import com.minkamarket.ecommerce.enums.EstadoPago;
import com.minkamarket.ecommerce.enums.MetodoPago;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "pagos", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pago_pedido", columnNames = "pedido_id"),
        @UniqueConstraint(name = "uk_pago_referencia", columnNames = "referencia")
})
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id", nullable = false)
    private Pedido pedido;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MetodoPago metodo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoPago estado;

    @Column(nullable = false, length = 50)
    private String referencia;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false)
    private Instant fecha;

    protected Pago() {
    }

    public Pago(MetodoPago metodo,
                EstadoPago estado,
                String referencia,
                BigDecimal monto,
                Instant fecha) {
        this.metodo = metodo;
        this.estado = estado;
        this.referencia = referencia;
        this.monto = monto;
        this.fecha = fecha;
    }

    void setPedido(Pedido pedido) {
        this.pedido = pedido;
    }

    public Long getId() {
        return id;
    }

    public Pedido getPedido() {
        return pedido;
    }

    public MetodoPago getMetodo() {
        return metodo;
    }

    public EstadoPago getEstado() {
        return estado;
    }

    public void setEstado(EstadoPago estado) {
        this.estado = estado;
    }

    public String getReferencia() {
        return referencia;
    }

    public BigDecimal getMonto() {
        return monto;
    }

    public Instant getFecha() {
        return fecha;
    }
}
