package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.CarritoResponse;
import com.minkamarket.ecommerce.dto.ItemCarritoResponse;
import com.minkamarket.ecommerce.entity.Producto;
import com.minkamarket.ecommerce.exception.ApiException;
import com.minkamarket.ecommerce.session.CarritoSesion;
import com.minkamarket.ecommerce.session.ItemCarritoSesion;
import jakarta.servlet.http.HttpSession;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CarritoService {

    private final ProductoService productoService;
    private final ProductoImagenService productoImagenService;
    private final BigDecimal igvRate;

    public CarritoService(
            ProductoService productoService,
            ProductoImagenService productoImagenService,
            @Value("${app.igv-rate}") BigDecimal igvRate) {
        this.productoService = productoService;
        this.productoImagenService = productoImagenService;
        this.igvRate = igvRate;
    }

    @Transactional(readOnly = true)
    public CarritoResponse obtener(HttpSession session) {
        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            sincronizar(carrito);
            return toResponse(carrito);
        }
    }

    @Transactional(readOnly = true)
    public CarritoResponse agregar(Long productoId, Integer cantidad, HttpSession session) {
        Producto producto = productoService.obtenerEntidadActiva(productoId);
        validarStock(producto, cantidad);

        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            sincronizar(carrito);
            ItemCarritoSesion actual = carrito.obtener(productoId);
            int nuevaCantidad = cantidad + (actual == null ? 0 : actual.getCantidad());
            validarStock(producto, nuevaCantidad);

            if (actual == null) {
                actual = new ItemCarritoSesion(
                        producto.getId(),
                        producto.getSku(),
                        producto.getNombre(),
                        productoImagenService.normalizarParaRespuesta(producto.getImagenUrl()),
                        producto.getPrecio(),
                        nuevaCantidad,
                        producto.getStock()
                );
            } else {
                copiarDatosProducto(producto, actual);
                actual.setCantidad(nuevaCantidad);
            }
            carrito.guardar(actual);
            return toResponse(carrito);
        }
    }

    @Transactional(readOnly = true)
    public CarritoResponse actualizarCantidad(Long productoId, Integer cantidad, HttpSession session) {
        Producto producto = productoService.obtenerEntidadActiva(productoId);
        validarStock(producto, cantidad);

        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            sincronizar(carrito);
            ItemCarritoSesion item = carrito.obtener(productoId);
            if (item == null) {
                throw new ApiException(HttpStatus.NOT_FOUND, "El producto no está en el carrito.");
            }
            copiarDatosProducto(producto, item);
            item.setCantidad(cantidad);
            return toResponse(carrito);
        }
    }

    public CarritoResponse eliminar(Long productoId, HttpSession session) {
        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            carrito.eliminar(productoId);
            return toResponse(carrito);
        }
    }

    public CarritoResponse vaciar(HttpSession session) {
        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            carrito.vaciar();
            return toResponse(carrito);
        }
    }

    @Transactional(readOnly = true)
    public List<ItemCarritoSesion> itemsParaPedido(HttpSession session) {
        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            sincronizar(carrito);
            List<ItemCarritoSesion> copia = new ArrayList<>();
            for (ItemCarritoSesion item : carrito.listar()) {
                copia.add(new ItemCarritoSesion(item));
            }
            return copia;
        }
    }

    public void limpiarDespuesDeCompra(HttpSession session) {
        CarritoSesion carrito = obtenerOCrear(session);
        synchronized (carrito) {
            carrito.vaciar();
        }
    }

    private CarritoSesion obtenerOCrear(HttpSession session) {
        synchronized (session) {
            Object value = session.getAttribute(CarritoSesion.SESSION_ATTRIBUTE);
            if (value instanceof CarritoSesion carrito) {
                return carrito;
            }
            CarritoSesion carrito = new CarritoSesion();
            session.setAttribute(CarritoSesion.SESSION_ATTRIBUTE, carrito);
            return carrito;
        }
    }

    private void sincronizar(CarritoSesion carrito) {
        for (ItemCarritoSesion item : carrito.listar()) {
            try {
                Producto producto = productoService.obtenerEntidadActiva(item.getProductoId());
                if (producto.getStock() <= 0) {
                    carrito.eliminar(item.getProductoId());
                    continue;
                }
                copiarDatosProducto(producto, item);
                if (item.getCantidad() > producto.getStock()) {
                    item.setCantidad(producto.getStock());
                }
            } catch (ApiException ex) {
                carrito.eliminar(item.getProductoId());
            }
        }
    }

    private void copiarDatosProducto(Producto producto, ItemCarritoSesion item) {
        item.setSku(producto.getSku());
        item.setNombre(producto.getNombre());
        item.setImagenUrl(productoImagenService.normalizarParaRespuesta(producto.getImagenUrl()));
        item.setPrecioUnitario(producto.getPrecio());
        item.setStockDisponible(producto.getStock());
    }

    private void validarStock(Producto producto, int cantidad) {
        if (cantidad < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La cantidad debe ser mayor que cero.");
        }
        if (producto.getStock() < cantidad) {
            throw new ApiException(HttpStatus.CONFLICT,
                    "Solo quedan " + producto.getStock() + " unidades de " + producto.getNombre() + ".");
        }
    }

    private CarritoResponse toResponse(CarritoSesion carrito) {
        List<ItemCarritoResponse> items = carrito.listar().stream()
                .map(item -> new ItemCarritoResponse(
                        item.getProductoId(),
                        item.getSku(),
                        item.getNombre(),
                        productoImagenService.normalizarParaRespuesta(item.getImagenUrl()),
                        money(item.getPrecioUnitario()),
                        item.getCantidad(),
                        item.getStockDisponible(),
                        money(item.getPrecioUnitario().multiply(BigDecimal.valueOf(item.getCantidad())))
                ))
                .toList();

        BigDecimal subtotal = items.stream()
                .map(ItemCarritoResponse::subtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal igv = subtotal.multiply(igvRate);
        BigDecimal total = subtotal.add(igv);
        int cantidadTotal = items.stream().mapToInt(ItemCarritoResponse::cantidad).sum();

        return new CarritoResponse(
                items,
                cantidadTotal,
                money(subtotal),
                money(igv),
                money(total)
        );
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
