import type { ConversationSummary } from '../types'

interface Props {
  conversations: ConversationSummary[]
  activeId: string | null
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export default function Sidebar({
  conversations,
  activeId,
  onOpen,
  onNew,
  onDelete,
}: Props) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900">
      <button
        type="button"
        onClick={onNew}
        className="m-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        + New chat
      </button>

      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-500">
            No conversations yet — start one on the right.
          </p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                activeId === c.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <button
                type="button"
                className="flex-1 truncate text-left"
                onClick={() => onOpen(c.id)}
              >
                {c.title}
              </button>
              <button
                type="button"
                aria-label="Delete conversation"
                className="ml-2 text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-400"
                onClick={() => onDelete(c.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <footer className="border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
        CS732 · FastAPI + React
      </footer>
    </aside>
  )
}
