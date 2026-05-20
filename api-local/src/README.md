# api-local

Estructura base creada en Fase 1.

Objetivo de la siguiente fase:

- montar `Express + TypeScript + Zod`
- implementar `login`, `logout`, `me`
- conectar a PostgreSQL local

Estructura sugerida:

```text
api-local/
  src/
    config/
    db/
    http/
      middleware/
      routes/
    modules/
      auth/
      users/
      roles/
      customers/
      cash/
      inventory/
      routines/
      storage/
      sync/
```

Primera meta tecnica:

- reemplazar `src/lib/supabase/*`
- mantener la UI usando `/api/...`
