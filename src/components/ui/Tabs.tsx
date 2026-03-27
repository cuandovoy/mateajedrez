// src/components/ui/Tabs.tsx
// Tabs component for tabbed interfaces

import { useState, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

interface TabsProps {
  defaultValue: string
  children: React.ReactNode
  className?: string
  onValueChange?: (value: string) => void
  orientation?: 'horizontal' | 'vertical'
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface TabsContextType {
  value: string
  onChange: (value: string) => void
  orientation: 'horizontal' | 'vertical'
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

function useTabs() {
  const context = useContext(TabsContext)
  if (!context) throw new Error('useTabs must be used within Tabs')
  return context
}

export function Tabs({ defaultValue, children, className, onValueChange, orientation = 'horizontal' }: TabsProps) {
  const [value, setValueState] = useState(defaultValue)

  const onChange = (v: string) => {
    setValueState(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value, onChange, orientation }}>
      <div className={cn(orientation === 'vertical' ? 'flex flex-row gap-0 overflow-hidden' : '', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: TabsListProps) {
  const { orientation } = useTabs()

  if (orientation === 'vertical') {
    return (
      <div
        className={cn(
          'flex flex-col shrink-0 w-44 border-r border-gray-200 bg-gray-50 rounded-l-lg py-2 px-2 gap-0.5 overflow-y-auto min-h-0',
          className
        )}
        role="tablist"
        aria-orientation="vertical"
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  )
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: selectedValue, onChange, orientation } = useTabs()
  const isSelected = selectedValue === value

  if (orientation === 'vertical') {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        onClick={() => onChange(value)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all text-left',
          isSelected
            ? 'bg-white text-admin-700 shadow-sm border border-gray-200'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          className
        )}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => onChange(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        isSelected
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: selectedValue, orientation } = useTabs()

  if (selectedValue !== value) return null

  return (
    <div
      role="tabpanel"
      className={cn(
        orientation === 'vertical' ? 'flex-1 min-w-0 min-h-0 overflow-y-auto' : 'mt-2',
        'ring-offset-background focus-visible:outline-none',
        className
      )}
    >
      {children}
    </div>
  )
}
