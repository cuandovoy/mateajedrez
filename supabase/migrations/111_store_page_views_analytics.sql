-- Analytics de tienda pública: visitas por página y sesión anónima

-- =============================================================================
-- 1) TABLA
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.store_page_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  page_path       TEXT NOT NULL,           -- ej: '/', '/products', '/product/uuid'
  session_id      TEXT NOT NULL,           -- UUID anónimo generado en el browser
  device_type     TEXT NOT NULL DEFAULT 'unknown'
                  CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  referrer        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_page_views_org_created
  ON public.store_page_views(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_page_views_org_session
  ON public.store_page_views(organization_id, session_id);

-- RLS: solo INSERT anónimo permitido; SELECT solo para miembros de la org
ALTER TABLE public.store_page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_page_views_insert" ON public.store_page_views;
CREATE POLICY "store_page_views_insert"
  ON public.store_page_views FOR INSERT
  WITH CHECK (true);  -- cualquiera puede registrar una visita (anónimo)

DROP POLICY IF EXISTS "store_page_views_select" ON public.store_page_views;
CREATE POLICY "store_page_views_select"
  ON public.store_page_views FOR SELECT
  USING (public.is_org_member(organization_id));

-- =============================================================================
-- 2) RPC: get_store_analytics
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_store_analytics(
  p_organization_id UUID,
  p_period          TEXT DEFAULT 'day'  -- 'hour', 'day', 'week', 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tz        TEXT := 'America/Montevideo';
  v_from      TIMESTAMPTZ;
  v_result    JSONB;
BEGIN
  IF NOT public.is_org_member(p_organization_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  v_from := CASE p_period
    WHEN 'hour'  THEN NOW() - INTERVAL '1 hour'
    WHEN 'day'   THEN NOW() - INTERVAL '1 day'
    WHEN 'week'  THEN NOW() - INTERVAL '7 days'
    WHEN 'month' THEN NOW() - INTERVAL '30 days'
    ELSE NOW() - INTERVAL '1 day'
  END;

  WITH base AS (
    SELECT *
    FROM public.store_page_views
    WHERE organization_id = p_organization_id
      AND created_at >= v_from
  ),
  summary AS (
    SELECT
      COUNT(*)                          AS total_views,
      COUNT(DISTINCT session_id)        AS unique_visitors,
      COUNT(DISTINCT page_path)         AS unique_pages
    FROM base
  ),
  by_device AS (
    SELECT
      device_type,
      COUNT(*)               AS views,
      COUNT(DISTINCT session_id) AS visitors
    FROM base
    GROUP BY device_type
    ORDER BY views DESC
  ),
  top_pages AS (
    SELECT
      page_path,
      COUNT(*)               AS views,
      COUNT(DISTINCT session_id) AS visitors
    FROM base
    GROUP BY page_path
    ORDER BY views DESC
    LIMIT 10
  ),
  -- Serie temporal: granularidad según período
  time_series AS (
    SELECT
      CASE p_period
        WHEN 'hour'  THEN TO_CHAR(date_trunc('minute', created_at AT TIME ZONE v_tz), 'HH24:MI')
        WHEN 'day'   THEN TO_CHAR(date_trunc('hour',   created_at AT TIME ZONE v_tz), 'HH24:00')
        WHEN 'week'  THEN TO_CHAR(date_trunc('day',    created_at AT TIME ZONE v_tz), 'DD/MM')
        WHEN 'month' THEN TO_CHAR(date_trunc('day',    created_at AT TIME ZONE v_tz), 'DD/MM')
      END AS bucket,
      COUNT(*)               AS views,
      COUNT(DISTINCT session_id) AS visitors
    FROM base
    GROUP BY 1
    ORDER BY MIN(created_at)
  )
  SELECT JSONB_BUILD_OBJECT(
    'summary', (SELECT ROW_TO_JSON(summary) FROM summary),
    'by_device', (
      SELECT COALESCE(JSONB_AGG(ROW_TO_JSON(by_device) ORDER BY (ROW_TO_JSON(by_device)->>'views')::int DESC), '[]')
      FROM by_device
    ),
    'top_pages', (
      SELECT COALESCE(JSONB_AGG(ROW_TO_JSON(top_pages)), '[]')
      FROM top_pages
    ),
    'time_series', (
      SELECT COALESCE(JSONB_AGG(ROW_TO_JSON(time_series)), '[]')
      FROM time_series
    )
  )
  INTO v_result;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_analytics(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_analytics(UUID, TEXT) TO anon;

-- INSERT también permitido para anon (visitors sin login)
GRANT INSERT ON public.store_page_views TO anon;
GRANT INSERT ON public.store_page_views TO authenticated;
