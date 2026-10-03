package com.minkamarket.ecommerce.exception;

import java.sql.SQLException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Locale;
import java.util.Set;

/** Mensajes seguros basados en SQLSTATE, independientes del idioma de PostgreSQL. */
final class DatabaseErrorMessages {

    private DatabaseErrorMessages() {
    }

    static String sqlState(Throwable error) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        Throwable current = error;
        while (current != null && visited.add(current)) {
            if (current instanceof SQLException sql && sql.getSQLState() != null) {
                return sql.getSQLState();
            }
            current = current.getCause();
        }
        return "";
    }

    static String forException(Throwable error, String path) {
        String state = sqlState(error);
        String root = deepestMessage(error).toLowerCase(Locale.ROOT);
        boolean productOperation = path != null && path.startsWith("/api/admin/productos");

        if ("23505".equals(state)) {
            if (productOperation && root.contains("sku")) {
                return "Ya existe un producto con ese SKU. Ingrese uno diferente.";
            }
            if (root.contains("email")) {
                return "El correo electrónico ya está registrado.";
            }
            return "Ya existe un registro con uno de los datos únicos enviados.";
        }
        if ("23503".equals(state)) {
            if (productOperation && (root.contains("categoria_id")
                    || root.contains("fk_productos_categoria"))) {
                return "La categoría seleccionada ya no existe. Actualice el panel y vuelva a seleccionarla.";
            }
            return "La operación no se puede completar porque existen registros relacionados o falta una referencia válida.";
        }
        if ("23502".equals(state)) {
            return "Falta un dato obligatorio para guardar el registro. "
                    + "Si todos los campos están completos, revise el esquema de la base de datos.";
        }
        if ("23514".equals(state)) {
            return "Uno de los valores enviados incumple una restricción de la base de datos.";
        }
        if ("22001".equals(state)) {
            return "Uno de los textos supera el tamaño permitido por la base de datos.";
        }
        if ("22003".equals(state)) {
            return "Uno de los valores numéricos supera el rango permitido.";
        }
        return "La operación entra en conflicto con datos ya registrados o con la estructura actual de la base.";
    }

    private static String deepestMessage(Throwable error) {
        Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        String result = "";
        Throwable current = error;
        while (current != null && visited.add(current)) {
            if (current.getMessage() != null) {
                result = current.getMessage();
            }
            current = current.getCause();
        }
        return result;
    }
}
