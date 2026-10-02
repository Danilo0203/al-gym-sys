# Plantillas de rutinas en la API local

La web llama al backend local con la cookie de sesión. Ninguna acción de este módulo necesita Supabase, Hostinger ni un proveedor de ejercicios. El backend usa `algym_app` y fija el usuario de cada operación dentro de `withUserTransaction`.

| Operación | Ruta | Resultado |
| --- | --- | --- |
| Listar y contar días, ejercicios y asignaciones vigentes | `GET /routine-blueprints` | `{ data: BlueprintWithStats[] }` |
| Leer plantilla, detalles y asignaciones vigentes | `GET /routine-blueprints/:id` | `{ blueprint, details, assignments }` |
| Crear plantilla manual | `POST /routine-blueprints` | `{ success: true, blueprintId }` |
| Guardar una rutina existente como plantilla | `POST /routine-blueprints/from-routine/:routineId` | `{ success: true, blueprintId }` |
| Cambiar nombre | `PATCH /routine-blueprints/:id` | `{ success: true }` |
| Asignar a un cliente activo | `POST /routine-blueprints/:id/assign` | `{ success: true, routineId }` |
| Quitar el vínculo sin borrar la rutina | `DELETE /routine-blueprints/:id/assign/:userId` | `{ success: true }` |
| Buscar clientes activos | `GET /routine-blueprints/clients?query=` | `{ data: Client[] }` |

La API exige sesión y `routines.view` (o propietario) en todas las rutas. Los identificadores y cuerpos se validan con Zod. Las rutas sin sesión devuelven 401, las personas sin permiso 403 y los IDs no encontrados 404. La migración `0028_local_routine_blueprints.sql` habilita en RLS el permiso de rutinas para estas tablas y las lecturas/escrituras de rutinas y detalles que necesitan guardar y asignar plantillas.

Guardar desde una rutina bloquea la fila de origen, actualiza una plantilla previamente vinculada si existe y reemplaza sus detalles en una transacción. Asignar a un cliente serializa las asignaciones de ese cliente, archiva sus rutinas activa/borrador/pendiente, inserta la rutina y sus detalles y registra la asignación en la misma transacción. Si algo falla, se revierte todo. Quitar una asignación conserva la rutina del cliente, igual que la interfaz anterior.

Las imágenes de ejercicios solo se devuelven cuando `image_url` apunta a `/api/media/exercises/<hash>.<ext>`; las URL externas se convierten en `null` y el video externo no se devuelve. La importación de imágenes reales sigue pendiente porque el usuario aún no dispone de esos archivos.

La prueba `src/modules/routine-blueprints/routine-blueprints.routes.test.ts` crea y revierte datos exclusivamente en `algym_test`. Cubre sesión, permisos y RLS de propietario, empleado y socio, rollback por ejercicio inexistente, creación, listado, asignación, reemplazo de rutina, guardado idempotente desde rutina, cambio de nombre y retirada del vínculo.
