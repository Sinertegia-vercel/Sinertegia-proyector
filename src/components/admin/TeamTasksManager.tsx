import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Eye, Search, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Task, TaskStatus, User } from '../../types'
import PriorityBadge from '../shared/PriorityBadge'
import StatusBadge from '../shared/StatusBadge'
import UserAvatar from '../shared/UserAvatar'
import TaskDetailModal from '../team/TaskDetailModal'

interface Props {
  teamMembers: User[]
  tasks: Task[]
  onTasksChange: () => void | Promise<void>
}

type StatusFilter = 'activas' | TaskStatus | 'todas'

export default function TeamTasksManager({ teamMembers, tasks, onTasksChange }: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('activas')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [busyTaskId, setBusyTaskId] = useState('')
  const [error, setError] = useState('')

  const members = useMemo(() => [...teamMembers].sort((a, b) => a.full_name.localeCompare(b.full_name)), [teamMembers])
  const visibleMembers = members.filter((member) => member.full_name.toLowerCase().includes(memberSearch.toLowerCase()))
  const memberTasks = selectedMemberId === 'all' ? tasks : tasks.filter((task) => task.assigned_to === selectedMemberId)
  const filteredTasks = memberTasks
    .filter((task) => {
      if (statusFilter === 'todas') return true
      if (statusFilter === 'activas') return task.status !== 'completada'
      return task.status === statusFilter
    })
    .filter((task) => {
      const query = taskSearch.trim().toLowerCase()
      if (!query) return true
      return [task.title, task.project?.name, task.project?.client?.name, task.assignee?.full_name].some((value) => value?.toLowerCase().includes(query))
    })
    .sort((a, b) => {
      if (a.status === 'completada' && b.status !== 'completada') return 1
      if (a.status !== 'completada' && b.status === 'completada') return -1
      return (a.commitment_date || '9999-12-31').localeCompare(b.commitment_date || '9999-12-31')
    })

  const activeCount = memberTasks.filter((task) => task.status !== 'completada').length
  const completedCount = memberTasks.filter((task) => task.status === 'completada').length

  async function completeTask(task: Task) {
    if (!window.confirm(`¿Marcar “${task.title}” como completada?\n\nNo será necesario que ${task.assignee?.full_name || 'el integrante'} la envíe a revisión.`)) return
    setBusyTaskId(task.id)
    setError('')
    const { error: actionError } = await supabase.rpc('admin_complete_team_task', { p_task_id: task.id })
    setBusyTaskId('')
    if (actionError) {
      setError(`No se pudo completar la tarea: ${actionError.message}`)
      return
    }
    setSelectedTask(null)
    await onTasksChange()
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`¿Eliminar permanentemente “${task.title}”?\n\nTambién se eliminarán sus entregables, comentarios, subtareas y tiempos registrados. Esta acción no se puede deshacer.`)) return
    setBusyTaskId(task.id)
    setError('')
    const { error: actionError } = await supabase.rpc('admin_delete_team_task', { p_task_id: task.id })
    setBusyTaskId('')
    if (actionError) {
      setError(`No se pudo eliminar la tarea: ${actionError.message}`)
      return
    }
    setSelectedTask(null)
    await onTasksChange()
  }

  return (
    <div className="mx-auto max-w-[1400px] p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Control operativo</p>
          <h1 className="text-2xl font-bold text-gray-950">Tareas del equipo</h1>
          <p className="mt-1 text-sm text-gray-500">Consulta y administra directamente las tareas de cada integrante.</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><b className="text-xl text-blue-600">{activeCount}</b><span className="ml-2 text-sm text-gray-500">activas</span></div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3"><b className="text-xl text-emerald-600">{completedCount}</b><span className="ml-2 text-sm text-gray-500">completadas</span></div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-gray-200 bg-gray-50/70 p-4 lg:border-b-0 lg:border-r">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar integrante..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </div>
          <button type="button" onClick={() => setSelectedMemberId('all')} className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${selectedMemberId === 'all' ? 'bg-blue-600 text-white' : 'hover:bg-white'}`}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${selectedMemberId === 'all' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}><Users size={19} /></span>
            <span className="min-w-0 flex-1"><b className="block text-sm">Todo el equipo</b><small className={selectedMemberId === 'all' ? 'text-blue-100' : 'text-gray-500'}>{tasks.length} tareas</small></span>
          </button>
          <div className="max-h-[555px] space-y-1 overflow-y-auto pr-1">
            {visibleMembers.map((member) => {
              const count = tasks.filter((task) => task.assigned_to === member.id && task.status !== 'completada').length
              return <button key={member.id} type="button" onClick={() => setSelectedMemberId(member.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${selectedMemberId === member.id ? 'border border-blue-200 bg-blue-50' : 'border border-transparent hover:bg-white'}`}>
                <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size={40} />
                <span className="min-w-0 flex-1"><b className="block truncate text-sm text-gray-900">{member.full_name}</b><small className="block truncate capitalize text-gray-500">{member.department || 'Sin departamento'}</small></span>
                <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">{count}</span>
              </button>
            })}
          </div>
        </aside>

        <section className="min-w-0 p-4 lg:p-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Buscar tarea, cliente o proyecto..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500">
              <option value="activas">Activas</option><option value="pendiente">Pendientes</option><option value="en_progreso">En progreso</option><option value="bloqueada">Bloqueadas</option><option value="completada">Completadas</option><option value="todas">Todas</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Tarea</th><th className="px-4 py-3">Integrante</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Prioridad</th><th className="px-4 py-3">Entrega</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map((task) => <tr key={task.id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3"><button type="button" onClick={() => setSelectedTask(task)} className="max-w-[300px] text-left"><b className="block truncate text-gray-900 hover:text-blue-600">{task.title}</b><small className="block truncate text-gray-500">{task.project?.client?.name || 'Sin cliente'} · {task.project?.name || 'Sin proyecto'}</small></button></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><UserAvatar name={task.assignee?.full_name || 'Sin asignar'} avatarUrl={task.assignee?.avatar_url} size={28} /><span className="max-w-[145px] truncate">{task.assignee?.full_name || 'Sin asignar'}</span></div></td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td><td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{task.commitment_date ? new Date(`${task.commitment_date}T00:00:00`).toLocaleDateString('es-MX') : 'Sin fecha'}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelectedTask(task)} title="Ver detalle" className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:border-blue-300 hover:text-blue-600"><Eye size={16} /></button>{task.status !== 'completada' && <button type="button" disabled={busyTaskId === task.id} onClick={() => completeTask(task)} title="Marcar completada" className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><CheckCircle2 size={16} /></button>}<button type="button" disabled={busyTaskId === task.id} onClick={() => deleteTask(task)} title="Eliminar tarea" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16} /></button></div></td>
                </tr>)}
              </tbody>
            </table>
            {!filteredTasks.length && <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-gray-400"><ClipboardList size={42} className="mb-3 text-gray-300" /><b className="text-gray-600">No hay tareas con estos filtros</b><span className="mt-1 text-sm">Prueba otra persona, estado o búsqueda.</span></div>}
          </div>
        </section>
      </div>

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} onUpdate={async () => { setSelectedTask(null); await onTasksChange() }} />}
    </div>
  )
}
