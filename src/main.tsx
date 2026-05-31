import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemingProvider } from './contexts/ThemingProvider'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './ui/components/common/ErrorBoundary'
import './index.css'
import 'highlight.js/styles/github-dark.css'

const api = (window as any).electronAPI?.backend
if (api?.onEvent) {
  api.onEvent((event: string, data: any) => {
    console.debug('[Backend event]', event, data)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemingProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemingProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})