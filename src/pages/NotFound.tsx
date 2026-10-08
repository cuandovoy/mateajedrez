import { EmptyState } from '@/components/ui/EmptyState'
import { FileQuestion } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'

// Reemplaza el redirect silencioso a "/" que usaba el catch-all de App.tsx.
// Ese patrón era un soft-404 clásico: la URL devolvía 200 + el shell genérico
// de la SPA sin ninguna señal de robots, lo que Google puede interpretar como
// contenido duplicado de la home en cualquier URL rota/inventada. Esta página
// vive dentro de PublicStoreWrapper (ver App.tsx) para mantener header/footer
// de la tienda, y agrega `noindex` con el mismo mecanismo que ya usa
// ProductDetail.tsx para "producto no encontrado".
export function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="container-custom py-8">
      <Helmet>
        <title>Página no encontrada | Mates Ajedrez</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <EmptyState
        icon={FileQuestion}
        title="Página no encontrada"
        description="La página que buscás no existe o fue movida. Volvé al inicio para seguir explorando la tienda."
        action={{ label: 'Volver al inicio', onClick: () => navigate('/') }}
      />
    </div>
  )
}
