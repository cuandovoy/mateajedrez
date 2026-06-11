export const queryKeys = {
  // ─── TIENDA PÚBLICA ─────────────────────────────────────────────────────────
  store: {
    products: (orgId: string) => ['store', orgId, 'products'] as const,
    filteredProducts: (orgId: string, filters: object) =>
      ['store', orgId, 'products', 'filtered', filters] as const,
    categories: (orgId: string) => ['store', orgId, 'categories'] as const,
    product: (orgId: string, productId: string) =>
      ['store', orgId, 'products', productId] as const,
    productVariants: (productId: string) =>
      ['store', 'products', productId, 'variants'] as const,
    categoryProducts: (orgId: string, slug: string, filters: object) =>
      ['store', orgId, 'categories', slug, 'products', filters] as const,
  },

  // ─── ADMIN — CATÁLOGO ───────────────────────────────────────────────────────
  products: {
    all: (orgId: string) => ['admin', orgId, 'products'] as const,
    list: (orgId: string, filters: object) =>
      ['admin', orgId, 'products', 'list', filters] as const,
    detail: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId] as const,
    variants: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId, 'variants'] as const,
  },
  categories: {
    all: (orgId: string) => ['admin', orgId, 'categories'] as const,
  },
  suppliers: {
    all: (orgId: string) => ['admin', orgId, 'suppliers'] as const,
  },
  branches: {
    all: (orgId: string) => ['admin', orgId, 'branches'] as const,
  },

  // ─── ADMIN — INVENTARIO ─────────────────────────────────────────────────────
  inventory: {
    all: (orgId: string) => ['admin', orgId, 'inventory'] as const,
    branch: (orgId: string, branchId: string, filters: object) =>
      ['admin', orgId, 'inventory', branchId, filters] as const,
    crossView: (orgId: string) => ['admin', orgId, 'inventory', 'cross'] as const,
    lots: (orgId: string) => ['admin', orgId, 'lots'] as const,
    transfers: (orgId: string) => ['admin', orgId, 'transfers'] as const,
  },

  // ─── ADMIN — ÓRDENES ────────────────────────────────────────────────────────
  orders: {
    all: (orgId: string) => ['admin', orgId, 'orders'] as const,
    list: (orgId: string, filters: object) =>
      ['admin', orgId, 'orders', 'list', filters] as const,
    detail: (orgId: string, orderId: string) =>
      ['admin', orgId, 'orders', orderId] as const,
  },

  // ─── ADMIN — CLIENTES ───────────────────────────────────────────────────────
  customers: {
    all: (orgId: string) => ['admin', orgId, 'customers'] as const,
    list: (orgId: string, filters: object) =>
      ['admin', orgId, 'customers', 'list', filters] as const,
    stats: (orgId: string) => ['admin', orgId, 'customers', 'stats'] as const,
    detail: (orgId: string, customerId: string) =>
      ['admin', orgId, 'customers', customerId] as const,
  },

  // ─── ADMIN — FINANZAS ───────────────────────────────────────────────────────
  expenses: {
    all: (orgId: string) => ['admin', orgId, 'expenses'] as const,
    purchaseOrders: (orgId: string, filters: object) =>
      ['admin', orgId, 'expenses', 'purchase-orders', filters] as const,
    ledger: (orgId: string, filters: object) =>
      ['admin', orgId, 'expenses', 'ledger', filters] as const,
  },
  reposicion: {
    items: (orgId: string, branchId: string) =>
      ['admin', orgId, 'reposicion', branchId] as const,
  },

  // ─── ADMIN — REPORTES ───────────────────────────────────────────────────────
  reports: {
    sales: (orgId: string, params: object) =>
      ['admin', orgId, 'reports', 'sales', params] as const,
    financial: (orgId: string, params: object) =>
      ['admin', orgId, 'reports', 'financial', params] as const,
    inventory: (orgId: string, params: object) =>
      ['admin', orgId, 'reports', 'inventory', params] as const,
    storeStats: (orgId: string, params: object) =>
      ['admin', orgId, 'reports', 'store-stats', params] as const,
    auditLogs: (orgId: string, params: object) =>
      ['admin', orgId, 'reports', 'audit-logs', params] as const,
  },

  // ─── ADMIN — DASHBOARD ──────────────────────────────────────────────────────
  dashboard: {
    money: (orgId: string, params: object) =>
      ['admin', orgId, 'dashboard', 'money', params] as const,
    operational: (orgId: string, params: object) =>
      ['admin', orgId, 'dashboard', 'operational', params] as const,
    trends: (orgId: string, params: object) =>
      ['admin', orgId, 'dashboard', 'trends', params] as const,
    lowStock: (orgId: string) => ['admin', orgId, 'dashboard', 'low-stock'] as const,
  },

  // ─── ADMIN — CAJA ───────────────────────────────────────────────────────────
  cashRegister: {
    sessions: (orgId: string, filters: object) =>
      ['admin', orgId, 'cash-sessions', filters] as const,
  },

  // ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────
  config: {
    billerConfig: (orgId: string) => ['config', orgId, 'biller'] as const,
    paymentMethods: (orgId: string, includeInactive: boolean) =>
      ['config', orgId, 'payment-methods', includeInactive] as const,
    planLimits: (orgId: string) => ['config', orgId, 'plan-limits'] as const,
  },

  // ─── ORGANIZACIONES DEL USUARIO ─────────────────────────────────────────────
  myOrganizations: {
    list: (userId: string) => ['my-organizations', userId] as const,
  },

  // ─── NOTIFICACIONES ─────────────────────────────────────────────────────────
  notifications: {
    list: (orgId: string) => ['notifications', orgId] as const,
  },
} as const
