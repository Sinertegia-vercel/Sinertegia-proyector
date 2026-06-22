import { useEffect, useState } from 'react'
import { Users, FolderKanban, AlertTriangle, TrendingUp, Calendar, ClipboardList, MessageSquare, MessageCircle, Map, Inbox, UserCheck, SpellCheck, Link2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Task, Project, User, Client } from '../../types'
import ProgressBar from '../shared/ProgressBar'
import ProjectDetail from './ProjectDetail'
import TeamCapacity from './TeamCapacity'
import TeamCalendar from './TeamCalendar'
import TeamPerformance from './TeamPerformance'
import CreateTaskModal from './CreateTaskModal'
import CreateProjectModal from './CreateProjectModal'
import TeamDashboard from '../team/TeamDashboard'
import TeamChat from '../chat/TeamChat'
import ClientChatsHub from '../chat/ClientChatsHub'
import RoadmapView from '../roadmap/RoadmapView'
import TaskRequestsPanel from './TaskRequestsPanel'
import ClientAssignmentManager from './ClientAssignmentManager'
import ClientReportModal from './ClientReportModal'
import SpellingChecker from './SpellingChecker'
import ClientDeliverables from './ClientDeliverables'
import { usePresence } from '../../hooks/usePresence'
import { useAuth } from '../../contexts/AuthContext'
import TaskDetailModal from '../team/TaskDetailModal'

type View = 'overview' | 'project' | 'team' | 'calendar' | 'performance' | 'mytasks' | 'roadmap' | 'requests' | 'chat_team' | 'chat_clients' | 'clientes' | 'spelling' | 'entregables' | 'create' | 'create_project'
type StatusFilter = 'activo' | 'pausado' | 'completado' | 'todos'

const STATUS_FILTER_LABELS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'completado', label: 'Completados' },
]

