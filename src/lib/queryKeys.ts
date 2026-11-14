export const queryKeys = {
  // ─── TIENDA PÚBLICA ─────────────────────────────────────────────────────────
  store: {
    products: (orgId: string) => ['store', orgId, 'products'] as const,
    filteredProducts: (orgId: string, filters: object) =>
      ['store', orgId, 'products', 'filtered', filters] as const,
    categories: (orgId: string) => ['store', orgId, 'categories'] as const,
    product: (orgId: string, productId: string) =>
      ['store', orgId, 'products', productId] as const,
    productVariants: (orgId: string, productId: string) =>
      ['store', orgId, 'products', productId, 'variants'] as const,
    storefrontBranch: (orgId: string, excludeIsolated: boolean) =>
      ['store', orgId, 'storefront-branch', excludeIsolated] as const,
    cartGuard: (orgId: string, productIds: string[]) =>
      ['store', orgId, 'cart-guard', [...productIds].sort()] as const,
    categoryProducts: (orgId: string, slug: string, filters: object) =>
      ['store', orgId, 'categories', slug, 'products', filters] as const,
  },

  // ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────
  config: {
    paymentMethods: (orgId: string, includeInactive: boolean) =>
      ['config', orgId, 'payment-methods', includeInactive] as const,
  },
} as const
