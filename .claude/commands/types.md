Actualizar los tipos de Supabase para: $ARGUMENTS

Archivo de tipos: `src/types/database.types.ts`
Tipos de negocio extendidos: `src/types/index.ts`

Reglas (del CLAUDE.md):
- Actualizar los tres bloques del tipo afectado: `Row`, `Insert`, y `Update`
- `Row` — todas las columnas incluyendo las con DEFAULT (como `id`, `created_at`)
- `Insert` — columnas requeridas + opcionales con `?` para las que tienen DEFAULT
- `Update` — todas opcionales con `?`
- Si la tabla es nueva, agregarla al objeto `Tables` y al tipo `Database`

Si hay tipos de negocio que extienden la tabla, actualizarlos en `src/types/index.ts` también.

Mostrar el diff de lo que va a cambiar antes de escribir.
