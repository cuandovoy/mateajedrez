import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface POSBarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BarcodeDetector?: any
  }
}

export function POSBarcodeScanner({ onDetected, onClose }: POSBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [manualCode, setManualCode] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const isBarcodeAPISupported = 'BarcodeDetector' in window

  useEffect(() => {
    if (!isBarcodeAPISupported) return

    let detector: ReturnType<typeof window.BarcodeDetector>
    let cancelled = false

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'] })

        const scan = async () => {
          if (cancelled || !videoRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              onDetected(barcodes[0].rawValue)
              return
            }
          } catch {
            // ignorar errores de frame intermedio
          }
          rafRef.current = requestAnimationFrame(scan)
        }
        rafRef.current = requestAnimationFrame(scan)
      } catch {
        if (!cancelled) setCameraError('No se pudo acceder a la cámara. Usá el campo manual.')
      }
    }

    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [isBarcodeAPISupported, onDetected])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim()
    if (code) {
      onDetected(code)
      setManualCode('')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <p className="text-white text-sm font-medium">Escaneá un código</p>
        <button onClick={onClose} className="text-white/70 hover:text-white p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Área de cámara o fallback */}
      {isBarcodeAPISupported && !cameraError ? (
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* visor */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-white/70 rounded-lg relative">
              <span className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-admin-400 rounded-tl" />
              <span className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-admin-400 rounded-tr" />
              <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-admin-400 rounded-bl" />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-admin-400 rounded-br" />
            </div>
          </div>
          <p className="absolute bottom-8 left-0 right-0 text-center text-white/70 text-xs">
            Apuntá al código de barras o QR
          </p>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm">
            {cameraError && (
              <p className="text-yellow-400 text-xs text-center mb-4">{cameraError}</p>
            )}
            {!isBarcodeAPISupported && (
              <p className="text-white/60 text-xs text-center mb-4">
                Tu navegador no soporta escáner de cámara. Escribí el código manualmente.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Input manual siempre visible */}
      <form onSubmit={handleManualSubmit} className="px-4 py-4 bg-black/80">
        <p className="text-white/50 text-xs mb-2">O ingresá el código manualmente</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Código de barras / SKU"
            autoFocus={!isBarcodeAPISupported || Boolean(cameraError)}
            className="flex-1 h-10 px-3 rounded-lg bg-white/10 text-white placeholder-white/40 border border-white/20 focus:outline-none focus:border-admin-400 text-sm"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="h-10 px-4 bg-admin-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            Buscar
          </button>
        </div>
      </form>
    </div>
  )
}
