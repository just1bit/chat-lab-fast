import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../types'

interface Props {
  message: Message
  loading?: boolean
  streamStatus?: string | null
}

export default function MessageBubble({ message, loading, streamStatus }: Props) {
  const isUser = message.role === 'user'
  const isWaiting = !isUser && !message.content && loading

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-2 text-base ${
          isUser
            ? 'max-w-xl bg-indigo-600 text-white whitespace-pre-wrap'
            : 'max-w-3xl w-fit bg-slate-800 text-slate-100'
        }`}
      >
        {isUser ? (
          message.content
        ) : isWaiting ? (
          <span className="inline-flex items-center gap-1 text-slate-400 italic">
            <span className="loading-dots">
              <span className="dot">.</span>
              <span className="dot">.</span>
              <span className="dot">.</span>
            </span>
            {streamStatus && (
              <span className="ml-1 text-slate-500">{streamStatus}</span>
            )}
          </span>
        ) : message.content ? (
          <>
            {streamStatus && loading && (
              <div className="mb-1 text-xs text-slate-500 italic">{streamStatus}</div>
            )}
            <div className="prose prose-invert prose-base max-w-none">
              <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
            </div>
          </>
        ) : null}
        {!isUser && message.model && message.content && !loading && (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
            {message.provider} · {message.model}
          </div>
        )}
      </div>
    </div>
  )
}
