package com.minkamarket.ecommerce.entity;

import com.minkamarket.ecommerce.enums.EstadoPedido;
import com.minkamarket.ecommerce.enums.MetodoPago;
import com.minkamarket.ecommerce.enums.TipoEntrega;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Entity
@Table(name = "pedidos", uniqueConstraints = {
        @UniqueConstraint(name = "uk_pedido_codigo", columnNames = "codigo")
})
public class Pedido {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 30)
    private String codigo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private EstadoPedido estado;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal igv;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal costoEnvio;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TipoEntrega tipoEntrega;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MetodoPago metodoPago;

    @Column(length = 350)
    private String direccionEntrega;

    @Column(length = 500)
    private String observacion;

    @OneToMany(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DetallePedido> detalles = new ArrayList<>();

    @OneToOne(mappedBy = "pedido", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Pago pago;

    @Version
    private Long version;

    protected Pedido() {
    }

    public Pedido(String codigo,
                  Usuario usuario,
                  Instant fecha,
                  EstadoPedido estado,
                  BigDecimal subtotal,
                  BigDecimal igv,
                  BigDecimal costoEnvio,
                  BigDecimal total,
                  TipoEntrega tipoEntrega,
                  MetodoPago metodoPago,
                  String direccionEntrega,
                  String observacion) {
        this.codigo = codigo;
        this.usuario = usuario;
        this.fecha = fecha;
        this.estado = estado;
        this.subtotal = subtotal;
        this.igv = igv;
        this.costoEnvio = costoEnvio;
        this.total = total;
        this.tipoEntrega = tipoEntrega;
        this.metodoPago = metodoPago;
        this.direccionEntrega = direccionEntrega;
        this.observacion = observacion;
    }

    public void agregarDetalle(DetallePedido detalle) {
        detalles.add(detalle);
        detalle.setPedido(this);
    }

    public void asignarPago(Pago pago) {
        this.pago = pago;
        pago.setPedido(this);
    }

    public void actualizarTotales(BigDecimal subtotal,
                                  BigDecimal igv,
                                  BigDecimal costoEnvio,
                                  BigDecimal total) {
        this.subtotal = subtotal;
        this.igv = igv;
        this.costoEnvio = costoEnvio;
        this.total = total;
    }

    public Long getId() {
        return id;
    }

    public String getCodigo() {
        return codigo;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Instant getFecha() {
        return fecha;
    }

    public EstadoPedido getEstado() {
        return estado;
    }

    public void setEstado(EstadoPedido estado) {
        this.estado = estado;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getIgv() {
        return igv;
    }

    public BigDecimal getCostoEnvio() {
        return costoEnvio;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public TipoEntrega getTipoEntrega() {
        return tipoEntrega;
    }

    public MetodoPago getMetodoPago() {
        return metodoPago;
    }

    public String getDireccionEntrega() {
        return direccionEntrega;
    }

    public String getObservacion() {
        return observacion;
    }

    public List<DetallePedido> getDetalles() {
        return Collections.unmodifiableList(detalles);
    }

    public Pago getPago() {
        return pago;
    }

    public Long getVersion() {
        return version;
    }
}
