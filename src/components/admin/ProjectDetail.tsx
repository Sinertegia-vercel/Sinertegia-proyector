import { useState } from 'react'
import { ArrowLeft, Plus, ChevronDown, Pencil, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Task, Project, User } from '../../types'
import PriorityBadge from '../shared/PriorityBadge'
import StatusBadge from '../shared/StatusBadge'
import ProgressBar from '../shared/ProgressBar'
import TaskDetailModal from '../team/TaskDetailModal'
import CreateTaskModal from './CreateTaskModal'

interface Props {
  project: Project
  tasks: Task[]
  teamMembers: User[]
  projects: Project[]
  onBack: () => void
  onUpdate: () => void
}

const DEPT_LABELS: Record<string, string> = {
  edicion: 'Edición', grabacion: 'Grabación', diseno: 'Diseño',
  copy: 'Copy', webmaster: 'Webmaster', trafficker: 'Trafficker',
  lider: 'Líder', cliente: 'Cliente',
}

const STATUS_OPTIONS = [
  { value: 'activo', label: 'Activo', color: 'bg-green-100 text-green-700' },
  { value: 'pausado', label: 'Pausado', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'completado', label: 'Completado', color: 'bg-gray-100 text-gray-600' },
]

const REVIEW_BADGES: Record<string, { label: string; color: string }> = {
  pendiente_revision: { label: '🔍 En revisión', color: 'bg-yellow-100 text-yellow-700' },
  en_revision: { label: '🔍 Revisando', color: 'bg-orange-100 text-orange-700' },
  aprobada: { label: '✅ Aprobada', color: 'bg-green-100 text-green-700' },
}

