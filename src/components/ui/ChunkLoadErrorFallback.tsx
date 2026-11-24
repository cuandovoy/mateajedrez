import { RELOAD_FLAG_KEY } from '@/lib/chunkReload'

export function ChunkLoadErrorFallback() {
  const handleRetry = () => {
    try {
      window.sessionStorage.removeItem(RELOAD_FLAG_KEY)
    } catch {
      // Sin sessionStorage igual se puede recargar.
    }
    window.location.reload()
  }

  return (
    <div className="container-custom py-8">
      <div role="alert" className="rounded-md border border-brand-line bg-brand-crema px-4 py-6 text-center">
        <p className="mb-4 text-brand-tinta">No pudimos cargar esta sección. Revisá tu conexión.</p>
        <button
          type="button"
          onClick={handleRetry}
          className="h-10 rounded-full border border-brand-cuero bg-brand-cuero px-5 font-heading text-xs font-semibold uppercase tracking-[0.14em] text-brand-crema transition-colors hover:bg-brand-cuero-oscuro"
        >
          Reintentar
        </button>
      </div>
    </div>
  )
}
