import { Input } from '@/components/ui/Input'

interface PriceRangeFilterProps {
  min: string
  max: string
  onMinChange: (min: string) => void
  onMaxChange: (max: string) => void
  label?: string
  currency?: string
}

export function PriceRangeFilter({
  min,
  max,
  onMinChange,
  onMaxChange,
  label = 'Rango de Precio',
}: PriceRangeFilterProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="space-y-2">
        <div>
          <Input
            type="number"
            placeholder="Precio mínimo"
            value={min}
            onChange={(e) => onMinChange(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <Input
            type="number"
            placeholder="Precio máximo"
            value={max}
            onChange={(e) => onMaxChange(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>
      </div>
    </div>
  )
}