const STATUS_BADGE: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  pausado: 'bg-yellow-100 text-yellow-700',
  completado: 'bg-gray-100 text-gray-600',
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('overview')
  const onlineIds = usePresence()
  const [reportProject, setReportProject] = useState<Project | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('activo')
  const [notifTask, setNotifTask] = useState<Task | null>(null)
  const [unreadTeamChat, setUnreadTeamChat] = useState(0)
  const [unreadClientChat, setUnreadClientChat] = useState(0)

  useEffect(() => {
    fetchAll()
  }, [])

  // ── open-task desde campanita ────────────────────────────────────────────
  useEffect(() => {
    async function handleOpenTask(e: Event) {
      const taskId = (e as CustomEvent).detail?.taskId
      if (!taskId) return
      const { data } = await supabase.from('tasks')
        .select('*, project:projects(*, client:clients(*)), links:task_links(*)')
        .eq('id', taskId).single()
      if (data) setNotifTask(data as Task)
    }
    window.addEventListener('open-task', handleOpenTask)
    return () => window.removeEventListener('open-task', handleOpenTask)
  }, [])

  // ── open-chat desde campanita ─────────────────────────────────────────────
  useEffect(() => {
    function handleOpenChat(e: Event) {
      const room = (e as CustomEvent).detail?.room
      if (room === 'team') setView('chat_team')
      else if (room === 'client') setView('chat_clients')
    }
    window.addEventListener('open-chat', handleOpenChat)
    return () => window.removeEventListener('open-chat', handleOpenChat)
  }, [])

  // ── badges de chat en tiempo real ────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    let teamRoomId: string | null = null

    async function setupChatBadges() {
      const { data: teamRoom } = await supabase
        .from('chat_rooms').select('id').eq('type', 'team').maybeSingle()
      if (teamRoom) teamRoomId = teamRoom.id

      const channel = supabase.channel('admin-chat-badges')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
          (payload) => {
            const msg = payload.new as any
            if (msg.user_id === user?.id) return
            if (teamRoomId && msg.room_id === teamRoomId) {
              setUnreadTeamChat(n => n + 1)
            } else {
              setUnreadClientChat(n => n + 1)
            }
          }
        ).subscribe()
      return () => { supabase.removeChannel(channel) }
    }

    const cleanup = setupChatBadges()
    return () => { cleanup.then(fn => fn?.()) }
  }, [user])

  async function fetchAll() {
    const [{ data: proj }, { data: tsk }, { data: team }, { data: cls }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*, project:projects(*, client:clients(*)), assignee:users!assigned_to(*), links:task_links(*)'),
      supabase.from('users').select('*').eq('role', 'team'),
      supabase.from('clients').select('*').order('name'),
    ])
    setProjects(proj || [])
    setTasks(tsk || [])
    setTeamMembers(team || [])
    setClients(cls || [])
    setLoading(false)
  }

  function getProjectProgress(projectId: string) {
    const ptasks = tasks.filter(t => t.project_id === projectId)
    if (!ptasks.length) return 0
    return (ptasks.filter(t => t.status === 'completada').length / ptasks.length) * 100
  }

  const overdueTasks = tasks.filter(t =>
    t.commitment_date && t.status !== 'completada' && new Date(t.commitment_date) < new Date()
  )

  // Tareas que el equipo mandó a revisión y esperan autorización del trafficker
  const pendingTraffickerReview = tasks.filter(t => t.review_status === 'pendiente_revision')
  // Tareas donde el cliente solicitó cambios
  const clientChangesRequested = tasks.filter(t => (t as any).client_approval === 'cambios_solicitados')

  const filteredProjects = statusFilter === 'todos'
    ? projects
    : projects.filter(p => p.status === statusFilter)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Panel de Control</h2>
          <p className="text-sm text-gray-500">{projects.filter(p => p.status === 'activo').length} proyectos activos · {teamMembers.length} personas en el equipo</p>
        </div>


        <div className="flex gap-2">
          <button
            onClick={() => setView('create_project')}
            className="border border-blue-600 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition"
          >
            + Nuevo proyecto
          </button>
          <button
            onClick={() => setView('create')}
            className="bg-gradient-to-r from-blue-700 to-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition"
          >
            + Nueva tarea
          </button>
        </div>
      </div>

      {/* ── Panel: revisiones pendientes del trafficker ── */}
      {(pendingTraffickerReview.length > 0 || clientChangesRequested.length > 0) && (
        <div className="mb-5 space-y-3">
          {pendingTraffickerReview.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm font-bold text-yellow-800 mb-3">
                🔍 {pendingTraffickerReview.length} tarea{pendingTraffickerReview.length > 1 ? 's' : ''} esperando tu autorización
              </p>
              <div className="space-y-2">
                {pendingTraffickerReview.map(t => (
                  <div key={t.id}
                    onClick={() => { setSelectedProject(t.project || null); setView('project') }}
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
          {clientChangesRequested.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-bold text-orange-800 mb-3">
                ✍️ {clientChangesRequested.length} cliente{clientChangesRequested.length > 1 ? 's solicitaron' : ' solicitó'} cambios
              </p>
              <div className="space-y-2">
                {clientChangesRequested.map(t => (
                  <div key={t.id}
                    onClick={() => { setSelectedProject(t.project || null); setView('project') }}
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
      )}

      {/* Nav tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'overview', label: 'Proyectos', icon: FolderKanban },
          { id: 'team', label: 'Capacidad del equipo', icon: Users },
          { id: 'calendar', label: 'Calendario', icon: Calendar },
          { id: 'performance', label: 'Rendimiento', icon: TrendingUp },
          { id: 'mytasks', label: 'Mis tareas', icon: ClipboardList },
          { id: 'roadmap', label: 'Hoja de Ruta', icon: Map },
          { id: 'clientes', label: 'Clientes', icon: UserCheck },
          { id: 'requests', label: 'Solicitudes', icon: Inbox },
          { id: 'chat_team', label: 'Chat Equipo', icon: MessageSquare },
          { id: 'chat_clients', label: 'Chat Clientes', icon: MessageCircle },
          { id: 'entregables', label: 'Entregables', icon: Link2 },
          { id: 'spelling', label: 'Ortografía', icon: SpellCheck },
        ].map(({ id, label, icon: Icon }) => {
          const badge = id === 'chat_team' ? unreadTeamChat : id === 'chat_clients' ? unreadClientChat : 0
          return (
            <button key={id} onClick={() => {
              setView(id as View)
              if (id === 'chat_team') setUnreadTeamChat(0)
              if (id === 'chat_clients') setUnreadClientChat(0)
            }}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap shrink-0 ${view === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15} /> {label}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Alertas */}
      {overdueTasks.length > 0 && view === 'overview' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">{overdueTasks.length} tarea{overdueTasks.length > 1 ? 's' : ''} vencida{overdueTasks.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-500 mt-0.5">{overdueTasks.slice(0, 5).map(t => t.title).join(', ')}{overdueTasks.length > 5 ? ` +${overdueTasks.length - 5} más` : ''}</p>
          </div>
        </div>
      )}

      {/* Vista de proyectos */}
      {view === 'overview' && (
        <div>
          {/* Filtro por estado */}
          <div className="flex gap-2 mb-4">
            {STATUS_FILTER_LABELS.map(({ value, label }) => (
              <button key={value} onClick={() => setStatusFilter(value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${statusFilter === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label}
                <span className="ml-1.5 text-xs opacity-70">
                  {value === 'todos' ? projects.length : projects.filter(p => p.status === value).length}
                </span>
              </button>
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FolderKanban size={32} className="mx-auto mb-2 opacity-30" />
              <p>No hay proyectos {statusFilter !== 'todos' ? `"${STATUS_FILTER_LABELS.find(s => s.value === statusFilter)?.label.toLowerCase()}"` : ''}</p>
              <button onClick={() => setView('create_project')} className="mt-3 text-blue-600 text-sm hover:underline">
                + Crear el primer proyecto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const pct = getProjectProgress(project.id)
                const ptasks = tasks.filter(t => t.project_id === project.id)
                const overdue = ptasks.filter(t => t.commitment_date && t.status !== 'completada' && new Date(t.commitment_date) < new Date())
                return (
                  <div key={project.id}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition hover:border-blue-300">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedProject(project); setView('project') }}>
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide truncate">{project.client?.name}</p>
                        <h3 className="font-semibold text-gray-800 mt-0.5 truncate">{project.name}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[project.status] || 'bg-gray-100 text-gray-600'}`}>
                          {project.status === 'activo' ? 'Activo' : project.status === 'pausado' ? 'Pausado' : 'Completado'}
                        </span>
                        {overdue.length > 0 && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠ {overdue.length}</span>
                        )}
                      </div>
                    </div>
                    <div onClick={() => { setSelectedProject(project); setView('project') }} className="cursor-pointer">
                      <ProgressBar percentage={pct} />
                      <div className="flex justify-between text-xs text-gray-400 mt-3">
                        <span>{ptasks.filter(t => t.status === 'completada').length}/{ptasks.length} tareas</span>
                        <span className="flex items-center gap-1"><TrendingUp size={11} /> {Math.round(pct)}%</span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setReportProject(project) }}
                      className="mt-3 w-full text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg py-1.5 hover:bg-indigo-50 transition"
                    >
                      Ver reporte del cliente
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Vista detalle de proyecto */}
      {view === 'project' && selectedProject && (
        <ProjectDetail
          project={selectedProject}
          tasks={tasks.filter(t => t.project_id === selectedProject.id)}
          onBack={() => setView('overview')}
          onUpdate={fetchAll}
          teamMembers={teamMembers}
          projects={projects}
        />
      )}

      {/* Vista capacidad del equipo */}
      {view === 'team' && <TeamCapacity teamMembers={teamMembers} tasks={tasks} onAssign={() => setView('create')} />}

      {/* Vista calendario */}
      {view === 'calendar' && <TeamCalendar teamMembers={teamMembers} tasks={tasks} onlineIds={onlineIds} />}

      {/* Vista rendimiento */}
      {view === 'performance' && <TeamPerformance teamMembers={teamMembers} tasks={tasks} />}

      {/* Vista mis tareas */}
      {view === 'mytasks' && <TeamDashboard />}

      {/* Vista hoja de ruta */}
      {view === 'roadmap' && <RoadmapView tasks={tasks} title="Todas las tareas del equipo" />}

      {/* Vista solicitudes de clientes */}
      {view === 'requests' && <TaskRequestsPanel />}

      {/* Vista chat interno del equipo */}
      {view === 'chat_team' && <TeamChat />}

      {/* Vista chat con clientes */}
      {view === 'chat_clients' && <ClientChatsHub initialClients={clients} />}

      {view === 'entregables' && <ClientDeliverables />}

      {view === 'spelling' && <SpellingChecker />}

      {/* Vista: Asignación de clientes */}
      {view === 'clientes' && (
        <ClientAssignmentManager clients={clients} teamMembers={teamMembers} />
      )}

      {reportProject && (
        <ClientReportModal project={reportProject} tasks={tasks} onClose={() => setReportProject(null)} />
      )}

      {/* Modal nueva tarea */}
      {view === 'create' && (
        <CreateTaskModal projects={projects} teamMembers={teamMembers}
          onClose={() => setView('overview')} onCreated={fetchAll} />
      )}

      {/* Modal nuevo proyecto */}
      {view === 'create_project' && (
        <CreateProjectModal clients={clients} teamMembers={teamMembers}
          onClose={() => setView('overview')} onCreated={fetchAll} />
      )}

      {/* Modal tarea desde campanita */}
      {notifTask && (
        <TaskDetailModal task={notifTask} onClose={() => setNotifTask(null)} onUpdate={fetchAll} />
      )}
    </div>
  )
}
