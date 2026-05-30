import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemingProvider } from './contexts/ThemingProvider'
import { ErrorBoundary } from './ui/components/common/ErrorBoundary'
import { initKernelEventListeners } from './stores/kernelStore'
import './index.css'

// 初始化 Kernel 事件监听
initKernelEventListeners()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemingProvider>
        <App />
      </ThemingProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})