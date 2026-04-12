import type {
  ChatResponse,
  ConversationDetail,
  ConversationSummary,
  ModelsResponse,
} from '../types'

const API_BASE = '/api'

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${detail}`)
  }
  return (await response.json()) as T
}

export async function fetchModels(): Promise<ModelsResponse> {
  return handle<ModelsResponse>(await fetch(`${API_BASE}/models`))
}

export async function sendChat(payload: {
  message: string
  provider: string
  model: string
  conversation_id?: string | null
}): Promise<ChatResponse> {
  return handle<ChatResponse>(
    await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  return handle<ConversationSummary[]>(await fetch(`${API_BASE}/conversations`))
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  return handle<ConversationDetail>(await fetch(`${API_BASE}/conversations/${id}`))
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }
}

export function buildStreamUrl(params: {
  message: string
  provider: string
  model: string
  conversation_id?: string | null
}): string {
  const search = new URLSearchParams({
    message: params.message,
    provider: params.provider,
    model: params.model,
  })
  if (params.conversation_id) {
    search.set('conversation_id', params.conversation_id)
  }
  return `${API_BASE}/chat/stream?${search.toString()}`
}
