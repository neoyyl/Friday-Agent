import { useState, useCallback } from 'react'
import type { Context, ReactNode } from 'react'
import type { Toast } from './ToastContext'

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: Toast['type'], duration?: number) => void
  dismissToast: (id: string) => void
}

export function ToastProviderInner({ context: ToastContext, children }: { context: Context<ToastContextType | null>; children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 3000) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, type, message, duration }])
      if (duration > 0) {
        setTimeout(() => dismissToast(id), duration)
      }
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => dismissToast(toast.id)}
          >
            <span className="toast-icon">
              {toast.type === 'success' && '\u2713'}
              {toast.type === 'error' && '\u2715'}
              {toast.type === 'warning' && '\u26A0'}
              {toast.type === 'info' && '\u2139'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}