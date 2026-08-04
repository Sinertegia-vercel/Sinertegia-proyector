import { useEffect, useState } from 'react'
import { ExternalLink, ChevronDown, Link2, CheckSquare, Square, Search, Copy, FileText, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Client } from '../../types'

interface TaskRow {
  id: string
  title: string
  status: string
  review_status: string | null
  department: string
  updated_at: string
  project?: { id: string; name: string }
  assignee?: { full_name: string }
  links: { id: string; label: string; url: string }[]
}

interface CheckItem {
  id: string
  text: string
  done: boolean
}

interface Props {
  fixedClientId?: string   // si se pasa, no muestra dropdown y usa este cliente
  onlyApproved?: boolean   // si true, solo muestra tareas con review_status='aprobada'
}

const DEPT_LABELS: Record<string, string> = {
  edicion: 'Edición', grabacion: 'Grabación', diseno: 'Diseño',
  copy: 'Copy', webmaster: 'Webmaster', trafficker: 'Trafficker',
  lider: 'Líder', cliente: 'Cliente',
}

const DEPT_COLORS: Record<string, string> = {
  edicion: 'bg-orange-100 text-orange-700',
  grabacion: 'bg-red-100 text-red-700',
  diseno: 'bg-pink-100 text-pink-700',
  copy: 'bg-yellow-100 text-yellow-700',
  webmaster: 'bg-cyan-100 text-cyan-700',
  trafficker: 'bg-blue-100 text-blue-700',
  lider: 'bg-purple-100 text-purple-700',
  cliente: 'bg-green-100 text-green-700',
}

function fileKind(url: string) {
  const clean = url.split('?')[0].toLowerCase()
  const extension = clean.split('.').pop() || ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)) return { type: 'image', label: extension.toUpperCase() }
  if (['mp4', 'webm', 'mov', 'm4v'].includes(extension)) return { type: 'video', label: extension.toUpperCase() }
  if (extension === 'pdf') return { type: 'document', label: 'PDF' }
  if (['doc', 'docx'].includes(extension)) return { type: 'office', label: extension.toUpperCase() }
  if (['xls', 'xlsx'].includes(extension)) return { type: 'office', label: extension.toUpperCase() }
  if (['html', 'htm'].includes(extension)) return { type: 'website', label: 'HTML' }
  return { type: 'website', label: 'ENLACE' }
}

function DeliverablePreview({ url, label }: { url: string; label: string }) {
  const kind = fileKind(url)
  if (kind.type === 'image') return <img src={url} alt={label} className="h-full w-full object-cover" />
  if (kind.type === 'video') return <video src={url} muted preload="metadata" className="h-full w-full object-cover" />
  if (kind.type === 'office') return <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600"><FileText size={23} /><span className="mt-1 text-[9px] font-black">{kind.label}</span></div>
  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-100">
      <iframe src={url} title={`Vista previa de ${label}`} tabIndex={-1} className="pointer-events-none absolute left-0 top-0 border-0 bg-white" style={{ width: 640, height: 400, transform: 'scale(.14)', transformOrigin: 'top left' }} />
      <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-bold text-white">{kind.label}</span>
    </div>
  )
}

