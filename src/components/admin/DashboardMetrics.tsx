import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatPrice } from '@/lib/utils'
import { useMoneyMetrics, type MoneyMetrics } from '@/hooks/useMoneyMetrics'
import { useOperationalMetrics, type OperationalMetrics } from '@/hooks/useOperationalMetrics'
import { useLowStockProducts } from '@/hooks/useLowStockProducts'
import { useTrendsMetrics } from '@/hooks/useTrendsMetrics'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

// ─── Delta inline ─────────────────────────────────────────────────────────────

interface DeltaProps {
  current: number
  prev: number
  unit?: 'pct' | 'pts' | 'abs'
}

function Delta({ current, prev, unit = 'pct' }: DeltaProps) {
  if (prev === 0 && current === 0) return null

  let delta: number
  let label: string

  if (unit === 'pts') {
    delta = Math.round(current - prev)
    label = `${delta > 0 ? '+' : ''}${delta} pts vs mes ant.`
  } else if (unit === 'abs') {
    delta = current - prev
    label = `${delta > 0 ? '+' : ''}${Math.round(delta)} vs mes ant.`
  } else {
    if (prev === 0) return null
    delta = Math.round(((current - prev) / prev) * 100)
    label = `${delta > 0 ? '+' : ''}${delta}% vs mes ant.`
  }

  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Minus className="h-3 w-3" /> sin cambios
      </span>
    )
  }

  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

// ─── Alert strip ──────────────────────────────────────────────────────────────

const MARGIN_TARGET_PCT = 45

interface AlertStripProps {
  money: MoneyMetrics | null
  ops: OperationalMetrics | null
}

