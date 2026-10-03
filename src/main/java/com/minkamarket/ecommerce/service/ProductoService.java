package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.ProductoRequest;
import com.minkamarket.ecommerce.dto.ProductoResponse;
import com.minkamarket.ecommerce.entity.Categoria;
import com.minkamarket.ecommerce.entity.Producto;
import com.minkamarket.ecommerce.exception.ApiException;
import com.minkamarket.ecommerce.repository.CategoriaRepository;
import com.minkamarket.ecommerce.repository.ProductoRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;

@Service
public class ProductoService {

    private static final BigDecimal CERO = new BigDecimal("0.00");

    private final ProductoRepository productoRepository;
    private final CategoriaRepository categoriaRepository;
    private final ProductoImagenService productoImagenService;

    public ProductoService(ProductoRepository productoRepository,
                           CategoriaRepository categoriaRepository,
                           ProductoImagenService productoImagenService) {
        this.productoRepository = productoRepository;
        this.categoriaRepository = categoriaRepository;
        this.productoImagenService = productoImagenService;
    }

    /**
     * Carga el catálogo con una consulta sin parámetros opcionales y aplica los
     * filtros en la capa Service. Esta estrategia es intencional: elimina el
     * problema de tipado JDBC/Hibernate con parámetros nulos de la consulta
     * anterior y resulta suficiente para un catálogo académico pequeño.
     */
    @Transactional(readOnly = true)
    public List<ProductoResponse> buscarCatalogo(String q, String categoria) {
        String query = normalizarFiltro(q);
        String category = normalizarFiltro(categoria);

        return productoRepository.findByActivoTrueOrderByDestacadoDescNombreAsc().stream()
                .filter(producto -> coincideCategoria(producto, category))
                .filter(producto -> coincideBusqueda(producto, query))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductoResponse obtenerPublico(Long id) {
        return toResponse(obtenerEntidadActiva(id));
    }

    @Transactional(readOnly = true)
    public List<ProductoResponse> listarAdministracion() {
        return productoRepository.findAllByOrderByCreadoEnDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public ProductoResponse crear(ProductoRequest request) {
        String sku = normalizarSku(request.sku());
        if (productoRepository.existsBySkuIgnoreCase(sku)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ya existe un producto con el SKU indicado.");
        }

        Categoria categoria = buscarCategoria(request.categoriaId());
        Producto producto = new Producto(
                sku,
                request.nombre().strip(),
                request.marca().strip(),
                request.unidadMedida().strip(),
                request.descripcion().strip(),
                escala(request.precio()),
                precioAnteriorValido(request.precioAnterior(), request.precio()),
                request.stock(),
                productoImagenService.normalizarParaGuardar(request.imagenUrl()),
                Boolean.TRUE.equals(request.destacado()),
                request.activo() == null || request.activo(),
                categoria
        );
        return toResponse(productoRepository.saveAndFlush(producto));
    }

    @Transactional
    public ProductoResponse actualizar(Long id, ProductoRequest request) {
        Producto producto = obtenerEntidadAdmin(id);
        String sku = normalizarSku(request.sku());
        if (productoRepository.existsBySkuIgnoreCaseAndIdNot(sku, id)) {
            throw new ApiException(HttpStatus.CONFLICT, "Ya existe otro producto con el SKU indicado.");
        }

        producto.setSku(sku);
        producto.setNombre(request.nombre().strip());
        producto.setMarca(request.marca().strip());
        producto.setUnidadMedida(request.unidadMedida().strip());
        producto.setDescripcion(request.descripcion().strip());
        producto.setPrecio(escala(request.precio()));
        producto.setPrecioAnterior(precioAnteriorValido(request.precioAnterior(), request.precio()));
        producto.setStock(request.stock());
        producto.setImagenUrl(productoImagenService.normalizarParaGuardar(request.imagenUrl()));
        producto.setDestacado(Boolean.TRUE.equals(request.destacado()));
        producto.setActivo(request.activo() == null || request.activo());
        producto.setCategoria(buscarCategoria(request.categoriaId()));

        return toResponse(productoRepository.saveAndFlush(producto));
    }

    @Transactional
    public void desactivar(Long id) {
        Producto producto = obtenerEntidadAdmin(id);
        producto.setActivo(false);
    }

    @Transactional(readOnly = true)
    public Producto obtenerEntidadActiva(Long id) {
        return productoRepository.findByIdAndActivoTrue(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Producto no encontrado o inactivo."));
    }

    @Transactional(readOnly = true)
    public Producto obtenerEntidadAdmin(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Producto no encontrado."));
    }

    /**
     * Construcción defensiva: un registro antiguo con imagen vacía o categoría
     * incompleta ya no provoca un HTTP 500 para todo el catálogo.
     */
    public ProductoResponse toResponse(Producto producto) {
        Categoria categoria = producto.getCategoria();
        Long categoriaId = categoria == null ? null : categoria.getId();
        String categoriaNombre = categoria == null ? "General" : textoSeguro(categoria.getNombre(), "General");
        String categoriaSlug = categoria == null ? "general" : textoSeguro(categoria.getSlug(), "general");

        return new ProductoResponse(
                producto.getId(),
                textoSeguro(producto.getSku(), "SIN-SKU"),
                textoSeguro(producto.getNombre(), "Producto sin nombre"),
                textoSeguro(producto.getMarca(), "Minka Market"),
                textoSeguro(producto.getUnidadMedida(), "unidad"),
                textoSeguro(producto.getDescripcion(), "Producto disponible en Minka Market."),
                dineroSeguro(producto.getPrecio()),
                producto.getPrecioAnterior() == null ? null : dineroSeguro(producto.getPrecioAnterior()),
                producto.getStock() == null ? 0 : Math.max(0, producto.getStock()),
                productoImagenService.normalizarParaRespuesta(producto.getImagenUrl()),
                producto.isDestacado(),
                producto.isActivo(),
                categoriaId,
                categoriaNombre,
                categoriaSlug
        );
    }

    private boolean coincideCategoria(Producto producto, String categoriaFiltro) {
        if (categoriaFiltro == null) {
            return true;
        }
        Categoria categoria = producto.getCategoria();
        return categoria != null
                && categoria.getSlug() != null
                && categoriaFiltro.equals(categoria.getSlug().strip().toLowerCase(Locale.ROOT));
    }

    private boolean coincideBusqueda(Producto producto, String query) {
        if (query == null) {
            return true;
        }
        return contiene(producto.getNombre(), query)
                || contiene(producto.getMarca(), query)
                || contiene(producto.getDescripcion(), query)
                || contiene(producto.getSku(), query);
    }

    private boolean contiene(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private Categoria buscarCategoria(Long id) {
        return categoriaRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "La categoría seleccionada no existe."));
    }

    private String normalizarFiltro(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.strip().toLowerCase(Locale.ROOT);
    }

    private String normalizarSku(String sku) {
        return sku.strip().toUpperCase(Locale.ROOT);
    }

    private String textoSeguro(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }

    private BigDecimal precioAnteriorValido(BigDecimal anterior, BigDecimal actual) {
        if (anterior == null || anterior.compareTo(actual) <= 0) {
            return null;
        }
        return escala(anterior);
    }

    private BigDecimal dineroSeguro(BigDecimal value) {
        return value == null ? CERO : escala(value.max(BigDecimal.ZERO));
    }

    private BigDecimal escala(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
