import { Toast } from '@/components/ui/Toast'
import { useToastStore } from '@/store/toastStore'

export function ToastContainer() {
  const { message, type, hide } = useToastStore()

  if (!message) return null

  return <Toast message={message} type={type} onClose={hide} />
}
