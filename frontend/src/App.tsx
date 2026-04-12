import ChatWindow from './components/ChatWindow'
import ModelSelector from './components/ModelSelector'
import Sidebar from './components/Sidebar'
import { useChat } from './hooks/useChat'

function App() {
  const chat = useChat()

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeConversationId}
        onOpen={chat.openConversation}
        onNew={chat.newChat}
        onDelete={chat.removeConversation}
      />
      <main className="flex flex-1 flex-col">
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
          />
        </header>
        <ChatWindow
          messages={chat.messages}
          loading={chat.loading}
          error={chat.error}
          onSend={chat.sendMessage}
        />
      </main>
    </div>
  )
}

export default App
