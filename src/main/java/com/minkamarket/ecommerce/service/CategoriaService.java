package com.minkamarket.ecommerce.service;

import com.minkamarket.ecommerce.dto.CategoriaResponse;
import com.minkamarket.ecommerce.repository.CategoriaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CategoriaService {

    private final CategoriaRepository categoriaRepository;

    public CategoriaService(CategoriaRepository categoriaRepository) {
        this.categoriaRepository = categoriaRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listar() {
        return categoriaRepository.findAllByOrderByNombreAsc().stream()
                .map(c -> new CategoriaResponse(
                        c.getId(),
                        c.getNombre(),
                        c.getSlug(),
                        c.getDescripcion(),
                        c.getIcono()))
                .toList();
    }
}
