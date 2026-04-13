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

/** Per-conversation streaming session kept alive in the background. */
interface ConvSession {
  messages: Message[]
  assistantId: string
  source: EventSource | null
  loading: boolean
  streamStatus: string | null
  error: string | null
  provider: string
  model: string
}

// ── URL helpers ──

function urlConvId(): string | null {
  return new URLSearchParams(window.location.search).get('c')
}

function pushConvUrl(id: string | null) {
  const u = new URL(window.location.href)
  if (id) u.searchParams.set('c', id)
  else u.searchParams.delete('c')
  window.history.pushState({}, '', u.toString())
}

function replaceConvUrl(id: string | null) {
  const u = new URL(window.location.href)
  if (id) u.searchParams.set('c', id)
  else u.searchParams.delete('c')
  window.history.replaceState({}, '', u.toString())
}

// ── Hook ──

export function useChat() {
  // ── Global state ──
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [provider, setProviderRaw] = useState(
    () => localStorage.getItem(STORAGE_KEY_PROVIDER) || 'openrouter',
  )
  const [model, setModelRaw] = useState(
    () => localStorage.getItem(STORAGE_KEY_MODEL) || 'openrouter/free',
  )
  const [conversations, setConversations] = useState<ConversationSummary[]>([])

  // ── Active conversation (driven by URL) ──
  const [activeId, _setActiveId] = useState<string | null>(urlConvId)
  const activeIdRef = useRef(activeId)
  const setActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id
    _setActiveId(id)
  }, [])

  // ── Displayed state for the active conversation ──
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamStatus, setStreamStatus] = useState<string | null>(null)
  const [lockedProvider, setLockedProvider] = useState<string | null>(null)
  const [lockedModel, setLockedModel] = useState<string | null>(null)

  // ── Background streaming sessions ──
  const sessions = useRef(new Map<string, ConvSession>())
  const [streamingIds, setStreamingIds] = useState<Set<string>>(new Set())

  // ── Setters with localStorage persistence ──
  const setProvider = useCallback((p: string) => {
    setProviderRaw(p)
    localStorage.setItem(STORAGE_KEY_PROVIDER, p)
  }, [])

  const setModel = useCallback((m: string) => {
    setModelRaw(m)
    localStorage.setItem(STORAGE_KEY_MODEL, m)
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await fetchConversations())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  // ── Init: fetch models + conversations ──
  useEffect(() => {
    fetchModels()
      .then((data) => {
        setModels(data)
        if (!localStorage.getItem(STORAGE_KEY_PROVIDER)) setProvider(data.active_provider)
        if (!localStorage.getItem(STORAGE_KEY_MODEL)) setModel(data.active_model)
      })
      .catch((e) => setError((e as Error).message))
    void refreshConversations()
  }, [refreshConversations, setProvider, setModel])

  // ── Cleanup all streams on unmount ──
  useEffect(() => {
    const map = sessions.current
    return () => {
      for (const s of map.values()) s.source?.close()
    }
  }, [])

  // ── Load a conversation into the display (from session map or DB) ──
  const loadConversation = useCallback(
    async (id: string) => {
      setActiveId(id)
      setError(null)

      // If there's an active streaming session, display its state directly
      const session = sessions.current.get(id)
      if (session) {
        setMessages([...session.messages])
        setLoading(session.loading)
        setStreamStatus(session.streamStatus)
        setError(session.error)
        setLockedProvider(session.provider)
        setLockedModel(session.model)
        setProviderRaw(session.provider)
        setModelRaw(session.model)
        return
      }

      // Fetch from database
      setLoading(true)
      try {
        const detail = await fetchConversation(id)
        if (activeIdRef.current !== id) return // user navigated away
        setMessages(detail.messages)
        if (detail.provider && detail.model) {
          setLockedProvider(detail.provider)
          setLockedModel(detail.model)
          setProviderRaw(detail.provider)
          setModelRaw(detail.model)
        } else {
          setLockedProvider(null)
          setLockedModel(null)
        }
      } catch (e) {
        if (activeIdRef.current !== id) return
        setError((e as Error).message)
      } finally {
        if (activeIdRef.current === id) setLoading(false)
      }
    },
    [setActiveId],
  )

  // ── Reset display to "new chat" state ──
  const resetToNewChat = useCallback(() => {
    setActiveId(null)
    setMessages([])
    setLoading(false)
    setError(null)
    setStreamStatus(null)
    setLockedProvider(null)
    setLockedModel(null)
    const cp = localStorage.getItem(STORAGE_KEY_PROVIDER)
    const cm = localStorage.getItem(STORAGE_KEY_MODEL)
    if (cp) setProviderRaw(cp)
    if (cm) setModelRaw(cm)
  }, [setActiveId])

  // ── Open conversation from URL on first load ──
  useEffect(() => {
    const id = urlConvId()
    if (id) void loadConversation(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Browser back / forward ──
  useEffect(() => {
    const handler = () => {
      const id = urlConvId()
      if (id) void loadConversation(id)
      else resetToNewChat()
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [loadConversation, resetToNewChat])

  // ── Public: open a conversation (pushes URL) ──
  const openConversation = useCallback(
    (id: string) => {
      pushConvUrl(id)
      void loadConversation(id)
    },
    [loadConversation],
  )

  // ── Public: start a new chat (pushes URL) ──
  const newChat = useCallback(() => {
    pushConvUrl(null)
    resetToNewChat()
  }, [resetToNewChat])

  // ── Public: send a message (starts or continues a streaming session) ──
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return

      const currentId = activeIdRef.current

      // Block if this conversation already has an active stream
      if (currentId && sessions.current.get(currentId)?.loading) return

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
      const asstId = `local-asst-${Date.now()}`
      const asstMsg: Message = {
        id: asstId,
        role: 'assistant',
        content: '',
        provider,
        model,
        created_at: nowIso,
      }

      const newMsgs = [...messages, userMsg, asstMsg]
      setMessages(newMsgs)
      setLoading(true)

      // Create session object
      const session: ConvSession = {
        messages: newMsgs,
        assistantId: asstId,
        source: null,
        loading: true,
        streamStatus: null,
        error: null,
        provider,
        model,
      }

      // Use a unique key so two "new chat" sends don't collide
      const convKey = currentId ?? `_pending_${Date.now()}_${Math.random()}`
      sessions.current.set(convKey, session)
      setStreamingIds((prev) => new Set(prev).add(convKey))

      // For new chats, temporarily set activeId to convKey
      if (!currentId) {
        setActiveId(convKey)
      }

      let resolvedId: string | null = currentId

      const url = buildStreamUrl({
        message: text,
        provider,
        model,
        conversation_id: currentId,
      })
      const source = new EventSource(url)
      session.source = source

      let closed = false

      const close = () => {
        if (closed) return
        closed = true
        source.close()
        session.loading = false
        session.streamStatus = null
        session.source = null

        // Clean up session from map
        const key = resolvedId ?? convKey
        sessions.current.delete(key)
        setStreamingIds((prev) => {
          const next = new Set(prev)
          next.delete(key)
          // Also clean convKey in case it was re-keyed
          if (key !== convKey) next.delete(convKey)
          return next
        })

        // Update display if still active
        if (activeIdRef.current === key || activeIdRef.current === convKey) {
          setLoading(false)
          setStreamStatus(null)
        }
      }

      source.addEventListener('meta', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data)
          if (parsed.conversation_id) {
            resolvedId = parsed.conversation_id

            // Re-key session from temp key to real ID
            sessions.current.delete(convKey)
            sessions.current.set(resolvedId!, session)
            setStreamingIds((prev) => {
              const next = new Set(prev)
              next.delete(convKey)
              next.add(resolvedId!)
              return next
            })

            // Update active view if user is still looking at this conversation
            if (activeIdRef.current === convKey || activeIdRef.current === currentId) {
              setActiveId(resolvedId!)
              replaceConvUrl(resolvedId!)
              setLockedProvider(provider)
              setLockedModel(model)
            }

            // Optimistic update: immediately add the new conversation to the sidebar
            if (!currentId) {
              const summary: ConversationSummary = {
                id: resolvedId!,
                title: text.slice(0, 50) || 'New conversation',
                provider,
                model,
                created_at: nowIso,
                updated_at: nowIso,
              }
              setConversations((prev) => [summary, ...prev])
            }
          }
        } catch {
          /* ignore malformed meta */
        }
      })

      source.addEventListener('status', (event) => {
        const data = (event as MessageEvent).data
        let statusText: string | null = null
        try {
          statusText = JSON.parse(data).text || null
        } catch {
          statusText = data || null
        }
        session.streamStatus = statusText
        const key = resolvedId ?? convKey
        if (activeIdRef.current === key || activeIdRef.current === convKey) {
          setStreamStatus(statusText)
        }
      })

      source.onmessage = (event) => {
        const chunk = event.data.replace(/\\n/g, '\n')
        session.streamStatus = null
        session.messages = session.messages.map((m) =>
          m.id === asstId ? { ...m, content: m.content + chunk } : m,
        )
        const key = resolvedId ?? convKey
        if (activeIdRef.current === key || activeIdRef.current === convKey) {
          setStreamStatus(null)
          setMessages([...session.messages])
        }
      }

      source.addEventListener('done', () => {
        close()
        void refreshConversations()
      })

      source.addEventListener('error', (event) => {
        if (closed) return
        const data = (event as MessageEvent).data
        const errMsg = typeof data === 'string' && data ? data : 'Streaming error'
        session.error = errMsg
        const key = resolvedId ?? convKey
        if (activeIdRef.current === key || activeIdRef.current === convKey) {
          setError(errMsg)
        }
        close()
      })
    },
    [provider, model, messages, setActiveId, refreshConversations],
  )

  // ── Public: delete a conversation ──
  const removeConversation = useCallback(
    async (id: string) => {
      try {
        // Close any active stream
        const s = sessions.current.get(id)
        if (s?.source) s.source.close()
        sessions.current.delete(id)
        setStreamingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })

        await deleteConversation(id)
        if (activeIdRef.current === id) newChat()
        await refreshConversations()
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [newChat, refreshConversations],
  )

  // Check if the locked model still exists in available models
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
    activeConversationId: activeId,
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
    streamingIds,
  }
}
