package com.minkamarket.ecommerce.controller;

import com.minkamarket.ecommerce.dto.ActualizarCantidadRequest;
import com.minkamarket.ecommerce.dto.AgregarCarritoRequest;
import com.minkamarket.ecommerce.dto.CarritoResponse;
import com.minkamarket.ecommerce.service.CarritoService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/carrito")
public class CarritoController {

    private final CarritoService carritoService;

    public CarritoController(CarritoService carritoService) {
        this.carritoService = carritoService;
    }

    @GetMapping
    public CarritoResponse obtener(HttpSession session) {
        return carritoService.obtener(session);
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public CarritoResponse agregar(@Valid @RequestBody AgregarCarritoRequest request,
                                   HttpSession session) {
        return carritoService.agregar(request.productoId(), request.cantidad(), session);
    }

    @PutMapping("/items/{productoId}")
    public CarritoResponse actualizar(@PathVariable Long productoId,
                                      @Valid @RequestBody ActualizarCantidadRequest request,
                                      HttpSession session) {
        return carritoService.actualizarCantidad(productoId, request.cantidad(), session);
    }

    @DeleteMapping("/items/{productoId}")
    public CarritoResponse eliminar(@PathVariable Long productoId, HttpSession session) {
        return carritoService.eliminar(productoId, session);
    }

    @DeleteMapping
    public CarritoResponse vaciar(HttpSession session) {
        return carritoService.vaciar(session);
    }
}
