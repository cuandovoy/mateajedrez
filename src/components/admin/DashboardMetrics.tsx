import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import {
  Briefcase,
  Clock,
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Info,
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

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function MetricSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-10 w-10 bg-gray-200 rounded-lg" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
          <div className="h-7 bg-gray-200 rounded w-1/2" />
          <div className="h-5 bg-gray-200 rounded-full w-2/5" />
        </div>
      </CardContent>
    </Card>
  )
}

interface DeltaBadgeProps {
  current: number
  prev: number
  unit?: 'pct' | 'pts' | 'abs'
  showZero?: boolean
}

function DeltaBadge({ current, prev, unit = 'pct', showZero = false }: DeltaBadgeProps) {
  if (prev === 0 && current === 0) return null

  let delta: number
  let label: string

  if (unit === 'pts') {
    delta = Math.round(current - prev)
    label = `${delta > 0 ? '+' : ''}${delta}pts vs mes ant.`
  } else if (unit === 'abs') {
    delta = current - prev
    label = `${delta > 0 ? '+' : ''}${Math.round(delta)} vs mes ant.`
  } else {
    if (prev === 0) return null
    delta = Math.round(((current - prev) / prev) * 100)
    label = `${Math.abs(delta)}% vs mes ant.`
  }

  if (delta === 0) {
    if (!showZero) return null
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
        <Minus className="h-3 w-3" />
        {unit === 'abs' ? '0 vs mes ant.' : label}
      </span>
    )
  }

  const up = delta > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  iconBgClass?: string
  label: string
  value: React.ReactNode
  badge?: React.ReactNode
  subtitle?: string
  info?: string
  onClick?: () => void
}

