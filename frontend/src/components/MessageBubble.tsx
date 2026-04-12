import type { Message } from '../types'

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-2xl rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-100'
        }`}
      >
        {message.content || (isUser ? '' : <span className="italic text-slate-400">…</span>)}
        {!isUser && message.model && message.content && (
          <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
            {message.provider} · {message.model}
          </div>
        )}
      </div>
    </div>
  )
}
