// email-templates.ts
// HTML email templates for each notification type.
// Variables use {{variable_name}} syntax (replaced at send time).
// Mirror of supabase/email-templates/ — keep them in sync.

const APP_URL = Deno.env.get('APP_URL') ?? 'https://axiostock.com'
const ADMIN_URL = Deno.env.get('ADMIN_URL') ?? APP_URL
const LOGO_URL = `${APP_URL}/logo3.png`

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending:    'Pendiente',
  processing: 'En Proceso',
  shipped:    'Enviado',
  delivered:  'Entregado',
  cancelled:  'Cancelado',
}

const STATUS_EMOJI: Record<string, string> = {
  pending:    '⏳',
  processing: '⚙️',
  shipped:    '🚚',
  delivered:  '✅',
  cancelled:  '❌',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; muted: string; description: string }> = {
  pending:    { bg: '#fffbeb', text: '#d97706', muted: '#b45309', description: 'Tu pedido fue recibido y está esperando ser procesado.' },
  processing: { bg: '#eff6ff', text: '#2563eb', muted: '#1d4ed8', description: 'Tu pedido está siendo preparado. Pronto estará listo.' },
  shipped:    { bg: '#f0fdf4', text: '#16a34a', muted: '#15803d', description: 'Tu pedido fue despachado y está en camino.' },
  delivered:  { bg: '#f0fdf4', text: '#15803d', muted: '#166534', description: '¡Tu pedido fue entregado exitosamente! Gracias por tu compra.' },
  cancelled:  { bg: '#fef2f2', text: '#dc2626', muted: '#b91c1c', description: 'Tu pedido fue cancelado. Si tenés dudas, contactanos.' },
}

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? STATUS_COLORS['pending']
}

// ─── Shared layout helpers ────────────────────────────────────────────────────

function header(storeName?: string) {
  const label = storeName ?? 'Axios'
  return `
    <tr>
      <td style="background-color:#12192C;border-radius:16px 16px 0 0;padding:28px 40px;text-align:center;">
        <img src="${LOGO_URL}" alt="Axios" width="44" height="44"
          style="display:inline-block;vertical-align:middle;border-radius:10px;margin-right:12px;" />
        <span style="display:inline-block;vertical-align:middle;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${label}</span>
      </td>
    </tr>`
}

function footer() {
  return `
    <tr>
      <td style="background-color:#f8fafc;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">Este email fue enviado automáticamente por</p>
        <p style="margin:0;font-size:12px;color:#64748b;font-weight:600;">Axios · <a href="${APP_URL}" style="color:#2563eb;text-decoration:none;">axiostock.com</a></p>
      </td>
    </tr>`
}

