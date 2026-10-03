package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.UploadResponse;
import com.minkamarket.ecommerce.exception.ApiException;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class ArchivoService {

    private static final Logger log = LoggerFactory.getLogger(ArchivoService.class);

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp",
            "image/gif", ".gif"
    );

    private final Path uploadPath;
    private final long maxBytes;

    public ArchivoService(@Value("${app.upload-dir}") String uploadDir,
                          @Value("${app.image.max-bytes:5242880}") long maxBytes) {
        this.uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.maxBytes = maxBytes;
    }

    @PostConstruct
    void inicializarDirectorio() {
        try {
            Files.createDirectories(uploadPath.resolve("products"));
            log.info("Directorio de imágenes listo en: {}", uploadPath);
        } catch (IOException ex) {
            throw new IllegalStateException("No se pudo crear el directorio de imágenes: " + uploadPath, ex);
        }
    }

    public UploadResponse guardarImagen(MultipartFile file) {
        String detectedContentType = validarArchivo(file);

        String baseName = nombreSeguro(file.getOriginalFilename());
        String fileName = baseName + "-" + UUID.randomUUID().toString().replace("-", "")
                + EXTENSIONS.get(detectedContentType);
        String dateFolder = LocalDate.now().toString();
        Path destination = uploadPath.resolve("products").resolve(dateFolder).resolve(fileName).normalize();

        if (!destination.startsWith(uploadPath)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Nombre de archivo inválido.");
        }

        guardarAtomicamente(file, destination);

        String publicUrl = "/uploads/products/" + dateFolder + "/" + fileName;
        return new UploadResponse(publicUrl, fileName);
    }

    /**
     * El tipo real se determina por la firma binaria y no únicamente por el
     * encabezado enviado por el navegador. Esto permite imágenes legítimas de
     * Windows o móviles que llegan como image/jpg, vacío u octet-stream, sin
     * aceptar archivos que solo cambian su extensión.
     */
    private String validarArchivo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Seleccione una imagen.");
        }

        if (file.getSize() > maxBytes) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "La imagen supera el límite permitido de " + formatoMegabytes(maxBytes) + ".");
        }

        final byte[] header;
        try (InputStream input = file.getInputStream()) {
            header = input.readNBytes(16);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "No se pudo leer la imagen seleccionada.");
        }

        String detectedContentType = detectarTipo(header);
        if (detectedContentType == null) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "El archivo no contiene una imagen JPG, PNG, WEBP o GIF válida.");
        }

        String declaredContentType = normalizarTipoDeclarado(file.getContentType());
        if (EXTENSIONS.containsKey(declaredContentType)
                && !declaredContentType.equals(detectedContentType)) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "El contenido del archivo no coincide con el formato de imagen declarado.");
        }

        if (!declaredContentType.isBlank()
                && !"application/octet-stream".equals(declaredContentType)
                && !EXTENSIONS.containsKey(declaredContentType)) {
            log.info("Imagen '{}' recibida con MIME '{}'; se aceptó por su firma binaria '{}'.",
                    file.getOriginalFilename(), declaredContentType, detectedContentType);
        }

        return detectedContentType;
    }

    private void guardarAtomicamente(MultipartFile file, Path destination) {
        Path temporary = null;
        try {
            Files.createDirectories(destination.getParent());
            temporary = Files.createTempFile(destination.getParent(), ".minka-upload-", ".tmp");
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
            }

            if (!Files.isRegularFile(temporary) || Files.size(temporary) <= 0) {
                throw new IOException("El archivo temporal quedó vacío.");
            }

            try {
                Files.move(temporary, destination,
                        StandardCopyOption.ATOMIC_MOVE,
                        StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temporary, destination, StandardCopyOption.REPLACE_EXISTING);
            }
            temporary = null;
        } catch (IOException ex) {
            log.error("No se pudo guardar la imagen {}", destination, ex);
            borrarSilenciosamente(destination);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo guardar la imagen.");
        } finally {
            borrarSilenciosamente(temporary);
        }
    }

    private String detectarTipo(byte[] bytes) {
        if (bytes.length >= 3
                && unsigned(bytes[0]) == 0xFF
                && unsigned(bytes[1]) == 0xD8
                && unsigned(bytes[2]) == 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && unsigned(bytes[0]) == 0x89
                && unsigned(bytes[1]) == 0x50
                && unsigned(bytes[2]) == 0x4E
                && unsigned(bytes[3]) == 0x47
                && unsigned(bytes[4]) == 0x0D
                && unsigned(bytes[5]) == 0x0A
                && unsigned(bytes[6]) == 0x1A
                && unsigned(bytes[7]) == 0x0A) {
            return "image/png";
        }
        if (bytes.length >= 6) {
            String signature = new String(bytes, 0, 6, StandardCharsets.US_ASCII);
            if ("GIF87a".equals(signature) || "GIF89a".equals(signature)) {
                return "image/gif";
            }
        }
        if (bytes.length >= 12
                && "RIFF".equals(new String(bytes, 0, 4, StandardCharsets.US_ASCII))
                && "WEBP".equals(new String(bytes, 8, 4, StandardCharsets.US_ASCII))) {
            return "image/webp";
        }
        return null;
    }

    private String normalizarTipoDeclarado(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "";
        }
        String value = contentType.strip().toLowerCase(Locale.ROOT);
        return "image/jpg".equals(value) || "image/pjpeg".equals(value) ? "image/jpeg" : value;
    }

    private int unsigned(byte value) {
        return value & 0xFF;
    }

    private void borrarSilenciosamente(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // La limpieza no debe ocultar la causa principal del error.
        }
    }

    private String nombreSeguro(String originalName) {
        String value = originalName == null ? "producto" : originalName;
        int dot = value.lastIndexOf('.');
        if (dot > 0) value = value.substring(0, dot);

        value = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");

        if (value.isBlank()) value = "producto";
        return value.length() > 45 ? value.substring(0, 45) : value;
    }

    private String formatoMegabytes(long bytes) {
        double mb = bytes / (1024d * 1024d);
        return mb % 1 == 0
                ? String.format(Locale.ROOT, "%.0f MB", mb)
                : String.format(Locale.ROOT, "%.1f MB", mb);
    }
}
