import { useState, useEffect, useRef } from 'react'
import { Search, X, FolderKanban, ClipboardList, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Result {
  id: string
  type: 'task' | 'project' | 'client'
  title: string
  subtitle: string
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setResults([]) }
  }, [open])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(() => search(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function search(q: string) {
    setLoading(true)
    const [{ data: tasks }, { data: projects }, { data: clients }] = await Promise.all([
      supabase.from('tasks').select('id, title, status, project:projects(name, client:clients(name))').ilike('title', `%${q}%`).limit(5),
      supabase.from('projects').select('id, name, client:clients(name)').ilike('name', `%${q}%`).limit(5),
      supabase.from('clients').select('id, name, company').ilike('name', `%${q}%`).limit(5),
    ])

    const res: Result[] = [
      ...(tasks || []).map((t: any) => ({
        id: t.id, type: 'task' as const,
        title: t.title,
        subtitle: `${t.project?.client?.name || ''} — ${t.project?.name || ''} · ${t.status}`,
      })),
      ...(projects || []).map((p: any) => ({
        id: p.id, type: 'project' as const,
        title: p.name,
        subtitle: p.client?.name || 'Sin cliente',
      })),
      ...(clients || []).map((c: any) => ({
        id: c.id, type: 'client' as const,
        title: c.name,
        subtitle: c.company || '',
      })),
    ]
    setResults(res)
    setLoading(false)
  }

  function selectResult(result: Result) {
    if (result.type === 'task') {
      window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId: result.id } }))
    } else if (result.type === 'project') {
      window.dispatchEvent(new CustomEvent('open-project', { detail: { projectId: result.id } }))
    } else {
      window.dispatchEvent(new CustomEvent('open-client', { detail: { clientId: result.id } }))
    }
    setOpen(false)
  }

  const typeIcon = { task: ClipboardList, project: FolderKanban, client: Users }
  const typeLabel = { task: 'Tarea', project: 'Proyecto', client: 'Cliente' }
  const typeColor = { task: 'text-blue-500', project: 'text-purple-500', client: 'text-green-500' }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
      >
        <Search size={15} />
        <span className="hidden sm:block">Buscar...</span>
        <kbd className="hidden sm:block text-xs bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-400">⌘K</kbd>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24 px-4">
          <div ref={ref} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar tareas, proyectos, clientes..."
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loading && (
                <div className="py-6 text-center text-sm text-gray-400">Buscando...</div>
              )}
              {!loading && query && results.length === 0 && (
                <div className="py-6 text-center text-sm text-gray-400">Sin resultados para "{query}"</div>
              )}
              {!loading && !query && (
                <div className="py-6 text-center text-sm text-gray-400">Escribe para buscar</div>
              )}
              {results.map(r => {
                const Icon = typeIcon[r.type]
                return (
                  <button type="button" key={`${r.type}-${r.id}`} onClick={() => selectResult(r)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition">
                    <Icon size={16} className={`${typeColor[r.type]} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>
                    </div>
                    <span className={`text-xs font-semibold ${typeColor[r.type]} shrink-0`}>
                      {typeLabel[r.type]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
              <span>ESC para cerrar</span>
              <span>⌘K para abrir</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