function wrapper(rows: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          ${rows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── 1) new_order ─────────────────────────────────────────────────────────────

export interface NewOrderVars {
  storeName: string
  orderIdShort: string
  orderId: string
  total: string | number
  statusLabel: string
  createdAt: string
}

export function renderNewOrder(v: NewOrderVars): string {
  return wrapper(`
    ${header(v.storeName)}
    <tr>
      <td style="background-color:#2563eb;padding:20px 40px;text-align:center;">
        <span style="font-size:32px;">🛒</span>
        <h1 style="margin:8px 0 4px;color:#ffffff;font-size:20px;font-weight:700;">¡Nueva orden recibida!</h1>
        <p style="margin:0;color:#bfdbfe;font-size:13px;">${v.storeName}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:36px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;color:#60a5fa;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Orden</p>
              <p style="margin:0;font-size:18px;font-weight:700;color:#1e3a8a;font-family:monospace;">#${v.orderIdShort}</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="50%" style="padding:0 8px 16px 0;vertical-align:top;">
              <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Total</p>
              <p style="margin:0;font-size:22px;font-weight:700;color:#15803d;">$&nbsp;${v.total}</p>
            </td>
            <td width="50%" style="padding:0 0 16px 8px;vertical-align:top;">
              <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Estado</p>
              <p style="margin:0;"><span style="display:inline-block;background-color:#dcfce7;color:#166534;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;">${v.statusLabel}</span></p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border-top:1px solid #f1f5f9;padding-top:16px;">
              <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Fecha y hora</p>
              <p style="margin:0;font-size:14px;color:#334155;">${v.createdAt}</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
          <tr>
            <td align="center">
              <a href="${ADMIN_URL}/orders/${v.orderId}"
                style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
                Ver orden →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${footer()}
  `)
}

// ─── 2) low_stock ─────────────────────────────────────────────────────────────

export interface LowStockVars {
  storeName: string
  productName: string
  variantName?: string | null
  branchName: string
  stock: number
  threshold: number
}

export function renderLowStock(v: LowStockVars): string {
  const variantRow = v.variantName
    ? `<p style="margin:4px 0 0;font-size:13px;color:#78716c;">Variante: ${v.variantName}</p>`
    : ''

  return wrapper(`
    ${header(v.storeName)}
    <tr>
      <td style="background-color:#d97706;padding:20px 40px;text-align:center;">
        <span style="font-size:32px;">⚠️</span>
        <h1 style="margin:8px 0 4px;color:#ffffff;font-size:20px;font-weight:700;">Stock bajo detectado</h1>
        <p style="margin:0;color:#fef3c7;font-size:13px;">${v.storeName}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:36px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:11px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Producto</p>
              <p style="margin:0;font-size:18px;font-weight:700;color:#1e293b;">${v.productName}</p>
              ${variantRow}
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
              <div style="background-color:#fef2f2;border-radius:10px;padding:16px 20px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;color:#fca5a5;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Stock actual</p>
                <p style="margin:0;font-size:36px;font-weight:800;color:#dc2626;line-height:1;">${v.stock}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#f87171;">unidades</p>
              </div>
            </td>
            <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
              <div style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Umbral mínimo</p>
                <p style="margin:0;font-size:36px;font-weight:800;color:#64748b;line-height:1;">${v.threshold}</p>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">unidades</p>
              </div>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Sucursal</p>
              <p style="margin:0;font-size:14px;color:#334155;font-weight:600;">📍 ${v.branchName}</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <a href="${ADMIN_URL}/inventory"
                style="display:inline-block;background-color:#d97706;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
                Gestionar inventario →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${footer()}
  `)
}

// ─── 3) order_status_customer ─────────────────────────────────────────────────

export interface OrderStatusVars {
  storeName: string
  storeSlug: string
  customerName: string
  orderIdShort: string
  newStatus: string
}

export function renderOrderStatus(v: OrderStatusVars): string {
  const style = getStatusStyle(v.newStatus)
  const label = STATUS_LABELS[v.newStatus] ?? v.newStatus
  const emoji = STATUS_EMOJI[v.newStatus] ?? '📦'
  const storeUrl = `${APP_URL}/${v.storeSlug}`

  return wrapper(`
    ${header(v.storeName)}
    <tr>
      <td style="background-color:#2563eb;padding:20px 40px;text-align:center;">
        <span style="font-size:32px;">${emoji}</span>
        <h1 style="margin:8px 0 4px;color:#ffffff;font-size:20px;font-weight:700;">Tu orden fue actualizada</h1>
        <p style="margin:0;color:#bfdbfe;font-size:13px;">Hola, ${v.customerName}</p>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:36px 40px;">
        <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
          Tenemos novedades sobre tu pedido. A continuación encontrás el estado actualizado:
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
          <tr>
            <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
              <div style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:11px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Orden</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:#1e293b;font-family:monospace;">#${v.orderIdShort}</p>
              </div>
            </td>
            <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
              <div style="background-color:${style.bg};border-radius:10px;padding:16px 20px;text-align:center;">
                <p style="margin:0 0 4px;font-size:11px;color:${style.muted};font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Nuevo estado</p>
                <p style="margin:0;font-size:15px;font-weight:800;color:${style.text};">${label}</p>
              </div>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
          <tr>
            <td style="background-color:#f8fafc;border-left:4px solid ${style.text};border-radius:0 8px 8px 0;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.5;">${style.description}</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
          <tr>
            <td align="center">
              <a href="${storeUrl}"
                style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;">
                Visitar tienda →
              </a>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                Si tenés dudas, contactanos respondiendo este email o a través de nuestra tienda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${footer()}
  `)
}

export { STATUS_LABELS }
