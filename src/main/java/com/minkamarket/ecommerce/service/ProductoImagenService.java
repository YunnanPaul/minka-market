package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.exception.ApiException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ProductoImagenService {

    private static final Logger log = LoggerFactory.getLogger(ProductoImagenService.class);

    public static final String IMAGEN_PREDETERMINADA = "/images/product-placeholder.svg";

    private final ResourceLoader resourceLoader;
    private final Path uploadPath;

    public ProductoImagenService(
            ResourceLoader resourceLoader,
            @Value("${app.upload-dir}") String uploadDir) {
        this.resourceLoader = resourceLoader;
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public String normalizarParaGuardar(String imagenUrl) {
        String value = normalizarSintaxis(imagenUrl);
        if (esUrlExterna(value)) {
            return value;
        }
        if (existeImagenLocal(value)) {
            return value;
        }

        log.warn("La imagen local '{}' no existe; se utilizará el respaldo del sistema.", value);
        return IMAGEN_PREDETERMINADA;
    }

    public String normalizarParaRespuesta(String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) {
            return IMAGEN_PREDETERMINADA;
        }

        try {
            String value = normalizarSintaxis(imagenUrl);
            if (esUrlExterna(value) || existeImagenLocal(value)) {
                return value;
            }
        } catch (RuntimeException ignored) {
            // Una ruta antigua o inválida no debe impedir mostrar el catálogo.
        }
        return IMAGEN_PREDETERMINADA;
    }

    public boolean existeImagenLocal(String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) {
            return false;
        }

        String clean = quitarQueryYFragmento(imagenUrl.strip().replace('\\', '/'));
        if (clean.startsWith("/images/")) {
            Resource resource = resourceLoader.getResource("classpath:/static" + clean);
            return resource.exists() && resource.isReadable();
        }

        if (clean.startsWith("/uploads/")) {
            String relative = clean.substring("/uploads/".length());
            Path candidate = uploadPath.resolve(relative).normalize();
            return candidate.startsWith(uploadPath)
                    && Files.isRegularFile(candidate)
                    && Files.isReadable(candidate);
        }
        return false;
    }

    private String normalizarSintaxis(String imagenUrl) {
        if (imagenUrl == null || imagenUrl.isBlank()) {
            return IMAGEN_PREDETERMINADA;
        }

        String value = imagenUrl.strip().replace('\\', '/');
        if (value.startsWith("images/") || value.startsWith("uploads/")) {
            value = "/" + value;
        }

        if (contieneCaracteresNoPermitidos(value) || value.contains("..")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "La ruta de la imagen no es válida.");
        }

        if (value.startsWith("/images/")
                || value.startsWith("/uploads/")
                || esUrlExternaValida(value)) {
            return value;
        }

        throw new ApiException(HttpStatus.BAD_REQUEST,
                "La imagen debe ser una ruta local (/images o /uploads) o una URL http(s).");
    }

    private boolean esUrlExterna(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.startsWith("http://") || lower.startsWith("https://");
    }

    private boolean esUrlExternaValida(String value) {
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            return scheme != null
                    && (scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    && uri.getHost() != null;
        } catch (URISyntaxException ex) {
            return false;
        }
    }

    private boolean contieneCaracteresNoPermitidos(String value) {
        return value.indexOf('\n') >= 0
                || value.indexOf('\r') >= 0
                || value.indexOf('\0') >= 0;
    }

    private String quitarQueryYFragmento(String value) {
        int cut = value.length();
        int query = value.indexOf('?');
        int fragment = value.indexOf('#');
        if (query >= 0) cut = Math.min(cut, query);
        if (fragment >= 0) cut = Math.min(cut, fragment);
        return value.substring(0, cut);
    }
}
