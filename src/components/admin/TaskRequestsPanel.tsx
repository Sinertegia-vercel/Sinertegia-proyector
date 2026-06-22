import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DEPT_LABELS, DEPT_COLORS } from '../../data/projectTemplates'

interface TaskRequest {
  id: string
  title: string
  description?: string
  department: string
  status: string
  created_at: string
  client: { name: string; company: string }
  requester: { full_name: string }
  assignee?: { full_name: string }
  project?: { name: string }
}

export default function TaskRequestsPanel() {
  const [requests, setRequests] = useState<TaskRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pendiente' | 'aprobada' | 'rechazada' | 'todas'>('pendiente')

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    const { data } = await supabase
      .from('task_requests')
      .select('*, client:clients(name,company), requester:users!requester_id(full_name), assignee:users!assigned_to(full_name), project:projects(name)')
      .order('created_at', { ascending: false })
    setRequests((data as any) || [])
    setLoading(false)
  }

  async function approve(req: TaskRequest) {
    await supabase.from('task_requests').update({ status: 'aprobada' }).eq('id', req.id)
    // Notificar al cliente
    const { data: clientUser } = await supabase
      .from('clients')
      .select('user_id')
      .eq('name', req.client.name)
      .maybeSingle()
    if (clientUser?.user_id) {
      await supabase.from('notifications').insert({
        user_id: clientUser.user_id,
        title: '✅ Tu solicitud fue aprobada',
        message: `"${req.title}" fue aprobada y se está procesando.`,
        type: 'task_request',
      })
    }
    fetchRequests()
  }

  async function reject(req: TaskRequest) {
    await supabase.from('task_requests').update({ status: 'rechazada' }).eq('id', req.id)
    fetchRequests()
  }

  const filtered = filter === 'todas' ? requests : requests.filter(r => r.status === filter)
  const pending = requests.filter(r => r.status === 'pendiente').length

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-400">Cargando solicitudes...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Solicitudes de tareas</h3>
          <p className="text-sm text-gray-500">Peticiones enviadas por los clientes</p>
        </div>
        {pending > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full">
            {pending} pendiente{pending > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5">
        {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f === 'pendiente' ? '⏳ Pendientes' : f === 'aprobada' ? '✅ Aprobadas' : f === 'rechazada' ? '❌ Rechazadas' : '📋 Todas'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay solicitudes {filter !== 'todas' ? `"${filter}"` : ''}</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(req => (
          <div key={req.id} className={`bg-white border rounded-xl p-5 shadow-sm ${req.status === 'pendiente' ? 'border-orange-200' : req.status === 'aprobada' ? 'border-green-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Cliente y estado */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">{req.client?.name}</span>
                  {req.project && <span className="text-xs text-gray-400">· {req.project.name}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    req.status === 'pendiente' ? 'bg-orange-100 text-orange-700' :
                    req.status === 'aprobada' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {req.status === 'pendiente' ? '⏳ Pendiente' : req.status === 'aprobada' ? '✅ Aprobada' : '❌ Rechazada'}
                  </span>
                </div>

                {/* Título */}
                <p className="font-semibold text-gray-800 mb-1">{req.title}</p>
                {req.description && <p className="text-sm text-gray-500 mb-2">{req.description}</p>}

                {/* Etiquetas */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DEPT_COLORS[req.department] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {DEPT_LABELS[req.department] || req.department}
                  </span>
                  {req.assignee && (
                    <span className="text-xs flex items-center gap-1 text-gray-500">
                      <User size={11} /> {req.assignee.full_name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(req.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              {req.status === 'pendiente' && (
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => approve(req)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
                  >
                    <CheckCircle size={13} /> Aprobar
                  </button>
                  <button
                    onClick={() => reject(req)}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-semibold px-3 py-2 rounded-lg transition"
                  >
                    <XCircle size={13} /> Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
