import type { ConversationSummary } from '../types'

interface Props {
  conversations: ConversationSummary[]
  activeId: string | null
  collapsed: boolean
  streamingIds: Set<string>
  onOpen: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onToggle: () => void
}

export default function Sidebar({
  conversations,
  activeId,
  collapsed,
  streamingIds,
  onOpen,
  onNew,
  onDelete,
  onToggle,
}: Props) {
  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 ${
        collapsed ? 'w-12' : 'w-64'
      }`}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className="m-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {!collapsed && (
        <>
          <button
            type="button"
            onClick={onNew}
            className="mx-3 mb-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
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
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => onOpen(c.id)}
                  >
                    {streamingIds.has(c.id) && (
                      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-indigo-400" />
                    )}
                    <span className="truncate">{c.title}</span>
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
        </>
      )}
    </aside>
  )
}
