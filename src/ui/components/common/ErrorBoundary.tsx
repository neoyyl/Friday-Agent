import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  panelName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.panelName ? `:${this.props.panelName}` : ''}]`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Panel-level fallback (compact)
      if (this.props.panelName) {
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            margin: '8px',
            borderRadius: '8px',
            border: '1px solid #ef444440',
            background: 'var(--bg, #1a1a2e)',
            color: 'var(--text, #e0e0e0)',
            fontFamily: 'system-ui, sans-serif',
            minHeight: '120px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '0.5rem' }}>⚠️</div>
            <p style={{
              margin: '0 0 0.75rem',
              color: 'var(--text-dim, #888)',
              fontSize: '12px',
              textAlign: 'center',
            }}>
              {this.props.panelName} 组件异常
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border, #333)',
                background: 'var(--bg-elevated, #2a2a4a)',
                color: 'var(--text, #e0e0e0)',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              重试
            </button>
          </div>
        )
      }

      // Full-page fallback
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: 'var(--bg, #1a1a2e)',
          color: 'var(--text, #e0e0e0)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>
            Something went wrong
          </h2>
          <p style={{
            margin: '0 0 1.5rem',
            color: 'var(--text-dim, #888)',
            maxWidth: '400px',
            textAlign: 'center',
          }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              border: '1px solid var(--border, #333)',
              background: 'var(--bg-elevated, #2a2a4a)',
              color: 'var(--text, #e0e0e0)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
