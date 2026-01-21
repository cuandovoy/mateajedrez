import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { X, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatBarcode } from '@/lib/barcode'
import type { ProductBarcode } from '@/types'

interface BarcodePrintViewProps {
  barcodes: ProductBarcode[]
  productName?: string
  variantName?: string
  onClose: () => void
}

export function BarcodePrintView({
  barcodes,
  productName,
  variantName,
  onClose,
}: BarcodePrintViewProps) {
  const barcodeRefs = useRef<(SVGSVGElement | null)[]>([])

  useEffect(() => {
    // Generate barcode images for each barcode
    barcodes.forEach((barcode, index) => {
      const svgElement = barcodeRefs.current[index]
      if (svgElement && barcode.barcode) {
        try {
          JsBarcode(svgElement, barcode.barcode, {
            format: 'EAN13',
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 16,
            margin: 10,
            background: '#ffffff',
            lineColor: '#000000',
          })
        } catch (error) {
          console.error('Error generating barcode:', error)
        }
      }
    })
  }, [barcodes])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Imprimir Códigos de Barras</CardTitle>
            <div className="flex items-center space-x-2">
              <Button onClick={handlePrint} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Print-only styles */}
          <style>{`
            @media print {
              @page {
                size: A4;
                margin: 1cm;
              }
              body * {
                visibility: hidden;
              }
              .print-area, .print-area * {
                visibility: visible;
              }
              .print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 0;
              }
              .no-print {
                display: none !important;
              }
              .barcode-label {
                page-break-inside: avoid;
                break-inside: avoid;
                margin-bottom: 1cm;
                border: 1px solid #000;
                padding: 0.5cm;
              }
              .barcode-svg {
                max-width: 100%;
                height: auto;
              }
            }
          `}</style>

          <div className="print-area space-y-6">
            {barcodes.map((barcode, index) => (
              <div
                key={barcode.id || index}
                className="barcode-label border border-gray-300 p-4 rounded-lg bg-white flex flex-col items-center justify-center"
                style={{ minHeight: '200px' }}
              >
                {/* Product/Variant Info */}
                {(productName || variantName) && (
                  <div className="mb-4 text-center">
                    {productName && (
                      <div className="font-semibold text-lg text-gray-900 mb-1">{productName}</div>
                    )}
                    {variantName && (
                      <div className="text-sm text-gray-600">{variantName}</div>
                    )}
                  </div>
                )}

                {/* Barcode SVG */}
                <div className="flex justify-center mb-3 flex-grow flex items-center">
                  <svg
                    ref={(el) => {
                      barcodeRefs.current[index] = el
                    }}
                    className="barcode-svg"
                  />
                </div>

                {/* Barcode Number */}
                <div className="text-center mt-2">
                  <div className="font-mono text-lg font-semibold text-gray-900">
                    {formatBarcode(barcode.barcode, 'EAN13')}
                  </div>
                  {barcode.notes && (
                    <div className="text-xs text-gray-500 mt-1">{barcode.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons (hidden when printing) */}
          <div className="no-print mt-6 flex space-x-4">
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
