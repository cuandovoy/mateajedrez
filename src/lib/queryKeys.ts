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
    header: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId, 'detail-header'] as const,
    stockByBranch: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId, 'stock'] as const,
    movements: (orgId: string, productId: string, page: number, type?: string) =>
      ['admin', orgId, 'products', productId, 'movements', page, type ?? 'all'] as const,
    detailTransfers: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId, 'transfers'] as const,
    purchaseItems: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId, 'purchase-items'] as const,
    sales: (orgId: string, productId: string, page: number) =>
      ['admin', orgId, 'products', productId, 'sales', page] as const,
    detailSuppliers: (orgId: string, productId: string) =>
      ['admin', orgId, 'products', productId, 'suppliers'] as const,
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

  // ─── ADMIN — ROLES Y MIEMBROS ────────────────────────────────────────────────
  roles: {
    /** All organization roles (for role list and dropdown options) */
    all: (orgId: string) => ['admin', orgId, 'roles'] as const,
    /** Organization members with their assigned role (for AdminUsers) */
    members: (orgId: string) => ['admin', orgId, 'roles', 'members'] as const,
    /** Permission keys granted to a specific role (for AdminRolesPermissions) */
    permissions: (orgId: string, roleId: string) => ['admin', orgId, 'roles', roleId, 'permissions'] as const,
  },
} as const
