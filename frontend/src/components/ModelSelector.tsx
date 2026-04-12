import type { ModelsResponse } from '../types'

interface Props {
  models: ModelsResponse | null
  provider: string
  model: string
  onProviderChange: (name: string) => void
  onModelChange: (name: string) => void
}

export default function ModelSelector({
  models,
  provider,
  model,
  onProviderChange,
  onModelChange,
}: Props) {
  if (!models) {
    return <div className="text-xs text-slate-500">Loading models…</div>
  }

  const current = models.providers.find((p) => p.name === provider)
  const modelOptions = current?.models ?? []

  return (
    <div className="flex items-center gap-2 text-xs sm:text-sm">
      <select
        value={provider}
        onChange={(e) => {
          const next = e.target.value
          onProviderChange(next)
          const nextProv = models.providers.find((p) => p.name === next)
          if (nextProv?.models[0]) {
            onModelChange(nextProv.models[0])
          }
        }}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
      >
        {models.providers.map((p) => (
          <option key={p.name} value={p.name} disabled={!p.available}>
            {p.display_name}
            {!p.available ? ' (key missing)' : ''}
          </option>
        ))}
      </select>

      <select
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
      >
        {modelOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  )
}