export default function ClientDeliverables({ fixedClientId, onlyApproved = false }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId || '')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [checkItems, setCheckItems] = useState<CheckItem[]>([])
  const [newCheckText, setNewCheckText] = useState('')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendientes' | 'revision' | 'aprobados'>('todos')
  const [projectFilter, setProjectFilter] = useState('todos')

  // Solo cargar lista de clientes si NO hay fixedClientId
  useEffect(() => {
    if (!fixedClientId) {
      supabase.from('clients').select('*').order('name').then(({ data }) => {
        setClients(data || [])
      })
    }
  }, [fixedClientId])

  useEffect(() => {
    if (!selectedClientId) { setTasks([]); return }
    loadTasks()
  }, [selectedClientId, onlyApproved])

  async function loadTasks() {
    setLoading(true)

    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('client_id', selectedClientId)

    if (!projects || projects.length === 0) { setTasks([]); setLoading(false); return }

    const projectIds = projects.map(p => p.id)

    let query = supabase
      .from('tasks')
      .select('id, title, status, review_status, department, updated_at, project:projects(id, name), assignee:users!assigned_to(full_name), links:task_links(id, label, url)')
      .in('project_id', projectIds)
      .order('department')
      .order('created_at')

    // En modo cliente: solo tareas autorizadas por el trafficker
    if (onlyApproved) {
      query = query.eq('review_status', 'aprobada')
    }

    const { data: rawTasks } = await query
    setTasks((rawTasks || []) as TaskRow[])
    setLoading(false)
  }

  function addCheckItem() {
    if (!newCheckText.trim()) return
    setCheckItems(prev => [...prev, { id: crypto.randomUUID(), text: newCheckText.trim(), done: false }])
    setNewCheckText('')
  }

  function toggleCheck(id: string) {
    setCheckItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }

  const done = tasks.filter(t => t.status === 'completada').length
  const total = tasks.length
  const checkDone = checkItems.filter(i => i.done).length
  const projectOptions = Array.from(new Map(tasks.map(task => task.project).filter(Boolean).map(project => [project!.id, project!])).values())
  const visibleTasks = tasks.filter(task => {
    if (projectFilter !== 'todos' && task.project?.id !== projectFilter) return false
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter === 'pendientes') return !task.review_status || task.review_status === 'cambios_solicitados'
    if (statusFilter === 'revision') return task.review_status === 'pendiente_revision' || task.review_status === 'pendiente_trafficker' || task.review_status === 'en_revision'
    if (statusFilter === 'aprobados') return task.review_status === 'aprobada' || task.status === 'completada'
    return true
  })
  const deliverableRows = visibleTasks.flatMap(task => (task.links || []).map((link, index) => ({ task, link, version: `V${index + 1}` })))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Entregables</h2>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400"><span>Cliente</span><span>→</span><span>Proyecto</span><span>→</span><span className="font-semibold text-blue-600">Entregables</span></div>
      </div>

      {/* Selector de cliente — solo si no hay fixedClientId */}
      {!fixedClientId && (
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full appearance-none border border-gray-300 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="">Selecciona un cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
          {selectedClientId && !loading && total > 0 && (
            <span className="text-sm text-gray-500">{done}/{total} tareas completadas</span>
          )}
        </div>
      )}

      {/* Estado vacío */}
      {!selectedClientId && !fixedClientId && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Link2 size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Elige un cliente para ver sus entregables</p>
        </div>
      )}

      {selectedClientId && loading && (
        <div className="text-center py-16 text-gray-400 text-sm">Cargando entregables...</div>
      )}

      {selectedClientId && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar entregables..." className="w-full bg-transparent text-sm outline-none" />
            </div>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="todos">Todos los proyectos</option>
              {projectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            {([['todos', 'Todos'], ['pendientes', 'Pendientes'], ['revision', 'En revisión'], ['aprobados', 'Aprobados']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${statusFilter === value ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-5 items-start">

          {/* Biblioteca de entregables: una fila por enlace o archivo */}
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {deliverableRows.length === 0 ? (
              <div className="py-16 text-center text-gray-400"><FileText size={30} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-semibold">No hay entregables con estos filtros</p><p className="mt-1 text-xs">Los archivos y enlaces aparecerán cuando se adjunten a una tarea.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500"><tr><th className="px-4 py-3">Entregable</th><th className="px-4 py-3">Proyecto</th><th className="px-4 py-3">Versión</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Actualizado</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {deliverableRows.map(({ task, link, version }) => {
                      const approved = task.review_status === 'aprobada' || task.status === 'completada'
                      const changes = task.review_status === 'cambios_solicitados'
                      const reviewing = task.review_status === 'pendiente_revision' || task.review_status === 'pendiente_trafficker' || task.review_status === 'en_revision'
                      return <tr key={link.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><a href={link.url} target="_blank" rel="noreferrer" className="block h-[58px] w-[92px] shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm"><DeliverablePreview url={link.url} label={link.label || task.title} /></a><div className="min-w-0"><p className="max-w-[190px] truncate font-semibold text-gray-800">{link.label || task.title}</p><p className="mt-0.5 max-w-[190px] truncate text-xs text-gray-400">{fileKind(link.url).label} · {task.title}</p></div></div></td>
                        <td className="px-4 py-3 text-xs text-gray-600">{task.project?.name || 'Sin proyecto'}</td>
                        <td className="px-4 py-3"><span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{version}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-600">{task.assignee?.full_name || 'Sin registrar'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{task.updated_at ? new Date(task.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin registrar'}</td>
                        <td className="px-4 py-3">{approved ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Final aprobado</span> : changes ? <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">Cambios solicitados</span> : reviewing ? <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">En revisión</span> : <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">Pendiente</span>}</td>
                        <td className="px-4 py-3"><div className="flex justify-end gap-2"><a href={link.url} target="_blank" rel="noreferrer" title="Vista previa" className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-blue-300 hover:text-blue-600"><Eye size={14} /></a><button type="button" onClick={() => navigator.clipboard.writeText(link.url)} title="Copiar enlace" className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:border-blue-300 hover:text-blue-600"><Copy size={14} /></button></div></td>
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Checklist lateral ── */}
          <div className="w-60 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">📋 {onlyApproved ? 'Mis notas' : 'Seguimiento del cliente'}</p>
              {checkItems.length > 0 && (
                <span className="text-xs text-gray-400">{checkDone}/{checkItems.length}</span>
              )}
            </div>

            {checkItems.length > 0 && (
              <div className="px-4 pt-3">
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(checkDone / checkItems.length) * 100}%` }} />
                </div>
              </div>
            )}

            <div className="px-4 py-3 space-y-2 max-h-72 overflow-y-auto">
              {checkItems.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  {onlyApproved ? 'Agrega tus notas aquí' : 'Agrega items para seguimiento'}
                </p>
              )}
              {checkItems.map(item => (
                <div key={item.id} className="flex items-start gap-2 group">
                  <button onClick={() => toggleCheck(item.id)} className="mt-0.5 shrink-0 text-gray-300 hover:text-green-500 transition">
                    {item.done ? <CheckSquare size={15} className="text-green-500" /> : <Square size={15} />}
                  </button>
                  <span className={`text-xs flex-1 leading-snug ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => setCheckItems(prev => prev.filter(i => i.id !== item.id))}
                    className="text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>

            <div className="px-4 pb-4 border-t border-gray-100 pt-3">
              <div className="flex gap-2">
                <input
                  value={newCheckText}
                  onChange={e => setNewCheckText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                  placeholder="Agregar nota..."
                  className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={addCheckItem} disabled={!newCheckText.trim()}
                  className="text-xs bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-40">+</button>
              </div>
            </div>
          </div>

          </div>
        </div>
      )}
    </div>
  )
}
