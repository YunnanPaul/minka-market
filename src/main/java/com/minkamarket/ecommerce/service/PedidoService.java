package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.CrearPedidoRequest;
import com.minkamarket.ecommerce.dto.DetallePedidoResponse;
import com.minkamarket.ecommerce.dto.PagoResponse;
import com.minkamarket.ecommerce.dto.PedidoResponse;
import com.minkamarket.ecommerce.entity.DetallePedido;
import com.minkamarket.ecommerce.entity.Pago;
import com.minkamarket.ecommerce.entity.Pedido;
import com.minkamarket.ecommerce.entity.Producto;
import com.minkamarket.ecommerce.entity.Usuario;
import com.minkamarket.ecommerce.enums.EstadoPago;
import com.minkamarket.ecommerce.enums.EstadoPedido;
import com.minkamarket.ecommerce.enums.MetodoPago;
import com.minkamarket.ecommerce.enums.TipoEntrega;
import com.minkamarket.ecommerce.exception.ApiException;
import com.minkamarket.ecommerce.repository.PedidoRepository;
import com.minkamarket.ecommerce.repository.ProductoRepository;
import com.minkamarket.ecommerce.repository.UsuarioRepository;
import com.minkamarket.ecommerce.session.ItemCarritoSesion;
import com.minkamarket.ecommerce.session.UsuarioSesion;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class PedidoService {

    private static final DateTimeFormatter CODE_DATE = DateTimeFormatter.ofPattern("yyyyMMdd")
            .withZone(ZoneId.of("America/Lima"));

    private final PedidoRepository pedidoRepository;
    private final ProductoRepository productoRepository;
    private final UsuarioRepository usuarioRepository;
    private final CarritoService carritoService;
    private final ProductoImagenService productoImagenService;
    private final BigDecimal igvRate;
    private final BigDecimal deliveryFee;
    private final BigDecimal freeDeliveryFrom;
    private final String storeName;
    private final String storeAddress;

    public PedidoService(PedidoRepository pedidoRepository,
                         ProductoRepository productoRepository,
                         UsuarioRepository usuarioRepository,
                         CarritoService carritoService,
                         ProductoImagenService productoImagenService,
                         @Value("${app.igv-rate}") BigDecimal igvRate,
                         @Value("${app.delivery-fee}") BigDecimal deliveryFee,
                         @Value("${app.free-delivery-from}") BigDecimal freeDeliveryFrom,
                         @Value("${app.store.name}") String storeName,
                         @Value("${app.store.address}") String storeAddress) {
        this.pedidoRepository = pedidoRepository;
        this.productoRepository = productoRepository;
        this.usuarioRepository = usuarioRepository;
        this.carritoService = carritoService;
        this.productoImagenService = productoImagenService;
        this.igvRate = igvRate;
        this.deliveryFee = deliveryFee;
        this.freeDeliveryFrom = freeDeliveryFrom;
        this.storeName = storeName;
        this.storeAddress = storeAddress;
    }

    @Transactional
    public PedidoResponse crearPedido(UsuarioSesion usuarioSesion,
                                      CrearPedidoRequest request,
                                      HttpSession session) {
        List<ItemCarritoSesion> items = carritoService.itemsParaPedido(session);
        if (items.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "El carrito está vacío.");
        }
        items.sort(Comparator.comparing(ItemCarritoSesion::getProductoId));

        Usuario usuario = usuarioRepository.findById(usuarioSesion.id())
                .filter(Usuario::isActivo)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "La cuenta ya no está disponible."));

        String direccion = resolverDireccion(request, usuario);
        BigDecimal subtotal = BigDecimal.ZERO;
        Pedido pedido = new Pedido(
                generarCodigo(),
                usuario,
                Instant.now(),
                EstadoPedido.PENDIENTE,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                request.tipoEntrega(),
                request.metodoPago(),
                direccion,
                limpiarTexto(request.observacion())
        );

        for (ItemCarritoSesion item : items) {
            Producto producto = productoRepository.findByIdForUpdate(item.getProductoId())
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                            "Uno de los productos del carrito ya no existe."));
            if (!producto.isActivo()) {
                throw new ApiException(HttpStatus.CONFLICT,
                        producto.getNombre() + " ya no está disponible.");
            }
            if (producto.getStock() < item.getCantidad()) {
                throw new ApiException(HttpStatus.CONFLICT,
                        "Stock insuficiente para " + producto.getNombre() + ". Disponible: " + producto.getStock() + ".");
            }

            BigDecimal precio = money(producto.getPrecio());
            BigDecimal subtotalLinea = money(precio.multiply(BigDecimal.valueOf(item.getCantidad())));
            subtotal = subtotal.add(subtotalLinea);
            producto.setStock(producto.getStock() - item.getCantidad());

            pedido.agregarDetalle(new DetallePedido(
                    producto,
                    producto.getSku(),
                    producto.getNombre(),
                    productoImagenService.normalizarParaRespuesta(producto.getImagenUrl()),
                    item.getCantidad(),
                    precio,
                    subtotalLinea
            ));
        }

        subtotal = money(subtotal);
        BigDecimal igv = money(subtotal.multiply(igvRate));
        BigDecimal costoEnvio = calcularEnvio(request.tipoEntrega(), subtotal);
        BigDecimal total = money(subtotal.add(igv).add(costoEnvio));

        pedido.actualizarTotales(subtotal, igv, costoEnvio, total);
        EstadoPago estadoPago = request.metodoPago() == MetodoPago.EFECTIVO
                ? EstadoPago.PENDIENTE
                : EstadoPago.APROBADO;
        if (estadoPago == EstadoPago.APROBADO) {
            pedido.setEstado(EstadoPedido.PAGADO);
        }

        Pago pago = new Pago(
                request.metodoPago(),
                estadoPago,
                generarReferenciaPago(),
                total,
                Instant.now()
        );
        pedido.asignarPago(pago);

        Pedido guardado = pedidoRepository.save(pedido);
        limpiarCarritoDespuesDelCommit(session);
        return toResponse(guardado);
    }

    @Transactional(readOnly = true)
    public List<PedidoResponse> listarDelUsuario(Long usuarioId) {
        return pedidoRepository.findByUsuarioIdOrderByFechaDesc(usuarioId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PedidoResponse obtenerDelUsuario(Long pedidoId, Long usuarioId) {
        Pedido pedido = buscarPedido(pedidoId);
        if (!pedido.getUsuario().getId().equals(usuarioId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "El pedido no pertenece al usuario autenticado.");
        }
        return toResponse(pedido);
    }

    @Transactional(readOnly = true)
    public List<PedidoResponse> listarTodos() {
        return pedidoRepository.findAllByOrderByFechaDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PedidoResponse actualizarEstado(Long pedidoId, EstadoPedido nuevoEstado) {
        Pedido pedido = buscarPedido(pedidoId);
        EstadoPedido estadoAnterior = pedido.getEstado();
        if (estadoAnterior == nuevoEstado) {
            return toResponse(pedido);
        }

        if (nuevoEstado == EstadoPedido.CANCELADO && estadoAnterior != EstadoPedido.CANCELADO) {
            reponerInventario(pedido);
            if (pedido.getPago() != null && pedido.getPago().getEstado() == EstadoPago.APROBADO) {
                pedido.getPago().setEstado(EstadoPago.REEMBOLSADO);
            }
        } else if (estadoAnterior == EstadoPedido.CANCELADO && nuevoEstado != EstadoPedido.CANCELADO) {
            reservarInventario(pedido);
            if (pedido.getPago() != null && pedido.getMetodoPago() != MetodoPago.EFECTIVO) {
                pedido.getPago().setEstado(EstadoPago.APROBADO);
            }
        }

        if (nuevoEstado == EstadoPedido.PAGADO && pedido.getPago() != null) {
            pedido.getPago().setEstado(EstadoPago.APROBADO);
        }
        pedido.setEstado(nuevoEstado);
        return toResponse(pedido);
    }

    public PedidoResponse toResponse(Pedido pedido) {
        List<DetallePedidoResponse> detalles = pedido.getDetalles().stream()
                .map(d -> new DetallePedidoResponse(
                        d.getProducto().getId(),
                        d.getSkuProducto(),
                        d.getNombreProducto(),
                        productoImagenService.normalizarParaRespuesta(d.getImagenUrl()),
                        d.getCantidad(),
                        d.getPrecioUnitario(),
                        d.getSubtotal()
                ))
                .toList();

        PagoResponse pago = pedido.getPago() == null ? null : new PagoResponse(
                pedido.getPago().getMetodo(),
                pedido.getPago().getEstado(),
                pedido.getPago().getReferencia(),
                pedido.getPago().getMonto(),
                pedido.getPago().getFecha()
        );

        return new PedidoResponse(
                pedido.getId(),
                pedido.getCodigo(),
                pedido.getFecha(),
                pedido.getEstado(),
                pedido.getSubtotal(),
                pedido.getIgv(),
                pedido.getCostoEnvio(),
                pedido.getTotal(),
                pedido.getTipoEntrega(),
                pedido.getMetodoPago(),
                pedido.getDireccionEntrega(),
                pedido.getObservacion(),
                pedido.getUsuario().getId(),
                pedido.getUsuario().getNombreCompleto(),
                pedido.getUsuario().getEmail(),
                detalles,
                pago
        );
    }

    private Pedido buscarPedido(Long pedidoId) {
        return pedidoRepository.findOneById(pedidoId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Pedido no encontrado."));
    }

    private void reponerInventario(Pedido pedido) {
        List<DetallePedido> detalles = pedido.getDetalles().stream()
                .sorted(Comparator.comparing(detalle -> detalle.getProducto().getId()))
                .toList();
        for (DetallePedido detalle : detalles) {
            Producto producto = productoRepository.findByIdForUpdate(detalle.getProducto().getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                            "No se pudo restaurar el inventario del pedido."));
            producto.setStock(producto.getStock() + detalle.getCantidad());
        }
    }

    private void reservarInventario(Pedido pedido) {
        List<DetallePedido> detalles = pedido.getDetalles().stream()
                .sorted(Comparator.comparing(detalle -> detalle.getProducto().getId()))
                .toList();
        for (DetallePedido detalle : detalles) {
            Producto producto = productoRepository.findByIdForUpdate(detalle.getProducto().getId())
                    .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                            "No se pudo volver a reservar el inventario del pedido."));
            if (!producto.isActivo() || producto.getStock() < detalle.getCantidad()) {
                throw new ApiException(HttpStatus.CONFLICT,
                        "No existe stock suficiente para reactivar el pedido.");
            }
            producto.setStock(producto.getStock() - detalle.getCantidad());
        }
    }

    private String resolverDireccion(CrearPedidoRequest request, Usuario usuario) {
        if (request.tipoEntrega() == TipoEntrega.RECOJO_TIENDA) {
            return "Recojo en " + storeName + " - " + storeAddress;
        }
        String direccion = limpiarTexto(request.direccionEntrega());
        if (direccion == null || direccion.isBlank()) {
            direccion = usuario.getDireccion();
        }
        if (direccion == null || direccion.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ingrese una dirección para el delivery.");
        }
        return direccion;
    }

    private BigDecimal calcularEnvio(TipoEntrega tipoEntrega, BigDecimal subtotal) {
        if (tipoEntrega == TipoEntrega.RECOJO_TIENDA || subtotal.compareTo(freeDeliveryFrom) >= 0) {
            return money(BigDecimal.ZERO);
        }
        return money(deliveryFee);
    }

    private String generarCodigo() {
        return "MM-" + CODE_DATE.format(Instant.now()) + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase(Locale.ROOT);
    }

    private String generarReferenciaPago() {
        return "PAY-" + UUID.randomUUID().toString().replace("-", "")
                .substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private String limpiarTexto(String value) {
        return value == null ? null : value.strip();
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private void limpiarCarritoDespuesDelCommit(HttpSession session) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            carritoService.limpiarDespuesDeCompra(session);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                carritoService.limpiarDespuesDeCompra(session);
            }
        });
    }
}
