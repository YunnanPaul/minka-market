package com.minkamarket.ecommerce.session;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class CarritoSesion implements Serializable {

    public static final String SESSION_ATTRIBUTE = "MINKA_CARRITO";

    @Serial
    private static final long serialVersionUID = 1L;

    private final Map<Long, ItemCarritoSesion> items = new LinkedHashMap<>();

    public synchronized ItemCarritoSesion obtener(Long productoId) {
        return items.get(productoId);
    }

    public synchronized void guardar(ItemCarritoSesion item) {
        items.put(item.getProductoId(), item);
    }

    public synchronized void eliminar(Long productoId) {
        items.remove(productoId);
    }

    public synchronized List<ItemCarritoSesion> listar() {
        return new ArrayList<>(items.values());
    }

    public synchronized boolean estaVacio() {
        return items.isEmpty();
    }

    public synchronized void vaciar() {
        items.clear();
    }
}
