package com.minkamarket.ecommerce.repository;

import com.minkamarket.ecommerce.entity.Usuario;
import com.minkamarket.ecommerce.enums.RolUsuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    List<Usuario> findAllByOrderByCreadoEnDesc();

    long countByRol(RolUsuario rol);
}
