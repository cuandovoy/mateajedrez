import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { capitalizeFirst } from '@/lib/utils'
import type { Product } from '@/types'
import { VariantGrid } from './VariantGrid'

interface VariantManagerProps {
  product: Product
  onClose: () => void
}

export function VariantManager({ product, onClose }: VariantManagerProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle>Gestionar Variantes - {capitalizeFirst(product.name)}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <VariantGrid product={product} />
        </CardContent>
      </Card>
    </div>
  )
}
