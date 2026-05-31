import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { ToastProviderInner } from './ToastProviderInner'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (message: string, type?: Toast['type'], duration?: number) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProviderInner context={ToastContext}>
      {children}
    </ToastProviderInner>
  )
}