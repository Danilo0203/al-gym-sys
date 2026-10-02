# Inventario local: contrato y límites

La pantalla `/panel/inventario` usa la API del backend local. Las acciones de Next.js reenvían la cookie de sesión; el navegador no recibe credenciales de PostgreSQL. Las imágenes nuevas se guardan junto con el alta o edición de productos en `/inventory/products/with-image` o `/inventory/products/{id}/with-image` y se leen por `/api/media/products/<hash>.<ext>` desde el disco local respaldado junto a la base.

| Método | Ruta | Permiso | Operación |
| --- | --- | --- | --- |
| GET | `/inventory/products` | `products.view` u owner | Lista paginada por nombre/SKU/código y estado; precio y existencias de PostgreSQL local |
| POST | `/inventory/products` | `products.create` u owner; también `inventory.adjust` si incluye stock inicial | Crea producto y movimiento inicial en una transacción; acepta imagen local ya cargada |
| PUT | `/inventory/products/:id` | `products.update` u owner | Edita datos y, opcionalmente, imagen local |
| DELETE | `/inventory/products/:id` | `products.delete` u owner | Desactiva el producto sin borrar historial |
| POST | `/inventory/products/:id/movements` | `inventory.adjust` u owner | Entrada o salida; bloquea el producto, comprueba stock y guarda cantidades antes/después |
| POST | `/inventory/products/:id/adjust` | `inventory.adjust` u owner | Ajusta al conteo físico en una transacción |
| GET | `/inventory/movements` | `inventory.view` u owner | Historial paginado con producto, responsable y número de venta si existe |

Los importes admiten dos decimales y las cantidades tres. La salida que dejaría existencias negativas responde `409`. La API solo acepta URLs de imagen locales y verifica que el archivo exista y conserve su hash. La migración `0026_local_inventory_access.sql` permite escrituras RLS según permisos de producto y aporta un bloqueo limitado para ajustes de empleados, sin otorgarles edición general del catálogo. Las ventas de Caja también bloquean el producto antes de descontar existencias.

**Verificación:** `algym_test` cubre carga de imagen, stock inicial, edición, búsqueda, salida excesiva, ajuste de empleado, historial y baja lógica. En otro stack Docker con red interna y salida externa bloqueada, un owner cargó un PNG local, creó un producto con 5 unidades, lo vio en `/panel/inventario/productos`, vendió 2 unidades desde Caja y anuló la venta: existencias 5 → 3 → 5. El archivo quedó en el volumen de media privado del ensayo y la base operativa no recibió el producto. Falta aceptación visual de toda la interfaz sin internet y conciliación con datos reales. En la base `algym` había 0 productos y 0 movimientos de inventario al aplicar `0026`; la importación de cualquier catálogo histórico debe comprobarse durante el corte final.