function MetricCard({ icon, iconBgClass, label, value, badge, subtitle, info, onClick }: MetricCardProps) {
  return (
    <Card
      className={`transition-shadow hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6 flex flex-col gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBgClass ?? 'bg-admin-100'}`}>
          {icon}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          {info && (
            <div className="relative group/tooltip">
              <Info className="h-3.5 w-3.5 text-gray-300 hover:text-gray-400 cursor-default shrink-0" />
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-100 leading-relaxed opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                {info}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
          )}
        </div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        {badge ?? (subtitle ? <p className="text-xs text-gray-400">{subtitle}</p> : null)}
      </CardContent>
    </Card>
  )
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-base">{emoji}</span>
      <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase">{title}</h2>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DINERO section
// ---------------------------------------------------------------------------

function MoneySection({ data, loading }: { data: MoneyMetrics | null; loading: boolean }) {
  const settings = useOrgSettings()

  if (loading || !data) {
    return (
      <div>
        <SectionHeader emoji="💰" title="Dinero" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <MetricSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  const fmt = (n: number) => formatPrice(n, settings)

  return (
    <div>
      <SectionHeader emoji="💰" title="Dinero" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Briefcase className="h-5 w-5 text-emerald-600" />}
          iconBgClass="bg-emerald-100"
          label="Ingresos del mes"
          value={fmt(data.monthRevenue)}
          info="Suma del total de todas las órdenes completadas (processing, shipped, delivered) desde el 1° del mes hasta hoy."
          badge={
            <DeltaBadge current={data.monthRevenue} prev={data.prevMonthRevenue} showZero />
          }
        />
        <MetricCard
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          iconBgClass="bg-blue-100"
          label="Ingresos mes anterior"
          value={fmt(data.prevMonthRevenue)}
          info="Total facturado el mes pasado en el mismo período (del día 1 al día equivalente al de hoy). Sirve como referencia de crecimiento."
          subtitle="Referencia de crecimiento"
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          iconBgClass="bg-emerald-100"
          label="Margen bruto del mes"
          value={`${Math.round(data.grossMarginPct)}%`}
          info="(Ingresos − Costo de los productos vendidos) / Ingresos. Refleja cuánto queda de cada venta antes de gastos operativos."
          badge={
            <DeltaBadge
              current={data.grossMarginPct}
              prev={data.prevMonthGrossMarginPct}
              unit="pts"
              showZero
            />
          }
        />
        <MetricCard
          icon={<LayoutGrid className="h-5 w-5 text-violet-600" />}
          iconBgClass="bg-violet-100"
          label="Ticket promedio"
          value={fmt(data.averageOrderValue)}
          info="Ingresos del mes dividido la cantidad de órdenes. Indica cuánto gasta en promedio cada cliente por compra."
          subtitle="por orden"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OPERATIVO section
// ---------------------------------------------------------------------------

function OperationalSection({ data, loading }: { data: OperationalMetrics | null; loading: boolean }) {
  const navigate = useNavigate()

  if (loading || !data) {
    return (
      <div>
        <SectionHeader emoji="📦" title="Operativo" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <MetricSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader emoji="📦" title="Operativo" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
          iconBgClass="bg-blue-100"
          label="Órdenes del mes"
          value={data.monthOrders}
          info="Cantidad de órdenes con estado processing, shipped o delivered creadas desde el 1° del mes hasta hoy."
          badge={
            <DeltaBadge
              current={data.monthOrders}
              prev={data.prevMonthOrders}
              unit="abs"
              showZero
            />
          }
        />
        <MetricCard
          icon={<Clock className="h-5 w-5 text-orange-600" />}
          iconBgClass="bg-orange-100"
          label="Órdenes pendientes"
          value={data.pendingOrders}
          info="Órdenes en estado pending o pending_allocation que aún no fueron procesadas. Hacé clic para gestionarlas."
          subtitle={data.pendingOrders === 0 ? 'Sin atrasos' : 'Requieren atención'}
          onClick={data.pendingOrders > 0 ? () => navigate('/orders?status=pending') : undefined}
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          iconBgClass="bg-red-100"
          label="Productos bajo stock"
          value={data.lowStockCount}
          info="Productos o variantes activos cuyo stock actual es menor o igual al umbral mínimo configurado. Hacé clic para ver el inventario."
          badge={
            data.lowStockCount > 0 ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                Requieren reposición
              </span>
            ) : (
              <span className="text-xs text-gray-400">Stock en orden</span>
            )
          }
          onClick={data.lowStockCount > 0 ? () => navigate('/inventory?low_stock=true') : undefined}
        />
        <MetricCard
          icon={<UserPlus className="h-5 w-5 text-violet-600" />}
          iconBgClass="bg-violet-100"
          label="Clientes nuevos este mes"
          value={data.newCustomers}
          info="Clientes registrados desde el 1° del mes hasta hoy. Compara contra el mismo período del mes anterior."
          badge={
            <DeltaBadge
              current={data.newCustomers}
              prev={data.prevMonthNewCustomers}
              unit="abs"
              showZero
            />
          }
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Actionable alerts (uses already-fetched ops data — no extra fetch)
// ---------------------------------------------------------------------------

function ActionableAlerts({ ops }: { ops: OperationalMetrics | null }) {
  const navigate = useNavigate()

  if (!ops || ops.pendingOrders === 0) return null

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        onClick={() => navigate('/orders?status=pending')}
        className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800 hover:bg-orange-100 transition-colors text-left"
      >
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          <strong>{ops.pendingOrders}</strong>{' '}
          {ops.pendingOrders === 1 ? 'orden pendiente de cobro' : 'órdenes pendientes de cobro'}
        </span>
        <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Smart alerts — rendered below all metric sections
// ---------------------------------------------------------------------------

const MARGIN_TARGET_PCT = 45

interface SmartAlertsProps {
  money: MoneyMetrics | null
  ops: OperationalMetrics | null
}

function SmartAlerts({ money, ops }: SmartAlertsProps) {
  const navigate = useNavigate()
  const { data: lowStockProducts, loading: lowStockLoading } = useLowStockProducts(5)

  const hasLowStock = (ops?.lowStockCount ?? 0) > 0
  const marginPct = money?.grossMarginPct ?? 0
  const marginBelowTarget = money && marginPct < MARGIN_TARGET_PCT
  const revenuePct = money && money.prevMonthRevenue > 0
    ? Math.round(((money.monthRevenue - money.prevMonthRevenue) / money.prevMonthRevenue) * 100)
    : null

  const hasAnyAlert = hasLowStock || marginBelowTarget || (revenuePct !== null && revenuePct > 0)
  if (!money || !ops || (!hasAnyAlert && !lowStockLoading)) return null

  return (
    <div>
      <SectionHeader emoji="🔔" title="Alertas accionables" />
      <div className="flex flex-col gap-3">

        {/* Low stock — with product names */}
        {hasLowStock && (
          <button
            onClick={() => navigate('/inventory')}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-left hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">
                {ops.lowStockCount} {ops.lowStockCount === 1 ? 'producto bajo el umbral mínimo' : 'productos bajo el umbral mínimo'}
              </p>
              {!lowStockLoading && lowStockProducts.length > 0 && (
                <p className="text-xs text-red-600 mt-0.5 truncate">
                  {lowStockProducts.map((p) => p.name).join(', ')}
                  {ops.lowStockCount > lowStockProducts.length ? ` y ${ops.lowStockCount - lowStockProducts.length} más` : ''}
                  {' → reponer antes de agotar'}
                </p>
              )}
            </div>
            <ArrowRight className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          </button>
        )}

        {/* Margin below target */}
        {marginBelowTarget && (
          <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                Margen del mes por debajo del objetivo
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Objetivo: {MARGIN_TARGET_PCT}% · Actual: {Math.round(marginPct)}% · Revisar precios o costos
              </p>
            </div>
          </div>
        )}

        {/* Revenue positive milestone */}
        {revenuePct !== null && revenuePct > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Ingresos {revenuePct}% por encima del mes anterior
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Vas camino a cerrar el mejor mes del año
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trends section — weekly comparison chart + top products
// ---------------------------------------------------------------------------

function TrendsSection() {
  const settings = useOrgSettings()
  const { data, loading } = useTrendsMetrics()

  const chartData = (data?.weekly ?? []).map((w) => ({
    name: `S${w.week}`,
    'Mes anterior': w.prev,
    'Este mes': w.current,
  }))

  const maxRevenue = data?.topProducts[0]?.revenue ?? 1

  const fmt = (n: number) =>
    formatPrice(n, settings)

  return (
    <div>
      <SectionHeader emoji="📊" title="Tendencias y productos" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Weekly bar chart */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Ingresos: este mes vs mes anterior
            </p>
            {loading ? (
              <div className="h-48 animate-pulse bg-gray-100 rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Mes anterior" fill="#bfdbfe" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Este mes"     fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 products */}
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              Top 5 productos más vendidos
            </p>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="h-3 w-4 bg-gray-200 rounded" />
                    <div className="h-3 bg-gray-200 rounded flex-1" />
                    <div className="h-3 w-16 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : (data?.topProducts ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">Sin ventas este mes</p>
            ) : (
              <ol className="space-y-3">
                {(data?.topProducts ?? []).map((p, i) => {
                  const barPct = maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0
                  return (
                    <li key={p.name} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-3 shrink-0">{i + 1}</span>
                      <span className="text-sm text-gray-800 flex-1 truncate">{p.name}</span>
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full shrink-0">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-700 w-20 text-right shrink-0">
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root export — both hooks fire in parallel, sections render independently
// ---------------------------------------------------------------------------

export function DashboardMetrics() {
  const { data: money, loading: moneyLoading } = useMoneyMetrics()
  const { data: ops, loading: opsLoading } = useOperationalMetrics()

  return (
    <div className="mb-8 space-y-8">
      <ActionableAlerts ops={ops} />
      <MoneySection data={money} loading={moneyLoading} />
      <OperationalSection data={ops} loading={opsLoading} />
      <TrendsSection />
      <SmartAlerts money={money} ops={ops} />
    </div>
  )
}
