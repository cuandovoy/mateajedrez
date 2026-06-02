import { useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Download, Loader2, Package, Upload, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { Branch } from '@/types'

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

interface ParsedRow {
  rowIndex: number
  nombre: string
  sku: string
  precio: number | null
  descripcion: string
  stockInicial: number
  categoria: string
  activo: boolean
  errors: string[]
  isNewCategory: boolean
}

interface ImportResult {
  imported: number
  skipped: number
  categoriesCreated: number
}

interface ProductImportModalProps {
  organizationId: string
  branches: Branch[]
  onClose: () => void
  onImported: () => void
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────
// Handles BOM, CRLF, quoted fields (with commas/newlines inside), escaped quotes ("")

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function parseCSV(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = cleaned.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
}

// ──────────────────────────────────────────────────────────────────────────────

export function ProductImportModal({ organizationId, branches, onClose, onImported }: ProductImportModalProps) {
  const { show } = useToastStore()
  const [step, setStep] = useState<ImportStep>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? '')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importStatus, setImportStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set())
  const [existingCategories, setExistingCategories] = useState<Map<string, string>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      const [skusRes, catsRes] = await Promise.all([
        supabase.from('products').select('sku').eq('organization_id', organizationId),
        supabase.from('categories').select('id, name').eq('organization_id', organizationId),
      ])
      setExistingSkus(new Set(
        (skusRes.data ?? []).map((p: { sku: string }) => p.sku.toLowerCase())
      ))
      setExistingCategories(new Map(
        (catsRes.data ?? []).map((c: { id: string; name: string }) => [c.name.toLowerCase(), c.id])
      ))
      setLoadingData(false)
    }
    fetchData()
  }, [organizationId])

  const downloadTemplate = () => {
    const rows = [
      'nombre,sku,precio,descripcion,stock_inicial,categoria,activo',
      'Camiseta básica,CAM-001,1500,Camiseta de algodón 100%,10,Ropa,si',
      'Pantalón slim fit,PAN-001,2500,,5,Ropa,si',
      'Zapatilla running,ZAP-001,3800,Ideal para correr,0,Calzado,si',
    ]
    const csv = '﻿' + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_productos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      show('Solo se aceptan archivos .csv', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rawRows = parseCSV(text)
      if (rawRows.length === 0) {
        show('El archivo no tiene filas de datos o el formato no es válido.', 'error')
        return
      }

      const seenSkus = new Set<string>()
      const rows: ParsedRow[] = rawRows.map((raw, idx) => {
        const errors: string[] = []
        const nombre = raw.nombre?.trim() ?? ''
        const sku = raw.sku?.trim() ?? ''
        const precioRaw = raw.precio?.trim() ?? ''
        const descripcion = raw.descripcion?.trim() ?? ''
        const stockRaw = raw.stock_inicial?.trim() ?? '0'
        const categoria = raw.categoria?.trim() ?? ''
        const activoRaw = (raw.activo?.trim() ?? 'si').toLowerCase()

        if (!nombre) errors.push('Nombre requerido')
        if (!sku) errors.push('SKU requerido')

        let precio: number | null = null
        if (!precioRaw) {
          errors.push('Precio requerido')
        } else {
          precio = parseFloat(precioRaw.replace(',', '.'))
          if (isNaN(precio) || precio < 0) { errors.push('Precio inválido'); precio = null }
        }

        let stockInicial = parseInt(stockRaw, 10)
        if (isNaN(stockInicial) || stockInicial < 0) stockInicial = 0

        if (sku) {
          const skuLower = sku.toLowerCase()
          if (seenSkus.has(skuLower)) {
            errors.push('SKU repetido en el archivo')
          } else if (existingSkus.has(skuLower)) {
            errors.push('SKU ya existe en la tienda')
          } else {
            seenSkus.add(skuLower)
          }
        }

        const isNewCategory = categoria !== '' && !existingCategories.has(categoria.toLowerCase())
        const activo = activoRaw !== 'no'

        return {
          rowIndex: idx + 1,
          nombre,
          sku,
          precio,
          descripcion,
          stockInicial,
          categoria,
          activo,
          errors,
          isNewCategory,
        }
      })

      setParsedRows(rows)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }, [existingSkus, existingCategories, show])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.errors.length === 0)
    if (validRows.length === 0) return

    setStep('importing')

    try {
      // 1. Create new categories
      const newCatNames = [...new Set(
        validRows.filter(r => r.isNewCategory && r.categoria).map(r => r.categoria)
      )]

      const categoryMap = new Map(existingCategories)

      if (newCatNames.length > 0) {
        setImportStatus('Creando categorías...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCats, error } = await (supabase as any)
          .from('categories')
          .insert(newCatNames.map(name => ({ name, slug: slugify(name), organization_id: organizationId })))
          .select('id, name')
        if (error) throw error
        for (const c of (newCats ?? []) as { id: string; name: string }[]) {
          categoryMap.set(c.name.toLowerCase(), c.id)
        }
      }

      // 2. Batch insert products
      // stock: 0 here — the DB trigger create_inventory_for_product fires on INSERT
      // and creates branch_inventory rows (stock=0) for every active branch.
      // We set the real stock in step 4 by updating only the selected branch.
      setImportStatus('Importando productos...')
      const productInserts = validRows.map(row => ({
        name: row.nombre,
        sku: row.sku,
        price: row.precio!,
        description: row.descripcion || null,
        category_id: row.categoria ? (categoryMap.get(row.categoria.toLowerCase()) ?? null) : null,
        is_active: row.activo,
        stock: 0,
        organization_id: organizationId,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertError } = await (supabase as any)
        .from('products')
        .insert(productInserts)
        .select('id, sku')
      if (insertError) throw insertError

      const insertedProducts = (inserted ?? []) as { id: string; sku: string }[]
      const productIdBySku = new Map(insertedProducts.map(p => [p.sku.toLowerCase(), p.id]))

      // 3. product_categories junction table
      const pcInserts = validRows
        .filter(r => r.categoria && categoryMap.has(r.categoria.toLowerCase()))
        .map(r => ({
          product_id: productIdBySku.get(r.sku.toLowerCase())!,
          category_id: categoryMap.get(r.categoria.toLowerCase())!,
          organization_id: organizationId,
        }))
        .filter(r => r.product_id)

      if (pcInserts.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('product_categories').insert(pcInserts)
      }

      // 4. Stock: update only the selected branch's branch_inventory rows.
      // The trigger already created them with stock=0; we just set the right value.
      const rowsWithStock = validRows.filter(r => r.stockInicial > 0)
      if (rowsWithStock.length > 0 && selectedBranchId) {
        setImportStatus('Cargando inventario...')

        const productIdsWithStock = rowsWithStock
          .map(r => productIdBySku.get(r.sku.toLowerCase()))
          .filter(Boolean) as string[]

        const { data: biRows } = await supabase
          .from('branch_inventory')
          .select('id, product_id, stock')
          .eq('branch_id', selectedBranchId)
          .in('product_id', productIdsWithStock)
          .is('variant_id', null)

        const biByProductId = new Map(
          ((biRows ?? []) as { id: string; product_id: string; stock: number }[])
            .map(r => [r.product_id, r])
        )

        const movementInserts: object[] = []
        for (const row of rowsWithStock) {
          const productId = productIdBySku.get(row.sku.toLowerCase())
          if (!productId) continue
          const bi = biByProductId.get(productId)
          if (!bi) continue

          await supabase
            .from('branch_inventory')
            .update({ stock: row.stockInicial })
            .eq('id', bi.id)

          movementInserts.push({
            branch_inventory_id: bi.id,
            movement_type: 'receipt',
            quantity: row.stockInicial,
            previous_stock: 0,
            new_stock: row.stockInicial,
            reference_type: 'receipt',
            notes: 'Stock cargado en importación masiva',
          })
        }

        if (movementInserts.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('inventory_movements').insert(movementInserts)
        }
      }

      setImportResult({
        imported: validRows.length,
        skipped: parsedRows.filter(r => r.errors.length > 0).length,
        categoriesCreated: newCatNames.length,
      })
      setStep('done')
      onImported()
    } catch (err) {
      console.error('Error importing products:', err)
      show('Error durante la importación. Revisá los datos e intentá de nuevo.', 'error')
      setStep('preview')
    }
  }

  const validCount = parsedRows.filter(r => r.errors.length === 0).length
  const errorCount = parsedRows.filter(r => r.errors.length > 0).length
  const newCatCount = parsedRows.filter(r => r.isNewCategory && r.errors.length === 0).length
  const hasStock = parsedRows.some(r => r.stockInicial > 0 && r.errors.length === 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-admin-600" />
            <h2 className="text-base font-semibold text-gray-900">Importar productos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── UPLOAD ── */}
          {step === 'upload' && (
            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  1. Descargá la plantilla y completá los datos en Excel o Google Sheets
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar plantilla .csv
                </Button>
                <p className="mt-2 text-xs text-gray-400">
                  Abrí el archivo, completá los productos, guardá como CSV y volvé acá para subirlo.
                </p>
              </div>

              <div className="border-t border-gray-100" />

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  2. Subí el archivo completado
                </p>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                    dragOver
                      ? 'border-admin-400 bg-admin-50'
                      : 'border-gray-200 hover:border-admin-300 hover:bg-gray-50',
                    loadingData && 'pointer-events-none opacity-60'
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !loadingData && fileInputRef.current?.click()}
                >
                  {loadingData
                    ? <Loader2 className="h-10 w-10 mx-auto mb-3 text-gray-300 animate-spin" />
                    : <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  }
                  <p className="text-sm font-medium text-gray-600">
                    {loadingData ? 'Cargando datos...' : 'Arrastrá tu archivo o hacé click para seleccionar'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Solo archivos .csv</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Column reference */}
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-600">
                <p className="font-medium mb-2 text-gray-700">Columnas de la plantilla:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">nombre</code> — requerido</span>
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">stock_inicial</code> — opcional (0 si vacío)</span>
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">sku</code> — requerido, único</span>
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">categoria</code> — opcional (se crea si no existe)</span>
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">precio</code> — requerido, número</span>
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">activo</code> — <code>si</code> / <code>no</code> (default: si)</span>
                  <span><code className="font-mono text-gray-800 bg-gray-100 px-1 rounded">descripcion</code> — opcional</span>
                </div>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {step === 'preview' && (
            <div>
              {/* Summary bar */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-700 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  {validCount} listo{validCount !== 1 ? 's' : ''}
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-medium">
                    <XCircle className="h-4 w-4" />
                    {errorCount} con error{errorCount !== 1 ? 'es' : ''} (se saltarán)
                  </span>
                )}
                {newCatCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    {newCatCount} categoría{newCatCount !== 1 ? 's' : ''} nueva{newCatCount !== 1 ? 's' : ''} (se crearán)
                  </span>
                )}
              </div>

              {/* Branch selector */}
              {hasStock && branches.length > 0 && (
                <div className="px-6 py-3 border-b border-amber-100 bg-amber-50 flex flex-wrap items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 flex-1">
                    Algunos productos tienen stock inicial. ¿A qué sucursal se carga?
                  </p>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="text-sm border border-amber-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs w-10">#</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs w-8" />
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs">Nombre</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs">SKU</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-500 text-xs">Precio</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs">Categoría</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-500 text-xs">Stock</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => {
                      const hasError = row.errors.length > 0
                      return (
                        <tr
                          key={row.rowIndex}
                          className={cn(
                            'border-b border-gray-50',
                            hasError ? 'bg-red-50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="px-3 py-2 text-gray-400 text-xs">{row.rowIndex}</td>
                          <td className="px-3 py-2">
                            {hasError
                              ? <XCircle className="h-4 w-4 text-red-400" />
                              : <CheckCircle className="h-4 w-4 text-green-500" />
                            }
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900 max-w-[180px]">
                            <span className="block truncate">{row.nombre || <span className="text-gray-300">—</span>}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-600 text-xs whitespace-nowrap">
                            {row.sku || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">
                            {row.precio != null
                              ? `$${row.precio.toLocaleString('es-UY')}`
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {row.categoria
                              ? (
                                <span className="flex items-center gap-1.5">
                                  {row.categoria}
                                  {row.isNewCategory && !hasError && (
                                    <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                                      Nueva
                                    </span>
                                  )}
                                </span>
                              )
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {row.stockInicial > 0 ? row.stockInicial : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-red-600 text-xs whitespace-nowrap">
                            {row.errors.join(' · ')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Loader2 className="h-12 w-12 text-admin-600 animate-spin mb-5" />
              <p className="text-base font-medium text-gray-700">{importStatus}</p>
              <p className="text-sm text-gray-400 mt-1">Esto puede tomar unos segundos...</p>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && importResult && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-3">¡Importación completada!</p>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p className="text-green-700 font-medium">
                  {importResult.imported} producto{importResult.imported !== 1 ? 's' : ''} importado{importResult.imported !== 1 ? 's' : ''}
                </p>
                {importResult.categoriesCreated > 0 && (
                  <p className="text-amber-600">
                    {importResult.categoriesCreated} categoría{importResult.categoriesCreated !== 1 ? 's' : ''} creada{importResult.categoriesCreated !== 1 ? 's' : ''}
                  </p>
                )}
                {importResult.skipped > 0 && (
                  <p className="text-red-500">
                    {importResult.skipped} fila{importResult.skipped !== 1 ? 's' : ''} saltada{importResult.skipped !== 1 ? 's' : ''} por errores
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0">
          {step === 'upload' && (
            <Button variant="outline" onClick={onClose} className="ml-auto">
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')}>
                ← Volver
              </Button>
              {errorCount > 0 && validCount > 0 && (
                <p className="text-xs text-amber-600">
                  Las {errorCount} filas con errores se saltarán
                </p>
              )}
              <Button
                className="ml-auto"
                onClick={handleImport}
                disabled={validCount === 0}
              >
                Importar {validCount} producto{validCount !== 1 ? 's' : ''} →
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button className="ml-auto" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
