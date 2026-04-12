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

const STORAGE_KEY_PROVIDER = 'chatbot_provider'
const STORAGE_KEY_MODEL = 'chatbot_model'

export function useChat() {
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [provider, setProviderState] = useState(
    () => localStorage.getItem(STORAGE_KEY_PROVIDER) || 'openrouter',
  )
  const [model, setModelState] = useState(
    () => localStorage.getItem(STORAGE_KEY_MODEL) || 'openrouter/free',
  )
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)

  // Whether the current conversation is locked to a specific model
  const [lockedProvider, setLockedProvider] = useState<string | null>(null)
  const [lockedModel, setLockedModel] = useState<string | null>(null)

  const sourceRef = useRef<EventSource | null>(null)

  const setProvider = useCallback((p: string) => {
    setProviderState(p)
    localStorage.setItem(STORAGE_KEY_PROVIDER, p)
  }, [])

  const setModel = useCallback((m: string) => {
    setModelState(m)
    localStorage.setItem(STORAGE_KEY_MODEL, m)
  }, [])

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
        // Only use server defaults if nothing cached
        const cachedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER)
        const cachedModel = localStorage.getItem(STORAGE_KEY_MODEL)
        if (!cachedProvider) {
          setProvider(data.active_provider)
        }
        if (!cachedModel) {
          setModel(data.active_model)
        }
      })
      .catch((e) => setError((e as Error).message))
    void refreshConversations()
  }, [refreshConversations, setProvider, setModel])

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

      // Lock to the conversation's provider/model
      if (detail.provider && detail.model) {
        setLockedProvider(detail.provider)
        setLockedModel(detail.model)
        setProviderState(detail.provider)
        setModelState(detail.model)
      } else {
        setLockedProvider(null)
        setLockedModel(null)
      }
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
    setStreamStatus(null)
    setLockedProvider(null)
    setLockedModel(null)
    // Restore cached selection
    const cachedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER)
    const cachedModel = localStorage.getItem(STORAGE_KEY_MODEL)
    if (cachedProvider) setProviderState(cachedProvider)
    if (cachedModel) setModelState(cachedModel)
  }, [])

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || loading) return

      setError(null)
      setStreamStatus(null)
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
        setStreamStatus(null)
      }

      source.addEventListener('meta', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data)
          if (parsed.conversation_id) {
            setActiveConversationId(parsed.conversation_id)
            // Lock model for this new conversation
            setLockedProvider(provider)
            setLockedModel(model)
          }
        } catch {
          // Ignore malformed meta frame.
        }
      })

      // Listen for status events (e.g. "Thinking...")
      source.addEventListener('status', (event) => {
        const data = (event as MessageEvent).data
        try {
          const parsed = JSON.parse(data)
          setStreamStatus(parsed.text || null)
        } catch {
          setStreamStatus(data || null)
        }
      })

      source.onmessage = (event) => {
        const chunk = event.data.replace(/\\n/g, '\n')
        // Clear status once actual content starts arriving
        setStreamStatus(null)
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

  // Check if the locked model still exists in the available models
  const modelUnavailable =
    lockedProvider !== null &&
    models !== null &&
    !models.providers.some(
      (p) => p.name === lockedProvider && p.models.includes(lockedModel ?? ''),
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
    streamStatus,
    sendMessage,
    openConversation,
    newChat,
    removeConversation,
    lockedProvider,
    lockedModel,
    modelUnavailable,
  }
}
