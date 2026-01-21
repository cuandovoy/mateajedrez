import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import {
  formatBarcode,
  generateEAN13Barcode,
  validateBarcode,
  type BarcodeType,
} from '@/lib/barcode'
import { supabase } from '@/lib/supabase'
import type { ProductBarcode, ProductBarcodeInsert, ProductVariant } from '@/types'
import { Plus, Printer, Sparkles, Star, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BarcodePrintView } from './BarcodePrintView'

interface BarcodeManagerProps {
  productId?: string
  variantId?: string
  onClose: () => void
}

interface BarcodeItem {
  id?: string
  barcode: string
  barcode_type: BarcodeType
  is_primary: boolean
  notes?: string
}

export function BarcodeManager({ productId, variantId, onClose }: BarcodeManagerProps) {
  const [barcodes, setBarcodes] = useState<BarcodeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newBarcode, setNewBarcode] = useState({
    barcode: '',
    barcode_type: 'EAN13' as BarcodeType,
    notes: '',
  })
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [generating, setGenerating] = useState(false)
  const [showPrintView, setShowPrintView] = useState(false)
  const [printBarcodes, setPrintBarcodes] = useState<ProductBarcode[]>([])
  const [productName, setProductName] = useState<string>('')
  const [variantName, setVariantName] = useState<string>('')

  useEffect(() => {
    fetchBarcodes()
    fetchProductInfo()
  }, [productId, variantId])

  const fetchProductInfo = async () => {
    try {
      if (variantId) {
        const { data: variant, error: variantError }: { data: ProductVariant | null, error: Error | null } = await supabase
          .from('product_variants')
          .select('*')
          .eq('id', variantId)
          .single()

        if (!variantError && variant) {
          setVariantName(variant.name || '')
          
          // Fetch product name
          if (variant.product_id) {
            const { data: product, error: productError }: { data: { name: string } | null, error: Error | null } = await supabase
              .from('products')
              .select('name')
              .eq('id', variant.product_id)
              .single()

            if (!productError && product) {
              setProductName(product.name || '')
            }
          }
        }
      } else if (productId) {
        const { data: product, error }: { data: { name: string } | null, error: Error | null } = await supabase
          .from('products')
          .select('name')
          .eq('id', productId)
          .single()

        if (!error && product) {
          setProductName(product.name || '')
          setVariantName('')
        }
      }
    } catch (error) {
      console.error('Error fetching product info:', error)
    }
  }

  const fetchBarcodes = async () => {
    try {
      setLoading(true)
      let query = supabase.from('product_barcodes').select('*')

      if (variantId) {
        query = query.eq('variant_id', variantId)
      } else if (productId) {
        query = query.eq('product_id', productId)
      } else {
        setLoading(false)
        return
      }

      const { data, error }: { data: ProductBarcode[] | null, error: Error | null } = await query.order('is_primary', { ascending: false })

      if (error) throw error
      setBarcodes(
        (data || []).map((b) => ({
          id: b.id,
          barcode: b.barcode,
          barcode_type: b.barcode_type,
          is_primary: b.is_primary,
          notes: b.notes || '',
        }))
      )
    } catch (error) {
      console.error('Error fetching barcodes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateBarcode = async () => {
    try {
      setGenerating(true)
      
      // Get all existing barcodes from database to avoid duplicates
      const { data: allBarcodes }: { data: { barcode: string }[] | null } = await supabase
        .from('product_barcodes')
        .select('barcode')
      
      const existingBarcodes = [
        ...(allBarcodes?.map((b) => b.barcode) || []),
        ...barcodes.map((b) => b.barcode),
      ]

      // Generate new EAN13 barcode
      const newCode = generateEAN13Barcode('779', existingBarcodes)
      setNewBarcode({ ...newBarcode, barcode: newCode })
    } catch (error) {
      console.error('Error generating barcode:', error)
      alert('Error al generar el código de barras')
    } finally {
      setGenerating(false)
    }
  }

  const handleAddBarcode = () => {
    if (!newBarcode.barcode.trim()) {
      return
    }

    // Validate barcode (always EAN13)
    if (!validateBarcode(newBarcode.barcode, 'EAN13')) {
      alert('Código de barras EAN13 inválido. Debe tener 13 dígitos numéricos.')
      return
    }

    // Check for duplicates
    if (barcodes.some((b) => b.barcode === newBarcode.barcode)) {
      alert('Este código de barras ya existe')
      return
    }

    const newItem: BarcodeItem = {
      barcode: newBarcode.barcode.trim(),
      barcode_type: 'EAN13',
      is_primary: barcodes.length === 0, // First barcode is primary
      notes: newBarcode.notes.trim() || undefined,
    }

    setBarcodes([...barcodes, newItem])
    setNewBarcode({ barcode: '', barcode_type: 'EAN13', notes: '' })
  }

  const handleRemoveBarcode = (index: number) => {
    const newBarcodes = barcodes.filter((_, i) => i !== index)
    
    // If we removed the primary, make the first one primary
    if (barcodes[index].is_primary && newBarcodes.length > 0) {
      newBarcodes[0].is_primary = true
    }
    
    setBarcodes(newBarcodes)
  }

  const handleSetPrimary = (index: number) => {
    const newBarcodes = barcodes.map((b, i) => ({
      ...b,
      is_primary: i === index,
    }))
    setBarcodes(newBarcodes)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setErrors({})

      // Validate all barcodes (always EAN13)
      const validationErrors: Record<number, string> = {}
      barcodes.forEach((barcode, index) => {
        if (!validateBarcode(barcode.barcode, 'EAN13')) {
          validationErrors[index] = 'Formato de código de barras EAN13 inválido'
        }
      })

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        return
      }

      // Delete existing barcodes
      if (productId || variantId) {
        const { error: deleteError } = await supabase
          .from('product_barcodes')
          .delete()
          .or(
            productId
              ? `product_id.eq.${productId}`
              : `variant_id.eq.${variantId}`
          )

        if (deleteError) throw deleteError
      }

      // Insert new barcodes
      if (barcodes.length > 0) {
        const barcodesToInsert: ProductBarcodeInsert[] = barcodes.map((b) => ({
          product_id: productId || null,
          variant_id: variantId || null,
          barcode: b.barcode,
          barcode_type: b.barcode_type,
          is_primary: b.is_primary,
          notes: b.notes || null,
        }))

        const { error: insertError } = await supabase
          .from('product_barcodes')
          .insert(barcodesToInsert as never)

        if (insertError) throw insertError
      }

      onClose()
    } catch (error) {
      console.error('Error saving barcodes:', error)
      alert('Error al guardar los códigos de barras')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-admin-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestionar Códigos de Barras</CardTitle>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Barcodes */}
          {barcodes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Códigos de Barras Existentes
                </label>
                <Button
                  type="button"
                  onClick={() => {
                    const allBarcodes = barcodes.map((b) => ({
                      id: b.id,
                      product_id: productId || null,
                      variant_id: variantId || null,
                      barcode: b.barcode,
                      barcode_type: b.barcode_type,
                      is_primary: b.is_primary,
                      notes: b.notes || null,
                      created_at: '',
                      updated_at: '',
                    } as ProductBarcode))
                    setPrintBarcodes(allBarcodes)
                    setShowPrintView(true)
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Todos
                </Button>
              </div>
              {barcodes.map((barcode, index) => {
                return (
                  <div
                    key={index}
                    className="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {barcode.is_primary && (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Star className="h-3 w-3 mr-1" />
                            Principal
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          EAN-13
                        </span>
                      </div>
                      <div className="font-mono text-sm font-semibold">
                        {formatBarcode(barcode.barcode, 'EAN13')}
                      </div>
                      {barcode.notes && (
                        <div className="text-xs text-gray-500 mt-1">{barcode.notes}</div>
                      )}
                      {errors[index] && (
                        <div className="text-xs text-red-600 mt-1">{errors[index]}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          const singleBarcode = [{
                            id: barcode.id,
                            product_id: productId || null,
                            variant_id: variantId || null,
                            barcode: barcode.barcode,
                            barcode_type: barcode.barcode_type,
                            is_primary: barcode.is_primary,
                            notes: barcode.notes || null,
                            created_at: '',
                            updated_at: '',
                          }] as ProductBarcode[]
                          setPrintBarcodes(singleBarcode)
                          setShowPrintView(true)
                        }}
                        className="p-1 text-xs text-blue-600 hover:text-blue-800"
                        title="Imprimir este código"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(index)}
                        disabled={barcode.is_primary}
                        className="p-1 text-xs text-gray-600 hover:text-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Marcar como principal"
                      >
                        <Star
                          className={`h-4 w-4 ${
                            barcode.is_primary ? 'fill-yellow-400 text-yellow-400' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveBarcode(index)}
                        className="p-1 text-xs text-red-600 hover:text-red-800"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add New Barcode */}
          <div className="space-y-3 border-t pt-4">
            <label className="block text-sm font-medium text-gray-700">
              Agregar Nuevo Código de Barras EAN-13
            </label>
            <div className="flex space-x-2">
              <Input
                type="text"
                placeholder="Ingrese el código de barras EAN-13 (13 dígitos)"
                value={newBarcode.barcode}
                onChange={(e) => {
                  // Only allow numbers and limit to 13 digits
                  const value = e.target.value.replace(/\D/g, '').slice(0, 13)
                  setNewBarcode({ ...newBarcode, barcode: value })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddBarcode()
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleGenerateBarcode}
                variant="outline"
                isLoading={generating}
                title="Generar código automáticamente"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generar
              </Button>
            </div>
            <div>
              <Input
                type="text"
                placeholder="Notas (opcional)"
                value={newBarcode.notes}
                onChange={(e) => setNewBarcode({ ...newBarcode, notes: e.target.value })}
              />
            </div>
            <Button
              type="button"
              onClick={handleAddBarcode}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Código
            </Button>
            <p className="text-xs text-gray-500">
              EAN-13: Código de barras estándar de 13 dígitos. Use el botón "Generar" para crear uno automáticamente.
            </p>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-4 border-t">
            <Button type="button" onClick={handleSave} className="flex-1" isLoading={saving}>
              Guardar
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Print View */}
      {showPrintView && printBarcodes.length > 0 && (
        <BarcodePrintView
          barcodes={printBarcodes}
          productName={productName}
          variantName={variantName}
          onClose={() => {
            setShowPrintView(false)
            setPrintBarcodes([])
          }}
        />
      )}
    </div>
  )
}
