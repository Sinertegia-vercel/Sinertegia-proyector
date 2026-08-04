import { useMemo, useState } from 'react'
import type { Task } from '../../types'
import { DEPT_LABELS, DEPT_COLORS, DEPT_ORDER } from '../../data/projectTemplates'

interface Props {
  tasks: Task[]
  title?: string
  onSelectTask?: (task: Task) => void
}

// Color de barra según estado
const STATUS_COLORS: Record<string, { bar: string; progress: string; label: string }> = {
  pendiente:   { bar: 'rgba(209,213,219,0.5)', progress: '#9ca3af', label: '#6b7280' },
  en_progreso: { bar: 'rgba(147,197,253,0.5)', progress: '#3b82f6', label: '#1d4ed8' },
  completada:  { bar: 'rgba(134,239,172,0.5)', progress: '#22c55e', label: '#15803d' },
  bloqueada:   { bar: 'rgba(252,165,165,0.5)', progress: '#ef4444', label: '#b91c1c' },
}

const COL_WIDTH = 130
const ROW_HEIGHT = 52
const HEADER_HEIGHT = 48
const LEFT_WIDTH = 260

export default function RoadmapView({ tasks, title, onSelectTask }: Props) {
  const [clientFilter, setClientFilter] = useState<string>('todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'pendiente' | 'en_progreso' | 'completada' | 'bloqueada' | 'cambio_1' | 'cambio_2' | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  // Lista de clientes únicos
  const clients = useMemo(() => {
    const names = new Set<string>()
    tasks.forEach(t => { if (t.project?.client?.name) names.add(t.project.client.name) })
    return Array.from(names).sort()
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!showCompleted && t.status === 'completada') return false
      if (clientFilter !== 'todos' && t.project?.client?.name !== clientFilter) return false
      if (statusFilter) {
        const changeCount = (t as any).change_count ?? 0
        if (statusFilter === 'cambio_1' && changeCount !== 1) return false
        else if (statusFilter === 'cambio_2' && changeCount < 2) return false
        else if (statusFilter !== 'cambio_1' && statusFilter !== 'cambio_2' && t.status !== statusFilter) return false
      }
      if (dateFrom || dateTo) {
        const taskStart = t.start_date || t.commitment_date
        const taskEnd = t.commitment_date || t.start_date
        if (!taskStart && !taskEnd) return true
        if (dateFrom && taskEnd && taskEnd < dateFrom) return false
        if (dateTo && taskStart && taskStart > dateTo) return false
      }
      return true
    })
  }, [tasks, clientFilter, dateFrom, dateTo, statusFilter, showCompleted])
  const undatedTasks = filteredTasks.filter(t => !t.start_date && !t.commitment_date)
  const { startDate, weeks } = useMemo(() => {
    const allDates: Date[] = []
    filteredTasks.forEach(t => {
      if (t.start_date) allDates.push(new Date(t.start_date + 'T00:00:00'))
      if (t.commitment_date) allDates.push(new Date(t.commitment_date + 'T00:00:00'))
    })

    const now = new Date()
    const minDate = allDates.length
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : new Date()
    const maxDate = allDates.length
      ? new Date(Math.max(...allDates.map(d => d.getTime())))
      : new Date()

    const base = new Date(Math.min(minDate.getTime(), now.getTime()))
    base.setDate(base.getDate() - 21)
    const dow = base.getDay()
    base.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow))
    base.setHours(0, 0, 0, 0)

    const end = new Date(maxDate.getTime())
    end.setDate(end.getDate() + 21)
    const totalDays = Math.ceil((end.getTime() - base.getTime()) / 86400000)
    const weekCount = Math.max(14, Math.ceil(totalDays / 7))

    const weekList: Date[] = []
    for (let i = 0; i < weekCount; i++) {
      const d = new Date(base)
      d.setDate(d.getDate() + i * 7)
      weekList.push(d)
    }
    return { startDate: base, weeks: weekList }
  }, [tasks])

  function pxFromDate(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00')
    const days = (d.getTime() - startDate.getTime()) / 86400000
    return (days / 7) * COL_WIDTH
  }

  function widthBetween(startStr: string, endStr: string): number {
    const days = (new Date(endStr + 'T00:00:00').getTime() - new Date(startStr + 'T00:00:00').getTime()) / 86400000
    return Math.max((Math.max(days, 1) / 7) * COL_WIDTH, 20)
  }

  function progressPct(task: Task): number {
    if (task.status === 'completada') return 100
    if (task.status === 'pendiente' || task.status === 'bloqueada') return 0
    if (!task.start_date || !task.commitment_date) return 30
    const start = new Date(task.start_date + 'T00:00:00').getTime()
    const end = new Date(task.commitment_date + 'T00:00:00').getTime()
    const now = Date.now()
    return Math.max(5, Math.min(95, ((now - start) / (end - start)) * 100))
  }

  const todayPx = pxFromDate(new Date().toISOString().split('T')[0])
  const totalWidth = weeks.length * COL_WIDTH

  const grouped = DEPT_ORDER.map(dept => ({
    dept,
    deptTasks: filteredTasks.filter(t => t.department === dept),
  })).filter(g => g.deptTasks.length > 0)

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
        <p className="text-lg mb-1">No hay tareas para mostrar</p>
        <p className="text-sm">Crea tareas con fecha de inicio y compromiso para verlas en el mapa de ruta</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Encabezado con leyenda de estados */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 flex-wrap gap-2">
        <div className="flex flex-wrap gap-3 items-center">
          {title && <span className="text-sm font-semibold text-gray-700 mr-2">{title}</span>}
          {[
            { key: 'pendiente' as const, label: 'Pendiente' },
            { key: 'en_progreso' as const, label: 'En progreso' },
            { key: 'completada' as const, label: 'Completada' },
            { key: 'bloqueada' as const, label: 'Bloqueada' },
          ].map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setStatusFilter(prev => prev === key ? null : key)}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition ${statusFilter === key ? 'bg-white ring-1 ring-gray-300' : 'hover:bg-white/60'}`}>
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: STATUS_COLORS[key].progress }} />
              <span className={`text-xs ${statusFilter === key ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
            </button>
          ))}
          <button type="button" onClick={() => setStatusFilter(prev => prev === 'cambio_1' ? null : 'cambio_1')}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition ${statusFilter === 'cambio_1' ? 'bg-white ring-1 ring-gray-300' : 'hover:bg-white/60'}`}>
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#f59e0b' }} />
            <span className={`text-xs ${statusFilter === 'cambio_1' ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>1 cambio solicitado</span>
          </button>
          <button type="button" onClick={() => setStatusFilter(prev => prev === 'cambio_2' ? null : 'cambio_2')}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md transition ${statusFilter === 'cambio_2' ? 'bg-white ring-1 ring-gray-300' : 'hover:bg-white/60'}`}>
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#ef4444' }} />
            <span className={`text-xs ${statusFilter === 'cambio_2' ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>2 cambios (límite)</span>
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-3 rounded-sm" style={{ background: 'linear-gradient(to right, transparent, rgba(147,197,253,0.5))', border: '1px dashed #3b82f6' }} />
            <span className="text-xs text-gray-600">📌 Planeado (sin iniciar)</span>
          </div>
          {statusFilter && (
            <button type="button" onClick={() => setStatusFilter(null)}
              className="text-xs text-red-400 hover:text-red-600 font-semibold px-1.5">
              ✕ Quitar filtro
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} className="accent-blue-600" />
            Mostrar completadas
          </label>
          {/* Filtro por cliente */}
          <select
            value={clientFilter}
            onChange={e => setClientFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="todos">👥 Todos los clientes</option>
            {clients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Filtro por fechas */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Desde</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <span className="text-xs text-gray-400">hasta</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-red-400 hover:text-red-600 font-semibold px-1">✕</button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-red-400" />
            <span className="text-xs text-gray-500">Hoy</span>
          </div>
        </div>
      </div>

      {undatedTasks.length > 0 && (
        <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3">
          <span className="text-xs font-bold text-amber-800">Sin fecha ({undatedTasks.length})</span>
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {undatedTasks.slice(0, 6).map(task => (
              <button key={task.id} type="button" onClick={() => onSelectTask?.(task)} className="max-w-[210px] truncate rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:border-blue-300">{task.title}</button>
            ))}
          </div>
          <span className="hidden text-xs text-amber-700 lg:block">Asigna fechas para visualizar las tareas restantes</span>
        </div>
      )}

      {/* Grid principal */}
      <div className="flex overflow-auto" style={{ maxHeight: '72vh' }}>

        {/* Columna izquierda: nombres */}
        <div className="shrink-0 border-r border-gray-200 bg-white sticky left-0 z-20" style={{ width: LEFT_WIDTH }}>
          <div className="border-b border-gray-200 bg-gray-50 flex items-center px-3" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tarea / Cliente</span>
          </div>
          {grouped.map(({ dept, deptTasks }) => (
            <div key={dept}>
              <div className="flex items-center px-3 border-b border-gray-200 bg-gray-50" style={{ height: ROW_HEIGHT }}>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border truncate ${DEPT_COLORS[dept] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {DEPT_LABELS[dept]}
                </span>
              </div>
              {deptTasks.map(task => {
                const clientName = task.project?.client?.name
                const assigneeName = (task.assignee as any)?.full_name
                return (
                  <button type="button" key={task.id} onClick={() => onSelectTask?.(task)} className="flex w-full flex-col justify-center px-3 text-left border-b border-gray-100 hover:bg-blue-50 transition" style={{ height: ROW_HEIGHT }}>
                    <span className={`text-xs font-medium truncate leading-tight ${task.status === 'completada' ? 'line-through text-gray-400' : 'text-gray-800'}`} title={task.title}>
                      {task.status === 'completada' ? '✓ ' : ''}{task.title}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {clientName && (
                        <span className="text-xs text-blue-600 font-medium truncate">{clientName}</span>
                      )}
                      {clientName && assigneeName && <span className="text-gray-300 text-xs">·</span>}
                      {assigneeName && (
                        <span className="text-xs text-gray-400 truncate">{assigneeName.split(' ')[0]}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Columna derecha: timeline */}
        <div className="overflow-x-auto flex-1" style={{ position: 'relative' }}>
          <div style={{ width: totalWidth, position: 'relative', minWidth: totalWidth }}>

            {/* Encabezados de semanas */}
            <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10" style={{ height: HEADER_HEIGHT }}>
              {weeks.map((week, i) => {
                const prevWeek = weeks[i - 1]
                const showMonth = i === 0 || prevWeek.getMonth() !== week.getMonth()
                const isCurrentWeek = week <= new Date() && new Date() < new Date(week.getTime() + 7 * 86400000)
                return (
                  <div key={i}
                    className={`border-r border-gray-200 flex flex-col items-center justify-center shrink-0 ${isCurrentWeek ? 'bg-blue-50' : ''}`}
                    style={{ width: COL_WIDTH }}
                  >
                    {showMonth && (
                      <span className="text-xs font-bold text-gray-500 uppercase leading-none">
                        {week.toLocaleDateString('es-MX', { month: 'short' })}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 leading-none mt-0.5">
                      {week.getDate()} - {new Date(week.getTime() + 6 * 86400000).getDate()}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Línea de hoy */}
            {todayPx >= 0 && todayPx <= totalWidth && (
              <div className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: todayPx, width: 2, backgroundColor: '#f87171' }} />
            )}

            {/* Filas de tareas */}
            {grouped.map(({ dept, deptTasks }) => (
              <div key={dept}>
                {/* Separador de área */}
                <div className="border-b border-gray-200 bg-gray-50/60 flex" style={{ height: ROW_HEIGHT }}>
                  {weeks.map((_, i) => (
                    <div key={i} className="border-r border-gray-100 shrink-0" style={{ width: COL_WIDTH }} />
                  ))}
                </div>

                {deptTasks.map(task => {
                  const changeCount = (task as any).change_count ?? 0
                  const changeColors = changeCount >= 2
                    ? { bar: 'rgba(239,68,68,0.2)', progress: '#ef4444', label: '#b91c1c' }
                    : changeCount === 1
                    ? { bar: 'rgba(245,158,11,0.2)', progress: '#f59e0b', label: '#92400e' }
                    : null
                  const colors = changeColors || STATUS_COLORS[task.status] || STATUS_COLORS.pendiente
                  const isLate = task.commitment_date && task.status !== 'completada' &&
                    new Date(task.commitment_date + 'T00:00:00') < new Date()
                  const pct = progressPct(task)
                  const changeLabel = changeCount === 1 ? ' · ✍️ 1 cambio' : changeCount >= 2 ? ' · 🔴 2 cambios' : ''

                  // Fecha de fin efectiva: completion_date si está terminada, sino commitment_date
                  const effectiveEnd = task.completion_date || task.commitment_date
                  // Tiene ambas fechas (inicio tentativo del equipo + fecha de fin)
                  const hasBothDates = !!(task.start_date && effectiveEnd)
                  // Ya está trabajando en ello (inicio real)
                  const isActuallyStarted = task.status === 'en_progreso' || task.status === 'completada'

                  return (
                    <div key={task.id} className="border-b border-gray-50 relative flex hover:bg-blue-50/20 transition"
                      style={{ height: ROW_HEIGHT }}>
                      {/* Celdas de cuadrícula */}
                      {weeks.map((_, i) => (
                        <div key={i} className="border-r border-gray-100 shrink-0" style={{ width: COL_WIDTH }} />
                      ))}

                      {/* ── Barra SÓLIDA: tiene ambas fechas Y ya está en progreso/completada ── */}
                      {hasBothDates && isActuallyStarted && (
                        <div
                          className="absolute rounded-md overflow-hidden"
                          style={{
                            left: pxFromDate(task.start_date!),
                            width: widthBetween(task.start_date!, effectiveEnd!),
                            top: 6,
                            height: ROW_HEIGHT - 12,
                            background: colors.bar,
                            border: `1.5px solid ${colors.progress}`,
                            boxShadow: changeCount >= 2 ? '0 0 0 2px #fca5a5' : isLate ? '0 0 0 2px #fca5a5' : undefined,
                          }}
                          title={`${task.title}${changeCount > 0 ? ` — ${changeCount} cambio(s)` : ''}\n${task.start_date} → ${effectiveEnd}`}
                        >
                          <div className="h-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: colors.progress, opacity: 0.85 }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold truncate"
                            style={{ color: pct > 50 ? 'white' : colors.label }}>
                            {task.title}{changeLabel}
                          </span>
                        </div>
                      )}

                      {/* ── Barra DIFUMINADA: equipo puso inicio tentativo + fecha compromiso, pero aún no empieza ── */}
                      {hasBothDates && !isActuallyStarted && (
                        <div
                          className="absolute rounded-md"
                          style={{
                            left: pxFromDate(task.start_date!),
                            width: widthBetween(task.start_date!, effectiveEnd!),
                            top: 6,
                            height: ROW_HEIGHT - 12,
                            background: `linear-gradient(to right, transparent 0%, ${colors.bar} 85%)`,
                            border: `1.5px dashed ${colors.progress}`,
                            opacity: 0.75,
                          }}
                          title={`${task.title} — Planeado, aún sin iniciar\nInicio tentativo: ${task.start_date} → Compromiso: ${task.commitment_date}`}
                        >
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-medium truncate"
                            style={{ color: colors.label }}>
                            📌 {task.title}{changeLabel}
                          </span>
                        </div>
                      )}

                      {/* ── Sin ninguna fecha: mostrar etiqueta de aviso ── */}
                      {!task.start_date && !effectiveEnd && (
                        <div
                          className="absolute flex items-center"
                          style={{ left: todayPx + 8, top: ROW_HEIGHT / 2 - 9, height: 18 }}
                          title="Esta tarea no tiene fechas asignadas"
                        >
                          <span className="text-[10px] text-orange-400 font-medium bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                            ⚠️ Sin fecha
                          </span>
                        </div>
                      )}

                      {/* ── Marcador de fecha límite: solo tiene fecha de fin, sin fecha de inicio ── */}
                      {!task.start_date && effectiveEnd && (
                        <div
                          className="absolute flex items-center justify-center"
                          style={{ left: pxFromDate(effectiveEnd) - 6, top: ROW_HEIGHT / 2 - 6, width: 12, height: 12 }}
                          title={`Fecha límite: ${effectiveEnd} — El equipo aún no agendó inicio`}
                        >
                          <div className="w-2.5 h-2.5 rotate-45 rounded-sm opacity-50" style={{ background: colors.progress, border: `1px dashed ${colors.progress}` }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pie de página */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400">
        Las barras muestran el progreso de cada tarea. El relleno crece con el tiempo hasta la fecha de compromiso.
        {tasks.filter(t => !t.start_date && !t.commitment_date).length > 0 && (
          <span className="ml-1 text-orange-500">
            · {tasks.filter(t => !t.start_date && !t.commitment_date).length} tarea(s) sin fechas asignadas.
          </span>
        )}
      </div>
    </div>
  )
}
