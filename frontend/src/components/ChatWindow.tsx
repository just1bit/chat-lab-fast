import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import MessageBubble from './MessageBubble'
import type { Message } from '../types'

interface Props {
  messages: Message[]
  loading: boolean
  error: string | null
  onSend: (text: string) => void
}

export default function ChatWindow({ messages, loading, error, onSend }: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, loading])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput('')
  }

  return (
    <section className="flex flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !loading && (
          <div className="mx-auto max-w-lg rounded-lg border border-slate-800 bg-slate-900/50 p-6 text-center text-sm text-slate-400">
            Start a conversation with the chatbot. Pick a provider from the
            top-right. Configure providers and API keys in{' '}
            <code className="rounded bg-slate-800 px-1">backend/providers.json</code>.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {error && (
          <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
            Error: {error}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-slate-800 p-4">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