function AlertStrip({ money, ops }: AlertStripProps) {
  const navigate = useNavigate()
  const { data: lowStockProducts } = useLowStockProducts(3)

  if (!ops) return null

  const marginPct = money?.grossMarginPct ?? 0
  const marginBelowTarget = money && marginPct > 0 && marginPct < MARGIN_TARGET_PCT

  const hasAlerts = ops.pendingOrders > 0 || ops.lowStockCount > 0 || marginBelowTarget
  if (!hasAlerts) return null

  return (
    <div className="flex flex-wrap gap-2">
      {ops.pendingOrders > 0 && (
        <button
          onClick={() => navigate('/orders?status=pending')}
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            <strong>{ops.pendingOrders}</strong>{' '}
            {ops.pendingOrders === 1 ? 'orden pendiente' : 'órdenes pendientes'}
          </span>
          <ArrowRight className="h-3.5 w-3.5 ml-1 text-amber-500" />
        </button>
      )}

      {ops.lowStockCount > 0 && (
        <button
          onClick={() => navigate('/inventory?low_stock=true')}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm text-red-800 hover:bg-red-100 transition-colors"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>
            <strong>{ops.lowStockCount}</strong>{' '}
            {ops.lowStockCount === 1 ? 'producto bajo umbral' : 'productos bajo umbral'}
            {lowStockProducts.length > 0 && (
              <span className="text-red-500 font-normal">
                {' '}· {lowStockProducts.map(p => p.name).join(', ')}
                {ops.lowStockCount > 3 ? ' y más' : ''}
              </span>
            )}
          </span>
          <ArrowRight className="h-3.5 w-3.5 ml-1 text-red-400" />
        </button>
      )}

      {marginBelowTarget && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3.5 py-2 text-sm text-yellow-800">
          <TrendingDown className="h-4 w-4 shrink-0 text-yellow-500" />
          <span>
            Margen {Math.round(marginPct)}% — objetivo {MARGIN_TARGET_PCT}%
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-2.5 bg-gray-200 rounded w-2/3" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-2.5 bg-gray-200 rounded w-1/3" />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

const ACCENT_BORDER: Record<string, string> = {
  green:  'border-l-emerald-400',
  blue:   'border-l-blue-400',
  violet: 'border-l-violet-400',
  gray:   'border-l-gray-300',
}

interface MetricCardProps {
  label: string
  value: React.ReactNode
  delta?: React.ReactNode
  sub?: string
  accent?: 'green' | 'blue' | 'violet' | 'gray'
  onClick?: () => void
}

function MetricCard({ label, value, delta, sub, accent = 'gray', onClick }: MetricCardProps) {
  return (
    <Card
      className={`border-l-4 ${ACCENT_BORDER[accent]} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none mb-2">{value}</p>
        {delta ?? (sub ? <p className="text-xs text-gray-400">{sub}</p> : null)}
      </CardContent>
    </Card>
  )
}

// ─── Primary metrics ──────────────────────────────────────────────────────────

interface PrimaryMetricsProps {
  money: MoneyMetrics | null
  ops: OperationalMetrics | null
  moneyLoading: boolean
  opsLoading: boolean
}

function PrimaryMetrics({ money, ops, moneyLoading, opsLoading }: PrimaryMetricsProps) {
  const settings = useOrgSettings()
  const fmt = (n: number) => formatPrice(n, settings)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {moneyLoading ? <CardSkeleton /> : (
        <MetricCard
          label="Ingresos del mes"
          value={money ? fmt(money.monthRevenue) : '—'}
          accent="green"
          delta={money ? <Delta current={money.monthRevenue} prev={money.prevMonthRevenue} /> : undefined}
        />
      )}

      {moneyLoading ? <CardSkeleton /> : (
        <MetricCard
          label="Margen bruto"
          value={money ? `${Math.round(money.grossMarginPct)}%` : '—'}
          accent="violet"
          delta={money
            ? <Delta current={money.grossMarginPct} prev={money.prevMonthGrossMarginPct} unit="pts" />
            : undefined}
        />
      )}

      {opsLoading ? <CardSkeleton /> : (
        <MetricCard
          label="Órdenes del mes"
          value={ops?.monthOrders ?? '—'}
          accent="blue"
          delta={ops ? <Delta current={ops.monthOrders} prev={ops.prevMonthOrders} unit="abs" /> : undefined}
        />
      )}

      {opsLoading ? <CardSkeleton /> : (
        <MetricCard
          label="Clientes nuevos"
          value={ops?.newCustomers ?? '—'}
          delta={ops
            ? <Delta current={ops.newCustomers} prev={ops.prevMonthNewCustomers} unit="abs" />
            : undefined}
        />
      )}
    </div>
  )
}

// ─── Secondary stats strip ────────────────────────────────────────────────────

function SecondaryStats({ money, loading }: { money: MoneyMetrics | null; loading: boolean }) {
  const settings = useOrgSettings()
  const fmt = (n: number) => formatPrice(n, settings)

  if (loading || !money) return null

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">Ticket promedio</span>
        <span className="font-semibold text-gray-700">{fmt(money.averageOrderValue)}</span>
        <Delta current={money.averageOrderValue} prev={money.prevMonthAverageOrderValue} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">Ingresos mes anterior</span>
        <span className="font-semibold text-gray-700">{fmt(money.prevMonthRevenue)}</span>
      </div>
    </div>
  )
}

// ─── Trends & top products ────────────────────────────────────────────────────

function TrendsSection() {
  const settings = useOrgSettings()
  const { data, loading } = useTrendsMetrics()
  const fmt = (n: number) => formatPrice(n, settings)

  const chartData = (data?.weekly ?? []).map((w) => ({
    name: `S${w.week}`,
    'Mes anterior': w.prev,
    'Este mes': w.current,
  }))

  const maxRevenue = data?.topProducts[0]?.revenue ?? 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <Card className="lg:col-span-3">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5">
            Ingresos semana a semana
          </p>
          {loading ? (
            <div className="h-56 animate-pulse bg-gray-100 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={36}
                />
                <Tooltip
                  formatter={(value) => fmt(Number(value))}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Mes anterior" fill="#e5e7eb" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Este mes" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-5">
            Top 5 productos
          </p>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-3 w-4 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded flex-1" />
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : (data?.topProducts ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 mt-4">Sin ventas este mes</p>
          ) : (
            <ol className="space-y-4">
              {(data?.topProducts ?? []).map((p, i) => {
                const barPct = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0
                return (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-300 w-4 shrink-0 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate mb-1">{p.name}</p>
                      <div className="h-1 bg-gray-100 rounded-full">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-gray-600 shrink-0 w-20 text-right">
                      {fmt(p.revenue)}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function DashboardMetrics() {
  const { data: money, loading: moneyLoading } = useMoneyMetrics()
  const { data: ops, loading: opsLoading } = useOperationalMetrics()

  return (
    <div className="space-y-6">
      <AlertStrip money={money} ops={ops} />
      <PrimaryMetrics money={money} ops={ops} moneyLoading={moneyLoading} opsLoading={opsLoading} />
      <SecondaryStats money={money} loading={moneyLoading} />
      <TrendsSection />
    </div>
  )
}
