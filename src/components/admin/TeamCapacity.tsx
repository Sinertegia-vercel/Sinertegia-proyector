import type { Task, User } from '../../types'
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react'

interface Props {
  teamMembers: User[]
  tasks: Task[]
  onAssign: () => void
}

const DEPT_LABELS: Record<string, string> = {
  edicion: 'Edición', grabacion: 'Grabación', diseno: 'Diseño',
  copy: 'Copy', webmaster: 'Webmaster', trafficker: 'Trafficker',
  lider: 'Líder', cliente: 'Cliente',
}

export default function TeamCapacity({ teamMembers, tasks, onAssign }: Props) {
  function getMemberTasks(memberId: string) {
    return tasks.filter(t => t.assigned_to === memberId)
  }

  function getWeeklyLoad(memberId: string) {
    const now = new Date()
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() + 7)
    return tasks.filter(t =>
      t.assigned_to === memberId &&
      t.status !== 'completada' &&
      t.commitment_date &&
      new Date(t.commitment_date) <= weekEnd
    )
  }

  function getOverdueTasks(memberId: string) {
    return tasks.filter(t =>
      t.assigned_to === memberId &&
      t.status !== 'completada' &&
      t.commitment_date &&
      new Date(t.commitment_date) < new Date()
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Capacidad del equipo esta semana</h3>
        <button onClick={onAssign}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          + Asignar tarea
        </button>
      </div>

      <div className="space-y-4">
        {teamMembers.map(member => {
          const allTasks = getMemberTasks(member.id)
          const weekTasks = getWeeklyLoad(member.id)
          const overdue = getOverdueTasks(member.id)
          const completed = allTasks.filter(t => t.status === 'completada').length
          const active = allTasks.filter(t => t.status !== 'completada').length
          const loadPct = Math.min(100, (weekTasks.length / 5) * 100)
          const loadColor = loadPct >= 90 ? 'bg-red-500' : loadPct >= 60 ? 'bg-orange-400' : 'bg-green-500'

          return (
            <div key={member.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-red-500 flex items-center justify-center text-white font-bold text-sm">
                      {member.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{member.full_name}</p>
                      <p className="text-xs text-gray-400">{member.department ? DEPT_LABELS[member.department] : '—'}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Carga esta semana</p>
                  <p className="text-lg font-bold text-gray-800">{weekTasks.length} tareas</p>
                </div>
              </div>

              {/* Barra de carga */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Capacidad semanal</span>
                  <span className={loadPct >= 90 ? 'text-red-600 font-semibold' : ''}>{Math.round(loadPct)}% ocupado</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`${loadColor} h-2 rounded-full transition-all`} style={{ width: `${loadPct}%` }} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-gray-700">{active}</p>
                  <p className="text-xs text-gray-400">Activas</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-700">{completed}</p>
                  <p className="text-xs text-gray-400">Completadas</p>
                </div>
                <div className={`rounded-lg p-2 text-center ${overdue.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-lg font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-gray-700'}`}>{overdue.length}</p>
                  <p className="text-xs text-gray-400">Vencidas</p>
                </div>
              </div>

              {/* Tareas de la semana */}
              {weekTasks.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tareas esta semana</p>
                  <div className="space-y-1.5">
                    {weekTasks.slice(0, 4).map(t => {
                      const isLate = t.commitment_date && new Date(t.commitment_date) < new Date()
                      return (
                        <div key={t.id} className={`flex items-center gap-2 text-xs rounded-lg px-3 py-1.5 ${isLate ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          {isLate ? <AlertTriangle size={11} className="shrink-0" /> : <Clock size={11} className="shrink-0" />}
                          <span className="flex-1 truncate">{t.title}</span>
                          <span className="shrink-0 text-gray-400">{t.project?.client?.name}</span>
                        </div>
                      )
                    })}
                    {weekTasks.length > 4 && (
                      <p className="text-xs text-gray-400 px-3">+{weekTasks.length - 4} más esta semana</p>
                    )}
                  </div>
                </div>
              )}

              {weekTasks.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle size={13} />
                  <span>Disponible — sin tareas esta semana</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
