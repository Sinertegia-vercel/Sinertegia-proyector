import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task, User } from '../../types'
import UserAvatar from '../shared/UserAvatar'

interface Props {
  teamMembers: User[]
  tasks: Task[]
  onlineIds?: Set<string>
}

const CLIENT_COLORS = [
  'bg-purple-400', 'bg-pink-400', 'bg-indigo-400', 'bg-teal-400',
  'bg-orange-400', 'bg-cyan-400', 'bg-lime-500', 'bg-rose-400',
  'bg-amber-400', 'bg-violet-400', 'bg-emerald-400', 'bg-sky-400',
]

function getWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function TeamCalendar({ teamMembers, tasks, onlineIds = new Set() }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [weeksToShow] = useState(4)

  const days: Date[] = []
  for (let i = 0; i < weeksToShow * 7; i++) {
    days.push(addDays(weekStart, i))
  }

  const clientColorMap: Record<string, string> = {}
  let colorIndex = 0
  tasks.forEach(t => {
    const clientName = t.project?.client?.name || ''
    if (clientName && !clientColorMap[clientName]) {
      clientColorMap[clientName] = CLIENT_COLORS[colorIndex % CLIENT_COLORS.length]
      colorIndex++
    }
  })

  function prevWeek() { setWeekStart(addDays(weekStart, -7)) }
  function nextWeek() { setWeekStart(addDays(weekStart, 7)) }
  function goToday() { setWeekStart(getWeekStart(new Date())) }

  function getTasksForMemberAndDay(memberId: string, day: Date) {
    return tasks.filter(t => {
      if (t.assigned_to !== memberId) return false
      const effectiveEnd = t.completion_date || t.commitment_date
      if (!t.start_date && !effectiveEnd) return false
      const start = t.start_date
        ? new Date(t.start_date + 'T00:00:00')
        : new Date(effectiveEnd! + 'T00:00:00')
      const end = effectiveEnd
        ? new Date(effectiveEnd + 'T00:00:00')
        : start
      return day >= start && day <= end
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekGroups: Date[][] = []
  for (let w = 0; w < weeksToShow; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(days[w * 7 + d])
    }
    weekGroups.push(week)
  }

  return (
    <div>
      {/* Header controles */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Calendario del equipo</h3>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Hoy
          </button>
          <input
            type="date"
            value={weekStart.toISOString().split('T')[0]}
            onChange={e => {
              if (e.target.value) setWeekStart(getWeekStart(new Date(e.target.value + 'T00:00:00')))
            }}
            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
          />
          <button onClick={prevWeek} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
            {DAYS[0]} {weekStart.getDate()} {MONTHS[weekStart.getMonth()]} — {DAYS[6]} {addDays(weekStart, weeksToShow * 7 - 1).getDate()} {MONTHS[addDays(weekStart, weeksToShow * 7 - 1).getMonth()]}
          </span>
          <button onClick={nextWeek} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Leyenda de clientes */}
      {Object.keys(clientColorMap).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(clientColorMap).map(([client, color]) => (
            <span key={client} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-3 h-3 rounded-sm ${color}`} />
              {client}
            </span>
          ))}
        </div>
      )}

      {/* Calendario */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Cabecera de semanas y días */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${weeksToShow * 7 * 44 + 160}px` }}>

            {/* Header semanas */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="w-40 shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 border-r border-gray-200">
                Persona
              </div>
              {weekGroups.map((week, wi) => (
                <div key={wi} className="flex border-r border-gray-200 last:border-r-0">
                  {week.map((day, di) => {
                    const isToday = isSameDay(day, today)
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    return (
                      <div key={di} style={{ width: '44px' }}
                        className={`text-center py-2 border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-blue-50' : ''} ${isWeekend ? 'bg-gray-100' : ''}`}>
                        <p className="text-xs text-gray-400">{DAYS[di === 6 ? 6 : di]}</p>
                        <p className={`text-xs font-bold ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>{day.getDate()}</p>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Filas por persona */}
            {teamMembers.map(member => {
              const memberTasks = tasks.filter(t => t.assigned_to === member.id)
              const undatedCount = memberTasks.filter(t => {
                const effectiveEnd = (t as any).completion_date || t.commitment_date
                return !t.start_date && !effectiveEnd
              }).length
              const totalMemberTasks = memberTasks.length

              return (
              <div key={member.id} className="flex border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition">
                {/* Nombre */}
                <div className="w-40 shrink-0 px-3 py-2 border-r border-gray-200 flex items-start gap-2">
                  <div className="relative shrink-0" style={{ width: 28, height: 28 }}>
                    <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size={28} />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${onlineIds.has(member.id) ? 'bg-green-500' : 'bg-gray-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700 leading-tight truncate">{member.full_name.split(' ')[0]}</p>
                    <p className="text-xs text-gray-400 capitalize">{member.department}</p>
                    {totalMemberTasks > 0 && (
                      <p className="text-xs mt-0.5">
                        {undatedCount > 0
                          ? <span className="text-orange-500 font-medium" title={`${undatedCount} tarea(s) sin fecha asignada`}>⚠️ {undatedCount} sin fecha</span>
                          : <span className="text-green-500 font-medium">✓ {totalMemberTasks} con fecha</span>
                        }
                      </p>
                    )}
                  </div>
                </div>

                {/* Celdas de días */}
                {days.map((day, di) => {
                  const dayTasks = getTasksForMemberAndDay(member.id, day)
                  const isToday = isSameDay(day, today)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6
                  return (
                    <div key={di} style={{ width: '44px', minHeight: '52px' }}
                      className={`border-r border-gray-100 last:border-r-0 p-0.5 ${isToday ? 'bg-blue-50' : ''} ${isWeekend ? 'bg-gray-50' : ''}`}>
                      {dayTasks.map((task, ti) => {
                        const clientName = task.project?.client?.name || ''
                        const color = clientColorMap[clientName] || 'bg-blue-400'
                        const isOverdue = task.commitment_date && task.status !== 'completada' && new Date(task.commitment_date + 'T00:00:00') < today
                        return (
                          <div key={ti} title={`${task.title} — ${clientName}`}
                            className={`w-full rounded text-white text-center mb-0.5 cursor-pointer hover:opacity-80 transition ${isOverdue ? 'bg-red-500' : color}`}
                            style={{ height: '18px', fontSize: '9px', lineHeight: '18px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingInline: '2px' }}>
                            {task.title}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )})}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        🔴 Tarea vencida &nbsp;·&nbsp; Pasa el cursor sobre una tarea para ver el detalle &nbsp;·&nbsp; Fin de semana en gris
      </p>
    </div>
  )
}
