import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

interface MessageContentProps {
  content: string
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
            return <pre className="code-block-wrapper">{children}</pre>
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className
            if (isInline) {
              return <code className="inline-code" {...props}>{children}</code>
            }
            return (
              <div className="code-block">
                {match && <div className="code-lang">{match[1]}</div>}
                <code className={className} {...props}>{children}</code>
              </div>
            )
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