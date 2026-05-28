import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemingProvider } from './contexts/ThemingProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemingProvider>
      <App />
    </ThemingProvider>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})