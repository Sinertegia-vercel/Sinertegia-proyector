import { useState } from 'react'
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from '../../types'

interface Props {
  tasks: Task[]
  onSelectTask: (task: Task) => void
}

const STATUS_COLOR: Record<string, string> = {
  pendiente:   'bg-gray-400',
  en_progreso: 'bg-blue-500',
  completada:  'bg-green-500',
  bloqueada:   'bg-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  pendiente:   'Pendiente',
  en_progreso: 'En progreso',
  completada:  'Completada',
  bloqueada:   'Bloqueada',
}

export default function TeamCalendarView({ tasks, onSelectTask }: Props) {
  const today = new Date()
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const firstDay = new Date(current.year, current.month, 1)
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate()
  const startWeekday = firstDay.getDay() // 0=Sun

  const monthName = firstDay.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  function prevMonth() {
    setCurrent(c => {
      const m = c.month === 0 ? 11 : c.month - 1
      const y = c.month === 0 ? c.year - 1 : c.year
      return { year: y, month: m }
    })
    setSelectedDay(null)
  }
  function nextMonth() {
    setCurrent(c => {
      const m = c.month === 11 ? 0 : c.month + 1
      const y = c.month === 11 ? c.year + 1 : c.year
      return { year: y, month: m }
    })
    setSelectedDay(null)
  }

  function tasksForDay(day: number) {
    const cellDate = new Date(current.year, current.month, day)
    cellDate.setHours(0, 0, 0, 0)
    return tasks.filter(t => {
      const start = t.start_date ? new Date(t.start_date + 'T00:00:00') : null
      const end = t.completion_date
        ? new Date(t.completion_date + 'T00:00:00')
        : t.commitment_date
        ? new Date(t.commitment_date + 'T00:00:00')
        : null
      if (start && end) return cellDate >= start && cellDate <= end
      if (start) return cellDate.getTime() === start.getTime()
      if (end) return cellDate.getTime() === end.getTime()
      return false
    })
  }

  function isToday(day: number) {
    return today.getFullYear() === current.year && today.getMonth() === current.month && today.getDate() === day
  }

  const selectedTasks = selectedDay ? tasksForDay(selectedDay) : []
  const undatedTasks = tasks.filter(t => t.status !== 'completada' && !t.start_date && !t.commitment_date)

  // Build grid: blanks + days
  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Fill to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ChevronLeft size={18} className="text-gray-600" />
        </button>
        <h3 className="text-base font-bold text-gray-800 capitalize">{monthName}</h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ChevronRight size={18} className="text-gray-600" />
        </button>
      </div>

      {undatedTasks.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={17} className="shrink-0" />
          <strong>{undatedTasks.length} tareas no aparecen en el calendario</strong>
          <span className="text-amber-700">porque no tienen fecha de compromiso.</span>
        </div>
      )}

      {undatedTasks.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><CalendarPlus size={16} className="text-blue-600" /><p className="text-sm font-bold text-gray-800">Sin fecha</p></div>
            <span className="text-xs text-gray-400">Abre una tarea para asignarle fecha</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {undatedTasks.slice(0, 8).map(task => (
              <button key={task.id} type="button" onClick={() => onSelectTask(task)} className="min-w-[210px] rounded-lg border border-gray-200 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50">
                <p className="truncate text-xs font-semibold text-gray-800">{task.title}</p>
                <p className="mt-1 truncate text-[11px] text-gray-400">{task.project?.client?.name || task.project?.name || 'Trabajo interno'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r border-gray-100 bg-gray-50/50" />

            const dayTasks = tasksForDay(day)
            const isSelected = selectedDay === day
            const isOverdue = dayTasks.some(t => t.status !== 'completada')
              && new Date(current.year, current.month, day) < today
              && !isToday(day)

            return (
              <div
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[80px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition
                  ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : 'hover:bg-gray-50'}
                  ${isToday(day) ? 'bg-blue-50/60' : ''}
                `}
              >
                <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1
                  ${isToday(day) ? 'bg-blue-600 text-white' : isOverdue && dayTasks.length > 0 ? 'text-red-500' : 'text-gray-600'}
                `}>
                  {day}
                </span>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 2).map(t => (
                    <button type="button" key={t.id}
                      onClick={event => { event.stopPropagation(); onSelectTask(t) }}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded text-white truncate ${STATUS_COLOR[t.status] || 'bg-gray-400'}`}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-[10px] text-gray-400 pl-1">+{dayTasks.length - 2} más</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {Object.entries(STATUS_COLOR).map(([key, color]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            {STATUS_LABEL[key]}
          </span>
        ))}
      </div>

      {/* Detalle del día seleccionado */}
      {selectedDay && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-bold text-gray-800">
              {new Date(current.year, current.month, selectedDay).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          {selectedTasks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Sin tareas este día</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {selectedTasks.map(t => (
                <div key={t.id} onClick={() => onSelectTask(t)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLOR[t.status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.project?.client?.name || '—'} · {t.project?.name || '—'}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {t.commitment_date?.startsWith(`${current.year}-${String(current.month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`)
                      ? '📅 Entrega' : '▶ Inicio'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
