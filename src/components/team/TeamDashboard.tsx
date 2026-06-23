import { useEffect, useState } from 'react'
import { MessageSquare, CheckCircle, Clock, ClipboardList, MessageCircle, Map, Plus, CalendarDays, Link2, Loader2, XCircle, FileText } from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Task, Project, User, Priority } from '../../types'
import PriorityBadge from '../shared/PriorityBadge'
import StatusBadge from '../shared/StatusBadge'
import Sidebar from '../shared/Sidebar'
import TopBarActions from '../shared/TopBarActions'
import TaskDetailModal from './TaskDetailModal'
import TeamChat from '../chat/TeamChat'
import ClientChatsHub from '../chat/ClientChatsHub'
import RoadmapView from '../roadmap/RoadmapView'
import TeamCalendarView from './TeamCalendarView'
import CreateTaskModal from '../admin/CreateTaskModal'
import ClientDeliverables from '../admin/ClientDeliverables'

type TeamView = 'tasks' | 'calendar' | 'roadmap' | 'chat_team' | 'chat_clients' | 'entregables'

const TEAM_NAV_ITEMS = [
  { id: 'tasks' as TeamView, label: 'Mis tareas', icon: ClipboardList },
  { id: 'calendar' as TeamView, label: 'Mi Calendario', icon: CalendarDays },
  { id: 'roadmap' as TeamView, label: 'Hoja de Ruta', icon: Map },
  { id: 'chat_team' as TeamView, label: 'Chat del Equipo', icon: MessageSquare },
  { id: 'chat_clients' as TeamView, label: 'Chat con Clientes', icon: MessageCircle },
  { id: 'entregables' as TeamView, label: 'Entregables', icon: Link2 },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const PRIORITY_CHART: Record<Priority, { label: string; color: string }> = {
  critica: { label: 'Crítica', color: '#ef4444' },
  alta: { label: 'Alta', color: '#f97316' },
  media: { label: 'Media', color: '#eab308' },
  baja: { label: 'Baja', color: '#22c55e' },
}

interface Props {
  embedded?: boolean
}

export default function TeamDashboard({ embedded = false }: Props) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [reviewTasks, setReviewTasks] = useState<Task[]>([])
  const [myReviewTasks, setMyReviewTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [filter, setFilter] = useState<'todas' | 'pendiente' | 'en_progreso' | 'completada'>('todas')
  const [teamView, setTeamView] = useState<TeamView>('tasks')

  const isTraffickerOrLider = user?.department === 'trafficker' || user?.department === 'lider'

  useEffect(() => {
    if (user) {
      fetchTasks()
      fetchProjects()
      fetchTeamMembers()
      fetchMyReviewTasks()
      if (isTraffickerOrLider) fetchReviewTasks()
    }
  }, [user])

  useEffect(() => {
    async function handleOpenTask(e: Event) {
      const taskId = (e as CustomEvent).detail?.taskId
      if (!taskId) return
      const { data } = await supabase
        .from('tasks')
        .select('*, project:projects(*, client:clients(*)), links:task_links(*), comments:task_comments(count)')
        .eq('id', taskId)
        .single()
      if (data) {
        setTeamView('tasks')
        setSelectedTask(data as any)
      }
    }
    window.addEventListener('open-task', handleOpenTask)
    return () => window.removeEventListener('open-task', handleOpenTask)
  }, [])

  useEffect(() => {
    function handleOpenChat(e: Event) {
      const room = (e as CustomEvent).detail?.room
      if (room === 'team') setTeamView('chat_team')
      else if (room === 'client') setTeamView('chat_clients')
    }
    window.addEventListener('open-chat', handleOpenChat)
    return () => window.removeEventListener('open-chat', handleOpenChat)
  }, [])

  async function fetchTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, project:projects(*, client:clients(*)), links:task_links(*), comments:task_comments(count)')
      .eq('assigned_to', user!.id)
      .order('priority', { ascending: true })
      .order('commitment_date', { ascending: true })
    setTasks(data || [])
    setLoading(false)
  }

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select('*, client:clients(*)')
      .eq('status', 'activo')
      .order('name')
    setProjects(data || [])
  }

  async function fetchTeamMembers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('role', ['team', 'admin'])
      .order('full_name')
    setTeamMembers(data || [])
  }

  async function fetchMyReviewTasks() {
    // Solo mostrar tareas que aún están esperando la revisión del usuario
    // Excluir las que ya fueron procesadas (aprobadas o con cambios solicitados)
    const { data } = await supabase
      .from('tasks')
      .select('*, project:projects(*, client:clients(*)), links:task_links(*)')
      .eq('reviewer_id', user!.id)
      .eq('review_status', 'pendiente_revision')
      .order('created_at', { ascending: false })
    setMyReviewTasks((data as any) || [])
  }

  async function fetchReviewTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('*, project:projects(*, client:clients(*)), links:task_links(*)')
      .or('review_status.eq.pendiente_revision,review_status.eq.pendiente_trafficker,client_approval.eq.cambios_solicitados')
      .order('created_at', { ascending: false })
    setReviewTasks((data as any) || [])
  }

  const filtered = filter === 'todas' ? tasks.filter(t => t.status !== 'completada') : tasks.filter(t => t.status === filter)
  const isOverdue = (t: Task) => t.commitment_date && t.status !== 'completada' && new Date(t.commitment_date) < new Date()

  const stats = {
    total: tasks.length,
    pendiente: tasks.filter(t => t.status === 'pendiente').length,
    en_progreso: tasks.filter(t => t.status === 'en_progreso').length,
    completada: tasks.filter(t => t.status === 'completada').length,
    vencidas: tasks.filter(isOverdue).length,
  }

  // Distribución de prioridades para la gráfica de dona
  const priorityData = (Object.keys(PRIORITY_CHART) as Priority[])
    .map(p => ({ name: PRIORITY_CHART[p].label, value: tasks.filter(t => t.priority === p).length, color: PRIORITY_CHART[p].color }))
    .filter(d => d.value > 0)

  // Tareas completadas por día de la semana (acumulado Lun → Dom)
  const completedByWeekday = WEEKDAYS.map(() => 0)
  tasks.forEach(t => {
    if (t.status === 'completada' && t.completion_date) {
      const jsDay = new Date(t.completion_date + 'T00:00:00').getDay()
      const idx = jsDay === 0 ? 6 : jsDay - 1
      completedByWeekday[idx]++
    }
  })
  let runningTotal = 0
  const weeklyProgress = WEEKDAYS.map((day, i) => {
    runningTotal += completedByWeekday[i]
    return { day, completadas: runningTotal }
  })

  // Próximas 3 entregas (no completadas, con fecha de compromiso)
  const upcoming = tasks
    .filter(t => t.status !== 'completada' && t.commitment_date)
    .sort((a, b) => new Date(a.commitment_date!).getTime() - new Date(b.commitment_date!).getTime())
    .slice(0, 3)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando tareas...</div>

  const reviewBanners = (
    <>
      {/* Paneles de revisión para trafficker/lider */}
      {isTraffickerOrLider && reviewTasks.length > 0 && (() => {
        const pendingAuth = reviewTasks.filter((t: any) => t.review_status === 'pendiente_revision' || t.review_status === 'pendiente_trafficker')
        const clientChanges = reviewTasks.filter((t: any) => t.client_approval === 'cambios_solicitados')
        return (
          <div className="mb-5 space-y-3">
            {pendingAuth.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm font-bold text-yellow-800 mb-3">
                  🔍 {pendingAuth.length} tarea{pendingAuth.length > 1 ? 's' : ''} esperando tu autorización
                </p>
                <div className="space-y-2">
                  {pendingAuth.map((t: any) => (
                    <div key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-yellow-100 cursor-pointer hover:border-yellow-300 transition">
                      <span className="text-yellow-500 shrink-0">🔍</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400">{t.project?.client?.name} — {t.project?.name}</p>
                      </div>
                      <span className="text-xs text-yellow-700 font-semibold bg-yellow-100 px-2 py-0.5 rounded-full shrink-0">Autorizar</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {clientChanges.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <p className="text-sm font-bold text-orange-800 mb-3">
                  ✍️ {clientChanges.length} cliente{clientChanges.length > 1 ? 's solicitaron' : ' solicitó'} cambios
                </p>
                <div className="space-y-2">
                  {clientChanges.map((t: any) => (
                    <div key={t.id}
                      onClick={() => setSelectedTask(t)}
                      className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-orange-100 cursor-pointer hover:border-orange-300 transition">
                      <span className="text-orange-500 shrink-0">✍️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                        <p className="text-xs text-gray-400">{t.project?.client?.name} — {t.project?.name}</p>
                      </div>
                      <span className="text-xs text-orange-700 font-semibold bg-orange-100 px-2 py-0.5 rounded-full shrink-0">Ver cambios</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Panel: Tareas que me toca revisar (para cualquier miembro del equipo) */}
      {myReviewTasks.length > 0 && (
        <div className="mb-5">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <p className="text-sm font-bold text-purple-800 mb-3">
              👀 {myReviewTasks.length} tarea{myReviewTasks.length > 1 ? 's' : ''} esperando tu revisión
            </p>
            <div className="space-y-2">
              {myReviewTasks.map((t: any) => (
                <div key={t.id}
                  onClick={() => setSelectedTask(t)}
                  className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-purple-100 cursor-pointer hover:border-purple-300 transition">
                  <span className="text-purple-500 shrink-0">👀</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                    <p className="text-xs text-gray-400">{t.project?.client?.name} — {t.project?.name}</p>
                  </div>
                  <span className="text-xs text-purple-700 font-semibold bg-purple-100 px-2 py-0.5 rounded-full shrink-0">Revisar</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )

  const otherViews = (
    <>
      {/* Vista: Mi Calendario */}
      {teamView === 'calendar' && (
        <TeamCalendarView tasks={tasks} onSelectTask={setSelectedTask} />
      )}

      {/* Vista: Hoja de Ruta */}
      {teamView === 'roadmap' && <RoadmapView tasks={tasks} title="Mis tareas en el tiempo" />}

      {/* Vista: Chat del Equipo */}
      {teamView === 'chat_team' && <TeamChat />}

      {/* Vista: Chat con Clientes */}
      {teamView === 'chat_clients' && <ClientChatsHub />}

      {/* Vista: Entregables */}
      {teamView === 'entregables' && <ClientDeliverables />}
    </>
  )

  const taskTable = (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 min-w-[220px]">Tarea</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Estatus</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Prioridad</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap" title="Fecha de compromiso de entrega">Fecha de entrega</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Entregables</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Com.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay tareas en esta categoría</td></tr>
            )}
            {filtered.map(task => (
              <tr
                key={task.id}
                className={`hover:bg-gray-50 cursor-pointer transition ${isOverdue(task) ? 'bg-red-50' : ''}`}
                onClick={() => setSelectedTask(task)}
              >
                <td className="px-4 py-3 max-w-[260px]">
                  <div className="flex items-center gap-2">
                    {task.status === 'completada'
                      ? <CheckCircle size={16} className="text-green-500 shrink-0" />
                      : <Clock size={16} className={`shrink-0 ${isOverdue(task) ? 'text-red-500' : 'text-gray-400'}`} />
                    }
                    <span className={`font-medium truncate ${task.status === 'completada' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{task.project?.client?.name || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-3 whitespace-nowrap"><PriorityBadge priority={task.priority} /></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`flex items-center gap-1 text-xs ${isOverdue(task) ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    <CalendarDays size={12} className="shrink-0" />
                    {task.commitment_date ? new Date(task.commitment_date).toLocaleDateString('es-MX') : '—'}
                    {isOverdue(task) && ' ⚠️'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`flex items-center gap-1 text-xs ${task.links && task.links.length > 0 ? 'text-blue-500' : 'text-gray-300'}`}>
                    <FileText size={14} />
                    {task.links && task.links.length > 0 && task.links.length}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-gray-400 text-xs">
                    <MessageSquare size={14} />
                    {(task.comments as any)?.[0]?.count > 0 && (task.comments as any)[0].count}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const filterPills = (
    <div className="flex gap-2 mb-4">
      {(['todas', 'pendiente', 'en_progreso', 'completada'] as const).map(f => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >
          {f === 'todas' ? 'Todas' : f === 'en_progreso' ? 'En progreso' : f.charAt(0).toUpperCase() + f.slice(1)}
        </button>
      ))}
    </div>
  )

  const taskModals = (
    <>
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { fetchTasks(); fetchMyReviewTasks() }}
          onReviewDone={(taskId) => setMyReviewTasks(prev => prev.filter(t => t.id !== taskId))}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          projects={projects}
          teamMembers={teamMembers}
          onClose={() => setShowCreateTask(false)}
          onCreated={() => { fetchTasks(); setShowCreateTask(false) }}
        />
      )}
    </>
  )

  // ── Vista embebida dentro del Admin ("Mis tareas"): se queda igual que antes ──
  if (embedded) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mi espacio</h2>
            <p className="text-sm text-gray-500">Hola {user?.full_name}</p>
          </div>
          <button
            onClick={() => setShowCreateTask(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-700 to-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            <Plus size={16} /> Nueva tarea
          </button>
        </div>

        {reviewBanners}

        <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
          {TEAM_NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTeamView(id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${teamView === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {otherViews}

        {teamView === 'tasks' && (<>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, icon: ClipboardList, bg: 'bg-purple-100', color: 'text-purple-600' },
              { label: 'Pendientes', value: stats.pendiente, icon: Clock, bg: 'bg-orange-100', color: 'text-orange-600' },
              { label: 'En progreso', value: stats.en_progreso, icon: Loader2, bg: 'bg-blue-100', color: 'text-blue-600' },
              { label: 'Completadas', value: stats.completada, icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600' },
              { label: 'Vencidas', value: stats.vencidas, icon: XCircle, bg: 'bg-red-100', color: 'text-red-600' },
            ].map(({ label, value, icon: Icon, bg, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                  <p className="text-xs text-gray-500 truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>
          {filterPills}
          {taskTable}
        </>)}

        {taskModals}
      </div>
    )
  }

  // ── Vista completa "Mi espacio" (rol equipo) ──
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        items={TEAM_NAV_ITEMS}
        activeId={teamView}
        onSelect={id => setTeamView(id as TeamView)}
        collapsible
        theme="dark"
        brand={{ title: 'Sinertegia Launch 57', subtitle: 'Gestión de proyectos' }}
        tip={{ text: 'Organiza tus tareas con prioridades y fechas de entrega para mejorar tu productividad.' }}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Hola, {user?.full_name?.split(' ')[0]} 👋</h2>
            <p className="text-sm text-gray-500">Aquí tienes el estado de tus proyectos.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateTask(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-700 to-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition shrink-0"
            >
              <Plus size={16} /> Nueva tarea
            </button>
            <TopBarActions />
          </div>
        </div>

        {reviewBanners}
        {otherViews}

        {teamView === 'tasks' && (<>
          {/* Stats con % del total */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total de tareas', value: stats.total, icon: ClipboardList, bg: 'bg-purple-100', color: 'text-purple-600' },
              { label: 'Pendientes', value: stats.pendiente, icon: Clock, bg: 'bg-orange-100', color: 'text-orange-600' },
              { label: 'En progreso', value: stats.en_progreso, icon: Loader2, bg: 'bg-blue-100', color: 'text-blue-600' },
              { label: 'Completadas', value: stats.completada, icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600' },
              { label: 'Vencidas', value: stats.vencidas, icon: XCircle, bg: 'bg-red-100', color: 'text-red-600' },
            ].map(({ label, value, icon: Icon, bg, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
                  <p className="text-xs text-gray-500 truncate">{label}</p>
                  <p className="text-[11px] text-gray-400">
                    {stats.total > 0 ? Math.round((value / stats.total) * 100) : 0}% del total
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Gráficas + próximas entregas */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-800 mb-2">Resumen de progreso</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={weeklyProgress}>
                  <defs>
                    <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [v, 'Completadas']} />
                  <Area type="monotone" dataKey="completadas" stroke="#4f46e5" strokeWidth={2} fill="url(#progressFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col">
              <p className="text-sm font-bold text-gray-800 mb-2">Tareas por prioridad</p>
              {priorityData.length === 0 ? (
                <p className="text-xs text-gray-400 py-10 text-center">Sin tareas aún</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={2}>
                        {priorityData.map(d => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2.5 justify-center mt-2">
                    {priorityData.map(d => (
                      <span key={d.name} className="flex items-center gap-1 text-[11px] text-gray-500">
                        <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name} ({d.value})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-gray-800 mb-3">Próximas entregas</p>
              {upcoming.length === 0 ? (
                <p className="text-xs text-gray-400">No tienes entregas próximas</p>
              ) : (
                <div className="space-y-2.5">
                  {upcoming.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 cursor-pointer" onClick={() => setSelectedTask(t)}>
                      <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                        <CalendarDays size={14} className="text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-400">
                          {new Date(t.commitment_date! + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className="text-sm text-gray-700 truncate">{t.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setTeamView('calendar')}
                className="mt-3 text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                Ver calendario →
              </button>
            </div>
          </div>

          {filterPills}
          {taskTable}
        </>)}
      </div>

      {taskModals}
    </div>
  )
}
