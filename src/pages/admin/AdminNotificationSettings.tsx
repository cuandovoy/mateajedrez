import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { useOrganizationStore } from '@/store/organizationStore'
import { useToastStore } from '@/store/toastStore'
import { Bell, MessageCircle, Clock, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailySummaryConfig {
  enabled: boolean
  phone: string
  send_hour: number
  timezone: string
  channel: 'whatsapp' | 'sms'
}

interface SummaryLog {
  id: string
  date_covered: string
  sent_at: string
  total_sales: number
  order_count: number
  total_expenses: number
  phone: string
  channel: string
  status: 'sent' | 'failed'
  error: string | null
}

// ─── Datos estáticos ──────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/Montevideo',   label: 'Uruguay (UYT, UTC-3)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (ART, UTC-3)' },
  { value: 'America/Santiago',     label: 'Chile (CLT, UTC-3/4)' },
  { value: 'America/Bogota',       label: 'Colombia (COT, UTC-5)' },
  { value: 'America/Lima',         label: 'Perú (PET, UTC-5)' },
  { value: 'America/Caracas',      label: 'Venezuela (VET, UTC-4)' },
  { value: 'America/La_Paz',       label: 'Bolivia (BOT, UTC-4)' },
  { value: 'America/Asuncion',     label: 'Paraguay (PYT, UTC-4)' },
  { value: 'America/Guayaquil',    label: 'Ecuador (ECT, UTC-5)' },
  { value: 'America/Mexico_City',  label: 'México Centro (CST, UTC-6)' },
  { value: 'America/New_York',     label: 'EST (UTC-5)' },
  { value: 'Europe/Madrid',        label: 'España (CET, UTC+1)' },
  { value: 'UTC',                  label: 'UTC' },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, '0')}:00 hs`,
}))

const DEFAULT_CONFIG: DailySummaryConfig = {
  enabled:   false,
  phone:     '',
  send_hour: 20,
  timezone:  'America/Montevideo',
  channel:   'whatsapp',
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-500 ${
        checked ? 'bg-admin-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function AdminNotificationSettings() {
  const { currentOrganization } = useOrganizationStore()
  const { show: showToast } = useToastStore()

  const [config, setConfig]     = useState<DailySummaryConfig>(DEFAULT_CONFIG)
  const [logs, setLogs]         = useState<SummaryLog[]>([])
  const [saving, setSaving]     = useState(false)
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Carga config actual de la org
  useEffect(() => {
    if (!currentOrganization) return
    const cfg = (currentOrganization.settings as Record<string, unknown>)?.daily_summary as DailySummaryConfig | undefined
    if (cfg) {
      setConfig({ ...DEFAULT_CONFIG, ...cfg })
    }
  }, [currentOrganization])

  // Carga historial de envíos
  useEffect(() => {
    if (!currentOrganization) return
    setLoadingLogs(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .from('daily_summary_logs')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('date_covered', { ascending: false })
      .limit(10)
      .then(({ data }: { data: SummaryLog[] | null }) => {
        setLogs(data ?? [])
        setLoadingLogs(false)
      })
  }, [currentOrganization])

  const handleSave = async () => {
    if (!currentOrganization) return
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('organizations')
        .update({
          settings: {
            ...(currentOrganization.settings as Record<string, unknown>),
            daily_summary: config,
          },
        })
        .eq('id', currentOrganization.id)

      if (error) throw error
      showToast('Configuración guardada', 'success')
    } catch (err) {
      showToast('Error al guardar la configuración', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-gray-600 mt-1">
          Configura el resumen diario de ventas y gastos por WhatsApp o SMS via Twilio.
        </p>
      </div>

      {/* Card: Resumen diario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-admin-600" />
            Resumen diario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Activar / desactivar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Activar envío diario</p>
              <p className="text-xs text-gray-500">
                Recibe un mensaje con ventas y gastos al final del día
              </p>
            </div>
            <Toggle
              checked={config.enabled}
              onChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
            />
          </div>

          <hr className="border-gray-100" />

          {/* Canal */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Canal</p>
            <div className="flex gap-3">
              {(['whatsapp', 'sms'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, channel: ch }))}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    config.channel === ch
                      ? 'border-admin-600 bg-admin-50 text-admin-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  {ch === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </button>
              ))}
            </div>
            {config.channel === 'whatsapp' && (
              <p className="text-xs text-gray-500 mt-2">
                Requiere un número aprobado por WhatsApp Business en Twilio.
                En sandbox usa el número{' '}
                <span className="font-mono">+14155238886</span> y el destinatario
                debe haber optado al sandbox.
              </p>
            )}
          </div>

          {/* Teléfono destino */}
          <Input
            label="Número de teléfono destino"
            placeholder="+598912345678"
            value={config.phone}
            onChange={(e) => setConfig((c) => ({ ...c, phone: e.target.value }))}
          />
          <p className="-mt-3 text-xs text-gray-500">
            Incluye el código de país (ej: +598 para Uruguay, +54 para Argentina).
          </p>

          {/* Hora de envío */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hora de envío
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={config.send_hour}
                onChange={(e) => setConfig((c) => ({ ...c, send_hour: Number(e.target.value) }))}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-500"
              >
                {HOURS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Zona horaria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zona horaria
            </label>
            <select
              value={config.timezone}
              onChange={(e) => setConfig((c) => ({ ...c, timezone: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-500"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {/* Guardar */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </CardContent>
      </Card>

      {/* Card: Vista previa del mensaje */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-green-600" />
            Vista previa del mensaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
{`📊 Resumen diario — ${currentOrganization?.name ?? 'Mi Tienda'}
📅 2026-03-26

💰 Ventas:  $12.450 (8 órdenes)
💸 Gastos:  $3.200
📈 Balance: +$9.250`}
          </pre>
        </CardContent>
      </Card>

      {/* Card: Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-gray-600" />
            Historial de envíos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Aún no se han enviado resúmenes.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => (
                <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {log.status === 'sent' ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{log.date_covered}</p>
                      {log.status === 'failed' && log.error && (
                        <p className="text-xs text-red-500 truncate">{log.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-gray-700">
                      <span className="text-green-700 font-medium">${fmt(log.total_sales)}</span>
                      {' / '}
                      <span className="text-red-600">${fmt(log.total_expenses)}</span>
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <Phone className="h-3 w-3" />
                      {log.phone}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card: Configuración del servidor */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-base text-amber-800">Configuración del servidor</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-700 space-y-2">
          <p>Para que los envíos funcionen, configura las siguientes variables de entorno en Supabase:</p>
          <ul className="list-disc list-inside space-y-1 font-mono text-xs bg-amber-100 rounded p-3">
            <li>TWILIO_ACCOUNT_SID</li>
            <li>TWILIO_AUTH_TOKEN</li>
            <li>TWILIO_FROM_NUMBER  (ej: +14155238886)</li>
          </ul>
          <p>Y actualiza la URL de la edge function en la base de datos:</p>
          <pre className="text-xs bg-amber-100 rounded p-3 overflow-x-auto whitespace-pre-wrap">{`UPDATE notification_config
SET value = 'https://<ref>.supabase.co/functions/v1/daily-sales-summary'
WHERE key = 'daily_summary_function_url';

UPDATE notification_config
SET value = '<service_role_key>'
WHERE key = 'supabase_service_role_key';`}</pre>
        </CardContent>
      </Card>
    </div>
  )
}
