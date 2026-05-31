import { useMemo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MessageContentProps {
  content: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }, [text])
  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute', top: '6px', right: '6px',
        padding: '3px 8px', borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(0,0,0,0.4)',
        color: copied ? '#22c55e' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer', fontSize: '10px', lineHeight: 1.4,
        transition: 'all 0.15s',
        zIndex: 1,
      }}
    >
      {copied ? '已复制' : '复制'}
    </button>
  )
}

interface CodeBlockProps {
  lang: string
  code: string
}

function CodeBlock({ lang, code }: CodeBlockProps) {
  return (
    <div className="code-block" style={{ position: 'relative' }}>
      {lang && (
        <div className="code-lang" style={{
          position: 'absolute', top: '6px', left: '10px',
          fontSize: '10px', color: 'rgba(255,255,255,0.4)',
          fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {lang}
        </div>
      )}
      <CopyButton text={code} />
      <pre style={{ paddingTop: lang ? '28px' : '12px' }}>
        <code className={`language-${lang}`}>{code}</code>
      </pre>
    </div>
  )
}

export function MessageContent({ content }: MessageContentProps) {
  const hasMarkdown = useMemo(() => {
    return /[#*`~>\\[\]|\\-]/.test(content)
  }, [content])

  if (!hasMarkdown) {
    return <span className="msg-text">{content}</span>
  }

  return (
    <div className="msg-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            return <>{children}</>
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className
            if (isInline) {
              return <code className="inline-code" {...props}>{children}</code>
            }
            const code = String(children).replace(/\n$/, '')
            const lang = match ? match[1] : ''
            return <CodeBlock lang={lang} code={code} />
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="msg-link">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}