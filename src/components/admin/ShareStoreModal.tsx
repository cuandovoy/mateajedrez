import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check, Download } from 'lucide-react'
import QRCode from 'qrcode'

interface ShareStoreModalProps {
  storeUrl: string
  storeName: string
  onClose: () => void
}

export function ShareStoreModal({ storeUrl, storeName, onClose }: ShareStoreModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    // Color del QR fijo en el navy de marca (admin-900) — la librería QRCode
    // no acepta clases Tailwind, solo valores hex directos.
    QRCode.toCanvas(canvasRef.current, storeUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#1c1d33', light: '#ffffff' },
    })
  }, [storeUrl])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(storeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadQR = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `qr-tienda-${storeName.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Compartir tienda</h2>
            <p className="text-xs text-gray-500 mt-0.5">{storeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* QR */}
        <div className="flex flex-col items-center gap-3 px-5 py-6">
          <div className="rounded-xl border border-gray-200 p-3 bg-white shadow-sm">
            <canvas ref={canvasRef} />
          </div>
          <p className="text-xs text-gray-400 text-center">
            Escaneá el código para abrir la tienda
          </p>
        </div>

        {/* Link */}
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <span className="flex-1 text-sm text-gray-700 truncate font-mono">{storeUrl}</span>
            <button
              onClick={handleCopy}
              className="shrink-0 p-1 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
              title="Copiar link"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>

          <button
            onClick={handleDownloadQR}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <Download className="h-4 w-4" />
            Descargar QR
          </button>
        </div>
      </div>
    </div>
  )
}
