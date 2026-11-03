import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getProductStock, getProductsStock, getStorefrontBranchId } from './stock'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}))

const mockRpc = vi.mocked(supabase.rpc as any)

// Helper para mockear el builder pattern encadenado de Supabase.
// El objeto es thenable para que `await query` resuelva a `result`.
function createQueryMock(result: { data: any; error: any }) {
  const mock: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return mock
}

// ─── getProductStock ──────────────────────────────────────────────────────────

describe('getProductStock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna el stock cuando RPC tiene éxito', async () => {
    mockRpc.mockResolvedValueOnce({ data: 42, error: null })
    expect(await getProductStock('prod-1')).toBe(42)
  })

  it('retorna 0 cuando data es null', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getProductStock('prod-1')).toBe(0)
  })

  it('retorna 0 en error que no es de red', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } })
    expect(await getProductStock('prod-1')).toBe(0)
    expect(mockRpc).toHaveBeenCalledTimes(1) // sin reintento
  })

  it('reintenta en error de red y retorna el stock del segundo intento', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      .mockResolvedValueOnce({ data: 10, error: null })

    const promise = getProductStock('prod-1')
    await vi.runAllTimersAsync()
    expect(await promise).toBe(10)
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it('retorna 0 cuando todos los reintentos de red se agotan', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } })

    const promise = getProductStock('prod-1')
    await vi.runAllTimersAsync()
    expect(await promise).toBe(0)
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it('pasa todos los parámetros al RPC correctamente', async () => {
    mockRpc.mockResolvedValueOnce({ data: 5, error: null })
    await getProductStock('prod-1', 'var-1', 'branch-1', 'org-1')
    expect(mockRpc).toHaveBeenCalledWith('get_product_stock', {
      p_product_id: 'prod-1',
      p_variant_id: 'var-1',
      p_branch_id: 'branch-1',
      p_organization_id: 'org-1',
    })
  })
})

// ─── getProductsStock ─────────────────────────────────────────────────────────

describe('getProductsStock', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna {} para array vacío sin llamar al RPC', async () => {
    expect(await getProductsStock([])).toEqual({})
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('mapea correctamente los items retornados', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { product_id: 'prod-1', stock: 5 },
        { product_id: 'prod-2', stock: 3 },
      ],
      error: null,
    })
    expect(await getProductsStock(['prod-1', 'prod-2'])).toEqual({
      'prod-1': 5,
      'prod-2': 3,
    })
  })

  it('toma el máximo en caso de duplicados por product_id', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { product_id: 'prod-1', stock: 3 },
        { product_id: 'prod-1', stock: 7 },
        { product_id: 'prod-1', stock: 5 },
      ],
      error: null,
    })
    expect((await getProductsStock(['prod-1']))['prod-1']).toBe(7)
  })

  it('ignora items sin product_id', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { product_id: null, stock: 5 },
        { product_id: 'prod-1', stock: 3 },
      ],
      error: null,
    })
    const result = await getProductsStock(['prod-1'])
    expect(result).toEqual({ 'prod-1': 3 })
  })

  it('retorna {} en error de RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } })
    expect(await getProductsStock(['prod-1'])).toEqual({})
  })

  it('retorna {} cuando data es null sin error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await getProductsStock(['prod-1'])).toEqual({})
  })
})

// ─── getStorefrontBranchId ────────────────────────────────────────────────────

describe('getStorefrontBranchId', () => {
  const mockFrom = vi.mocked(supabase.from)

  // IDs únicos por test para evitar colisiones con la cache de módulo
  let orgCounter = 0
  const nextOrgId = () => `org-test-${++orgCounter}-${Date.now()}`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resuelve la sucursal con el RPC resolve_storefront_branch_id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'branch-rpc', error: null })
    const orgId = nextOrgId()
    expect(await getStorefrontBranchId(orgId)).toBe('branch-rpc')
    expect(mockRpc).toHaveBeenCalledWith('resolve_storefront_branch_id', {
      p_organization_id: orgId,
      p_exclude_isolated_warehouses: true,
    })
  })

  it('propaga excludeIsolatedWarehouses=false al RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'branch-x', error: null })
    const orgId = nextOrgId()
    await getStorefrontBranchId(orgId, { excludeIsolatedWarehouses: false })
    expect(mockRpc).toHaveBeenCalledWith('resolve_storefront_branch_id', {
      p_organization_id: orgId,
      p_exclude_isolated_warehouses: false,
    })
  })

  it('usa la cache y no vuelve a llamar al RPC en la segunda llamada', async () => {
    const orgId = nextOrgId()
    mockRpc.mockResolvedValueOnce({ data: 'branch-cached', error: null })
    expect(await getStorefrontBranchId(orgId)).toBe('branch-cached')
    vi.clearAllMocks()
    expect(await getStorefrontBranchId(orgId)).toBe('branch-cached')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('cachea por separado según el flag: distinto excludeIsolatedWarehouses vuelve a consultar', async () => {
    const orgId = nextOrgId()
    mockRpc.mockResolvedValue({ data: 'branch-a', error: null })
    await getStorefrontBranchId(orgId)
    await getStorefrontBranchId(orgId, { excludeIsolatedWarehouses: false })
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it('retorna null y no cachea cuando el RPC devuelve null (sin sucursal resolvible)', async () => {
    const orgId = nextOrgId()
    mockRpc.mockResolvedValue({ data: null, error: null })
    expect(await getStorefrontBranchId(orgId)).toBeNull()
    await getStorefrontBranchId(orgId)
    expect(mockRpc).toHaveBeenCalledTimes(2)
  })

  it('retorna null sin consultar si no hay organizationId', async () => {
    expect(await getStorefrontBranchId(null)).toBeNull()
    expect(await getStorefrontBranchId(undefined)).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('hace fallback a la consulta legacy (MAIN) si el RPC falla', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } })
    mockFrom.mockReturnValueOnce(
      createQueryMock({ data: [{ id: 'branch-main' }], error: null }) as any
    )
    expect(await getStorefrontBranchId(nextOrgId())).toBe('branch-main')
  })

  it('en fallback legacy usa cualquier sucursal activa si no existe MAIN', async () => {
    mockRpc.mockRejectedValueOnce(new Error('network'))
    mockFrom
      .mockReturnValueOnce(createQueryMock({ data: [], error: null }) as any)
      .mockReturnValueOnce(createQueryMock({ data: [{ id: 'branch-fallback' }], error: null }) as any)
    expect(await getStorefrontBranchId(nextOrgId())).toBe('branch-fallback')
  })

  it('retorna null si el RPC y el fallback legacy fallan', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    mockFrom.mockReturnValueOnce(
      createQueryMock({ data: null, error: { message: 'connection error' } }) as any
    )
    expect(await getStorefrontBranchId(nextOrgId())).toBeNull()
  })
})
