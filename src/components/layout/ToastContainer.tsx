import { Toast } from '@/components/ui/Toast'
import { useToastStore } from '@/store/toastStore'

export function ToastContainer() {
  const { message, type, id, hide } = useToastStore()

  if (!message) return null

  // key={id} fuerza un remount por cada toast nuevo — sin esto, si un
  // segundo toast se dispara mientras el primero sigue visible, hereda el
  // timer en curso (useEffect de Toast no re-arranca) y puede desaparecer
  // mucho antes de los 3s normales.
  return <Toast key={id} message={message} type={type} onClose={hide} />
}
