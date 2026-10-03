package com.minkamarket.ecommerce.controller;

import com.minkamarket.ecommerce.dto.ProductoRequest;
import com.minkamarket.ecommerce.dto.ProductoResponse;
import com.minkamarket.ecommerce.dto.UploadResponse;
import com.minkamarket.ecommerce.service.ArchivoService;
import com.minkamarket.ecommerce.service.AuthService;
import com.minkamarket.ecommerce.service.ProductoService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/productos")
public class AdminProductoController {

    private final ProductoService productoService;
    private final ArchivoService archivoService;
    private final AuthService authService;

    public AdminProductoController(
            ProductoService productoService,
            ArchivoService archivoService,
            AuthService authService) {
        this.productoService = productoService;
        this.archivoService = archivoService;
        this.authService = authService;
    }

    @GetMapping
    public List<ProductoResponse> listar(HttpSession session) {
        authService.requerirAdmin(session);
        return productoService.listarAdministracion();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductoResponse crear(
            @Valid @RequestBody ProductoRequest request,
            HttpSession session) {
        authService.requerirAdmin(session);
        return productoService.crear(request);
    }

    @PutMapping("/{id}")
    public ProductoResponse actualizar(
            @PathVariable Long id,
            @Valid @RequestBody ProductoRequest request,
            HttpSession session) {
        authService.requerirAdmin(session);
        return productoService.actualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactivar(@PathVariable Long id, HttpSession session) {
        authService.requerirAdmin(session);
        productoService.desactivar(id);
    }

    @PostMapping("/imagen")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse subirImagen(
            @RequestParam("file") MultipartFile file,
            HttpSession session) {
        authService.requerirAdmin(session);
        return archivoService.guardarImagen(file);
    }
}
