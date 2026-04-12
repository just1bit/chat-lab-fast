import { useCallback, useEffect, useRef, useState } from 'react'

import {
  buildStreamUrl,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  fetchModels,
} from '../services/api'
import type {
  ConversationSummary,
  Message,
  ModelsResponse,
} from '../types'

export function useChat() {
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [provider, setProvider] = useState('openrouter')
  const [model, setModel] = useState('openrouter/free')
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceRef = useRef<EventSource | null>(null)

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await fetchConversations())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    fetchModels()
      .then((data) => {
        setModels(data)
        setProvider(data.active_provider)
        setModel(data.active_model)
      })
      .catch((e) => setError((e as Error).message))
    void refreshConversations()
  }, [refreshConversations])

  useEffect(() => {
    return () => {
      sourceRef.current?.close()
    }
  }, [])

  const openConversation = useCallback(async (id: string) => {
    setError(null)
    setLoading(true)
    try {
      const detail = await fetchConversation(id)
      setActiveConversationId(id)
      setMessages(detail.messages)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const newChat = useCallback(() => {
    sourceRef.current?.close()
    sourceRef.current = null
    setActiveConversationId(null)
    setMessages([])
    setError(null)
  }, [])

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || loading) return

      setError(null)
      const nowIso = new Date().toISOString()
      const userMsg: Message = {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: text,
        provider,
        model,
        created_at: nowIso,
      }
      const assistantId = `local-asst-${Date.now()}`
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        provider,
        model,
        created_at: nowIso,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setLoading(true)

      const url = buildStreamUrl({
        message: text,
        provider,
        model,
        conversation_id: activeConversationId,
      })
      const source = new EventSource(url)
      sourceRef.current = source

      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        source.close()
        setLoading(false)
      }

      source.addEventListener('meta', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data)
          if (parsed.conversation_id) {
            setActiveConversationId(parsed.conversation_id)
          }
        } catch {
          // Ignore malformed meta frame.
        }
      })

      source.onmessage = (event) => {
        const chunk = event.data.replace(/\\n/g, '\n')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        )
      }

      source.addEventListener('done', () => {
        close()
        void refreshConversations()
      })

      source.addEventListener('error', (event) => {
        // An "error" also fires when the stream closes naturally after [DONE];
        // we only surface it if we haven't already finished.
        if (closed) return
        const data = (event as MessageEvent).data
        setError(typeof data === 'string' && data ? data : 'Streaming error')
        close()
      })
    },
    [provider, model, activeConversationId, loading, refreshConversations],
  )

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id)
        if (activeConversationId === id) newChat()
        await refreshConversations()
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [activeConversationId, newChat, refreshConversations],
  )

  return {
    models,
    provider,
    setProvider,
    model,
    setModel,
    conversations,
    activeConversationId,
    messages,
    loading,
    error,
    sendMessage,
    openConversation,
    newChat,
    removeConversation,
  }
}
