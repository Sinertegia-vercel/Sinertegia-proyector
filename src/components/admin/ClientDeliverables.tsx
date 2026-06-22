import { useEffect, useState } from 'react'
import { ExternalLink, ChevronDown, Link2, CheckSquare, Square } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Client } from '../../types'

interface TaskRow {
  id: string
  title: string
  status: string
  review_status: string | null
  department: string
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

export default function ClientDeliverables({ fixedClientId, onlyApproved = false }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState(fixedClientId || '')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [checkItems, setCheckItems] = useState<CheckItem[]>([])
  const [newCheckText, setNewCheckText] = useState('')
  const [loading, setLoading] = useState(false)

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
      .select('id, title, status, review_status, department, links:task_links(id, label, url)')
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

  return (
    <div className="space-y-5">

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
        <div className="flex gap-5 items-start">

          {/* ── Lista de tareas ── */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

            {/* Barra de progreso */}
            {total > 0 && (
              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{onlyApproved ? 'Entregables autorizados' : 'Progreso del proyecto'}</span>
                  {!onlyApproved && (
                    <span className="font-semibold">{Math.round((done / total) * 100)}%</span>
                  )}
                  {onlyApproved && (
                    <span className="font-semibold">{total} disponible{total !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {!onlyApproved && (
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-700"
                      style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {total === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <CheckSquare size={28} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">
                  {onlyApproved
                    ? 'Aún no hay entregables autorizados para ti'
                    : 'No hay tareas para este cliente'}
                </p>
                {onlyApproved && (
                  <p className="text-xs mt-1 text-gray-400">Los entregables aparecerán aquí cuando el equipo los complete y sean autorizados</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tasks.map(task => {
                  const isCompleted = task.status === 'completada'
                  const hasLinks = task.links && task.links.length > 0

                  return (
                    <div
                      key={task.id}
                      className={`px-5 py-3.5 flex items-start gap-3 transition ${isCompleted ? 'bg-green-50/40' : 'hover:bg-gray-50'}`}
                    >
                      {/* Checkbox de estado */}
                      <div className="shrink-0 mt-0.5">
                        {isCompleted
                          ? <CheckSquare size={18} className="text-green-500" />
                          : <Square size={18} className="text-gray-300" />
                        }
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {task.title}
                          </span>
                          {/* Departamento solo para admin/equipo */}
                          {!onlyApproved && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DEPT_COLORS[task.department] || 'bg-gray-100 text-gray-600'}`}>
                              {DEPT_LABELS[task.department] || task.department}
                            </span>
                          )}
                        </div>

                        {/* Links */}
                        {hasLinks && (
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {task.links.map(link => (
                              <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5 hover:bg-blue-100 transition font-medium"
                              >
                                <ExternalLink size={10} />
                                {link.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Badge de estado */}
                      <div className="shrink-0">
                        {isCompleted ? (
                          <span className="text-xs font-semibold text-green-600 bg-green-100 px-2.5 py-1 rounded-full">✓ Lista</span>
                        ) : task.status === 'en_progreso' ? (
                          <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">En progreso</span>
                        ) : task.status === 'bloqueada' ? (
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">Bloqueada</span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Pendiente</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Checklist lateral ── */}
          <div className="w-60 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-700">📋 {onlyApproved ? 'Mis notas' : 'Pendientes'}</p>
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
      )}
    </div>
  )
}
