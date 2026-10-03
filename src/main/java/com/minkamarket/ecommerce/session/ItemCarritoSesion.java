package com.minkamarket.ecommerce.session;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

public class ItemCarritoSesion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    private Long productoId;
    private String sku;
    private String nombre;
    private String imagenUrl;
    private BigDecimal precioUnitario;
    private Integer cantidad;
    private Integer stockDisponible;

    public ItemCarritoSesion(Long productoId,
                             String sku,
                             String nombre,
                             String imagenUrl,
                             BigDecimal precioUnitario,
                             Integer cantidad,
                             Integer stockDisponible) {
        this.productoId = productoId;
        this.sku = sku;
        this.nombre = nombre;
        this.imagenUrl = imagenUrl;
        this.precioUnitario = precioUnitario;
        this.cantidad = cantidad;
        this.stockDisponible = stockDisponible;
    }

    public ItemCarritoSesion(ItemCarritoSesion original) {
        this(original.productoId,
                original.sku,
                original.nombre,
                original.imagenUrl,
                original.precioUnitario,
                original.cantidad,
                original.stockDisponible);
    }

    public Long getProductoId() {
        return productoId;
    }

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public void setImagenUrl(String imagenUrl) {
        this.imagenUrl = imagenUrl;
    }

    public BigDecimal getPrecioUnitario() {
        return precioUnitario;
    }

    public void setPrecioUnitario(BigDecimal precioUnitario) {
        this.precioUnitario = precioUnitario;
    }

    public Integer getCantidad() {
        return cantidad;
    }

    public void setCantidad(Integer cantidad) {
        this.cantidad = cantidad;
    }

    public Integer getStockDisponible() {
        return stockDisponible;
    }

    public void setStockDisponible(Integer stockDisponible) {
        this.stockDisponible = stockDisponible;
    }
}
