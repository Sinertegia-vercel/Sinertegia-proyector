import { useMemo, useState } from 'react'
import { CalendarPlus, ChevronDown, Map, MoveHorizontal } from 'lucide-react'
import type { Task } from '../../types'

interface Props { tasks: Task[]; title?: string; onSelectTask?: (task: Task) => void }

const DAY = 86400000
const COLORS = [
  { bar: 'bg-purple-200 border-purple-400 text-purple-900', dot: 'bg-purple-500' },
  { bar: 'bg-green-200 border-green-400 text-green-900', dot: 'bg-green-500' },
  { bar: 'bg-blue-200 border-blue-400 text-blue-900', dot: 'bg-blue-500' },
  { bar: 'bg-amber-200 border-amber-400 text-amber-900', dot: 'bg-amber-500' },
  { bar: 'bg-orange-200 border-orange-400 text-orange-900', dot: 'bg-orange-500' },
]

function monday(date: Date) { const d = new Date(date); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d }
function key(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

export default function RoadmapView({ tasks, title, onSelectTask }: Props) {
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [showCompleted, setShowCompleted] = useState(false)
  const [anchor, setAnchor] = useState(() => monday(new Date()))
  const visible = tasks.filter(task => showCompleted || task.status !== 'completada')
  const undated = visible.filter(task => !task.start_date && !task.commitment_date)
  const dated = visible.filter(task => task.start_date || task.commitment_date)
  const clients = useMemo(() => Array.from(new Set(dated.map(task => task.project?.client?.name || task.project?.name || 'Trabajo interno'))), [dated])
  const daysCount = view === 'semana' ? 35 : 84
  const timelineStart = new Date(anchor.getTime() - 7 * DAY)
  const days = Array.from({ length: daysCount }, (_, index) => new Date(timelineStart.getTime() + index * DAY))
  const todayIndex = Math.round((monday(new Date()).getTime() + (new Date().getDay() || 7) * DAY - timelineStart.getTime()) / DAY)
  const colorFor = (client: string) => COLORS[Math.max(0, clients.indexOf(client)) % COLORS.length]

  function span(task: Task) {
    const start = new Date((task.start_date || task.commitment_date!) + 'T00:00:00')
    const end = new Date((task.completion_date || task.commitment_date || task.start_date!) + 'T00:00:00')
    const left = Math.max(0, Math.floor((start.getTime() - timelineStart.getTime()) / DAY))
    const width = Math.max(2, Math.ceil((end.getTime() - start.getTime()) / DAY) + 1)
    return { left, width: Math.min(width, daysCount - left) }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3"><Map size={27} className="text-blue-800" /><div><h2 className="text-xl font-bold text-slate-900">Hoja de ruta</h2>{title && <p className="text-xs text-slate-400">{title}</p>}</div></div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setAnchor(monday(new Date()))} className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700">Esta semana <ChevronDown size={14} /></button>
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">{(['semana', 'mes'] as const).map(item => <button key={item} onClick={() => setView(item)} className={`rounded-md px-5 py-2 text-xs font-semibold capitalize ${view === item ? 'bg-blue-800 text-white' : 'text-slate-600'}`}>{item}</button>)}</div>
          <label className="ml-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">Mostrar completadas<button type="button" onClick={() => setShowCompleted(value => !value)} className={`relative h-6 w-11 rounded-full transition ${showCompleted ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${showCompleted ? 'left-6' : 'left-1'}`} /></button></label>
        </div>
      </header>

      <div className="grid min-h-[620px] grid-cols-1 p-4 lg:grid-cols-[190px_minmax(900px,1fr)]">
        <aside className="border border-slate-200 bg-slate-50/50 lg:rounded-l-xl">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 px-3"><strong className="text-sm text-slate-800">Sin fecha ({undated.length})</strong><MoveHorizontal size={15} className="text-slate-400" /></div>
          <div className="space-y-3 p-2.5">{undated.slice(0, 8).map(task => { const client = task.project?.client?.name || task.project?.name || 'Trabajo interno'; const color = colorFor(client); return <button key={task.id} onClick={() => onSelectTask?.(task)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-300"><span className="block truncate text-xs font-bold text-slate-800">{task.title}</span><span className="mt-2 flex items-center gap-1.5 truncate text-[10px] text-slate-500"><span className={`h-2 w-2 rounded-full ${color.dot}`} />{client}</span></button> })}</div>
          <div className="m-2.5 mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center"><CalendarPlus className="mx-auto mb-2 text-blue-700" size={20} /><p className="text-xs font-semibold text-slate-700">Asigna fechas para visualizar las tareas restantes</p></div>
        </aside>

        <div className="overflow-x-auto rounded-r-xl border border-l-0 border-slate-200">
          <div className="min-w-[1050px]">
            <div className="grid h-12 border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `repeat(${daysCount}, minmax(30px, 1fr))` }}>
              {days.map((day, index) => <div key={key(day)} className={`border-l border-slate-200 px-1 pt-1 text-center ${index === todayIndex ? 'bg-blue-50' : ''}`}><span className="block text-[9px] font-semibold text-slate-500">{day.toLocaleDateString('es-MX', { weekday: 'short' })}</span><span className="text-[9px] text-slate-400">{day.getDate()}</span></div>)}
            </div>
            <div className="relative">
              {todayIndex >= 0 && todayIndex < daysCount && <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-blue-500" style={{ left: `${((todayIndex + .5) / daysCount) * 100}%` }}><span className="absolute -top-1 -translate-x-1/2 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">Hoy</span></div>}
              {clients.map(client => { const color = colorFor(client); const clientTasks = dated.filter(task => (task.project?.client?.name || task.project?.name || 'Trabajo interno') === client); return <div key={client} className="border-b border-slate-200"><div className="flex h-10 items-center gap-2 bg-slate-50/70 px-3"><span className={`h-2 w-2 rounded-full ${color.dot}`} /><strong className="text-xs text-slate-700">{client}</strong></div>{clientTasks.map(task => { const position = span(task); return <div key={task.id} className="relative h-12 border-t border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.65)_1px,transparent_1px)]" style={{ backgroundSize: `${100 / daysCount}% 100%` }}><button onClick={() => onSelectTask?.(task)} title={task.title} className={`absolute top-2 h-8 truncate rounded-md border px-2 text-[10px] font-semibold shadow-sm hover:brightness-95 ${color.bar}`} style={{ left: `${(position.left / daysCount) * 100}%`, width: `${(position.width / daysCount) * 100}%`, minWidth: 46 }}>{task.title}</button></div>})}</div> })}
              {clients.length === 0 && <div className="flex h-64 items-center justify-center text-sm text-slate-400">Asigna fechas a tus tareas para construir la hoja de ruta.</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
