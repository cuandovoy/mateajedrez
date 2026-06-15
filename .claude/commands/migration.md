Crear una nueva migración de Supabase para: $ARGUMENTS

Pasos:
1. Revisar el último número en `supabase/migrations/` con `fd . supabase/migrations --max-depth 1 -e sql | sort | tail -3`
2. Usar el número siguiente (ej: si el último es 035, usar 036)
3. Crear `supabase/migrations/NNN_nombre_descriptivo.sql`

Reglas obligatorias (del CLAUDE.md):
- Toda tabla nueva debe incluir `organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE`
- Siempre habilitar RLS: `ALTER TABLE public.tabla ENABLE ROW LEVEL SECURITY`
- Crear policies de SELECT, INSERT, UPDATE, DELETE con filtro por org_id via `organization_members`
- Usar `IF NOT EXISTS` para operaciones idempotentes
- NO ejecutar la migración — solo crear el archivo SQL

Template de política RLS:
```sql
CREATE POLICY "org_members_select" ON public.tabla FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
```

Confirmar el número de migración que se usará antes de escribir el archivo.
