import { useState } from 'react'
import ChatWindow from './components/ChatWindow'
import ModelSelector from './components/ModelSelector'
import Sidebar from './components/Sidebar'
import { useChat } from './hooks/useChat'

function App() {
  const chat = useChat()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeConversationId}
        collapsed={sidebarCollapsed}
        onOpen={chat.openConversation}
        onNew={chat.newChat}
        onDelete={chat.removeConversation}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-white">
              CS732 FastAPI Chatbot
            </h1>
            <p className="text-xs text-slate-500">
              Python · FastAPI · LangChain · React
            </p>
          </div>
          <ModelSelector
            models={chat.models}
            provider={chat.provider}
            model={chat.model}
            onProviderChange={chat.setProvider}
            onModelChange={chat.setModel}
            locked={chat.lockedProvider !== null}
            modelUnavailable={chat.modelUnavailable}
          />
        </header>
        <ChatWindow
          messages={chat.messages}
          loading={chat.loading}
          error={chat.error}
          streamStatus={chat.streamStatus}
          onSend={chat.sendMessage}
          disabled={chat.modelUnavailable}
        />
      </main>
    </div>
  )
}

export default App
