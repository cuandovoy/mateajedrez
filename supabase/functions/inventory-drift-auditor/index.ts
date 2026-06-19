// Edge Function: inventory-drift-auditor
//
// Runs daily at 3am via pg_cron.
// Detects discrepancies between branch_inventory.stock and the new_stock
// recorded in the last inventory_movements row for each entry.
//
// IMPORTANT: this function is READ-ONLY. It NEVER mutates stock values.
// All it does is record detected drifts in inventory_drift_log for
// administrators to review and manually reconcile.
//
// A drift indicates one of:
//   - A direct UPDATE to branch_inventory.stock that bypassed the trigger/movement system
//   - A bug in a trigger that updated stock but failed to record the movement
//   - A concurrent write that won a race against the movement recorder
//
// Entries with zero movements are skipped (no baseline to compare against).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface DriftRow {
  organization_id:     string
  branch_inventory_id: string
  branch_id:           string
  product_id:          string | null
  variant_id:          string | null
  stock_current:       number
  stock_expected:      number
  drift:               number
  last_movement_id:    string | null
  last_movement_at:    string | null
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drifts, error: queryError } = await (supabase.rpc as any)(
    'get_inventory_drift',
  )

  if (queryError) {
    console.error('[inventory-drift-auditor] Failed to query drift:', queryError)
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 })
  }

  const rows = (drifts ?? []) as DriftRow[]

  if (rows.length === 0) {
    console.log('[inventory-drift-auditor] No inventory drift detected')
    return new Response(JSON.stringify({ drifts: 0 }), { status: 200 })
  }

  console.log(`[inventory-drift-auditor] Found ${rows.length} drift(s) — logging`)

  const logEntries = rows.map(r => ({
    organization_id:     r.organization_id,
    branch_inventory_id: r.branch_inventory_id,
    branch_id:           r.branch_id,
    product_id:          r.product_id,
    variant_id:          r.variant_id,
    stock_current:       r.stock_current,
    stock_expected:      r.stock_expected,
    drift:               r.drift,
    last_movement_id:    r.last_movement_id,
    last_movement_at:    r.last_movement_at,
  }))

  // Insert in batches of 500 to avoid payload limits
  const BATCH = 500
  let inserted = 0
  let errors   = 0

  for (let i = 0; i < logEntries.length; i += BATCH) {
    const batch = logEntries.slice(i, i + BATCH)
    const { error: insertError } = await supabase
      .from('inventory_drift_log')
      .insert(batch as never[])

    if (insertError) {
      console.error(`[inventory-drift-auditor] Insert error (batch ${i / BATCH}):`, insertError)
      errors++
    } else {
      inserted += batch.length
    }
  }

  const summary = { total: rows.length, inserted, errors }
  console.log('[inventory-drift-auditor] Done:', summary)

  return new Response(JSON.stringify(summary), {
    status:  errors > 0 ? 207 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