export default function ProjectDetail({ project, tasks, teamMembers, projects, onBack, onUpdate }: Props) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(project.status)
  const [editingName, setEditingName] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editDesc, setEditDesc] = useState(project.description || '')
  const [savingName, setSavingName] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterDept, setFilterDept] = useState<string>('todos')
  const [filterPerson, setFilterPerson] = useState<string>('todos')

  const completed = tasks.filter(t => t.status === 'completada').length
  const pct = tasks.length ? (completed / tasks.length) * 100 : 0
  const overdue = tasks.filter(t => t.commitment_date && t.status !== 'completada' && new Date(t.commitment_date) < new Date())

  async function saveProjectName() {
    if (!editName.trim()) return
    setSavingName(true)
    await supabase.from('projects').update({ name: editName.trim(), description: editDesc.trim() || null }).eq('id', project.id)
    setSavingName(false)
    setEditingName(false)
    onUpdate()
  }

  async function changeProjectStatus(newStatus: 'activo' | 'pausado' | 'completado') {
    await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
    setCurrentStatus(newStatus)
    setStatusOpen(false)
    onUpdate()
  }

  const statusOpt = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[0]

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'todos' && t.status === 'completada') return false
    if (filterStatus !== 'todos' && t.status !== filterStatus) return false
    if (filterDept !== 'todos' && t.department !== filterDept) return false
    if (filterPerson !== 'todos' && t.assigned_to !== filterPerson) return false
    return true
  })

  const departments = [...new Set(tasks.map(t => t.department))].filter(Boolean)

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
        <ArrowLeft size={15} /> Volver a proyectos
      </button>

      {/* Header del proyecto */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{project.client?.name}</p>
            {editingName ? (
              <div className="mt-1 space-y-2">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  autoFocus
                  className="w-full text-xl font-bold text-gray-900 border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button onClick={saveProjectName} disabled={savingName || !editName.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50">
                    <Check size={13} /> {savingName ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button onClick={() => { setEditingName(false); setEditName(project.name); setEditDesc(project.description || '') }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
                    <X size={13} /> Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-0.5 group">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{editName}</h3>
                  {editDesc && <p className="text-sm text-gray-500 mt-1">{editDesc}</p>}
                </div>
                <button onClick={() => setEditingName(true)}
                  title="Editar nombre del proyecto"
                  className="opacity-0 group-hover:opacity-100 transition mt-1 p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 shrink-0">
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
          {/* Estado clickeable */}
          <div className="relative">
            <button onClick={() => setStatusOpen(!statusOpen)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${statusOpt.color}`}>
              {statusOpt.label}
              <ChevronDown size={12} />
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[140px] py-1">
                {STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => changeProjectStatus(opt.value as 'activo' | 'pausado' | 'completado')}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 font-medium ${opt.value === currentStatus ? 'opacity-50 cursor-default' : ''}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <ProgressBar percentage={pct} />
        <div className="flex gap-6 mt-4 text-sm text-gray-500">
          <span>{completed}/{tasks.length} tareas completadas</span>
          {overdue.length > 0 && <span className="text-red-600 font-semibold">⚠ {overdue.length} vencida{overdue.length > 1 ? 's' : ''}</span>}
          <span className="text-gray-400">{tasks.filter(t => !t.commitment_date).length} sin fecha de compromiso</span>
        </div>
      </div>

      {/* Filtros + botón nueva tarea */}
      <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_progreso">En progreso</option>
            <option value="completada">Completada</option>
            <option value="bloqueada">Bloqueada</option>
          </select>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todos los deptos</option>
            {departments.map(d => <option key={d} value={d}>{DEPT_LABELS[d] || d}</option>)}
          </select>
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="todos">Todas las personas</option>
            {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreateTask(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-700 to-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 transition">
          <Plus size={14} /> Nueva tarea
        </button>
      </div>

      {/* Tabla de tareas */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h4 className="font-semibold text-gray-800">
            Tareas del proyecto
            {filteredTasks.length !== tasks.length && (
              <span className="ml-2 text-xs text-gray-400 font-normal">({filteredTasks.length} de {tasks.length})</span>
            )}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Tarea</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Asignado a</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Depto</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Estatus</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Prioridad</th>
                <th className="text-left px-4 py-3 font-semibold text-orange-500">La necesito para</th>
                <th className="text-left px-4 py-3 font-semibold text-blue-500">Mi compromiso</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">F. Entrega</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-500">Revisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTasks.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No hay tareas con estos filtros</td></tr>
              )}
              {filteredTasks.map(task => {
                const isLate = task.commitment_date && task.status !== 'completada' && new Date(task.commitment_date) < new Date()
                const noCommitment = !task.commitment_date && task.status !== 'completada'
                const reviewBadge = task.review_status ? REVIEW_BADGES[task.review_status] : null
                return (
                  <tr key={task.id} onClick={() => setSelectedTask(task)}
                    className={`cursor-pointer hover:bg-gray-50 transition ${isLate ? 'bg-red-50' : noCommitment ? 'bg-orange-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{task.title}</td>
                    <td className="px-4 py-3 text-gray-600">{task.assignee?.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{task.department ? DEPT_LABELS[task.department] : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                    <td className="px-4 py-3 text-xs text-orange-600 font-medium">
                      {task.needed_date ? new Date(task.needed_date + 'T00:00:00').toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {task.commitment_date ? (
                        <span className={`text-xs font-semibold ${isLate ? 'text-red-600' : 'text-blue-600'}`}>
                          {new Date(task.commitment_date + 'T00:00:00').toLocaleDateString('es-MX')}
                          {isLate && ' ⚠️'}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-400 font-medium">Sin fecha</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {task.completion_date ? new Date(task.completion_date + 'T00:00:00').toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {reviewBadge
                        ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${reviewBadge.color}`}>{reviewBadge.label}</span>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} onUpdate={onUpdate} />
      )}

      {showCreateTask && (
        <CreateTaskModal
          projects={projects}
          teamMembers={teamMembers}
          defaultProjectId={project.id}
          onClose={() => setShowCreateTask(false)}
          onCreated={onUpdate}
        />
      )}
    </div>
  )
}
