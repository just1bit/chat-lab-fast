export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  provider: string
  model: string
  created_at: string
}

export interface ConversationSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends ConversationSummary {
  messages: Message[]
}

export interface ProviderInfo {
  name: string
  display_name: string
  is_local: boolean
  available: boolean
  models: string[]
}

export interface ModelsResponse {
  active_provider: string
  active_model: string
  providers: ProviderInfo[]
}

export interface ChatResponse {
  response: string
  provider: string
  model: string
  conversation_id: string
  response_time_ms: number
}
