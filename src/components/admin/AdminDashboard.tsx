import { useEffect, useState } from 'react'
import { Users, FolderKanban, TrendingUp, Calendar, ClipboardList, MessageSquare, MessageCircle, Map, Inbox, UserCheck, SpellCheck, Link2, ShieldCheck, KeyRound, Plus, Search, CheckCircle2, AlertTriangle as AlertTriangleIcon, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Task, Project, User, Client } from '../../types'
import Logo from '../shared/Logo'
import TopBarActions from '../shared/TopBarActions'
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
import RolePermissionsManager from './RolePermissionsManager'
import LicenseManager from './LicenseManager'
import { usePresence } from '../../hooks/usePresence'
import { useAuth } from '../../contexts/AuthContext'
import TaskDetailModal from '../team/TaskDetailModal'
import '../../styles/DashboardV2.css'

type View = 'overview' | 'project' | 'team' | 'calendar' | 'performance' | 'mytasks' | 'roadmap' | 'requests' | 'chat_team' | 'chat_clients' | 'clientes' | 'spelling' | 'entregables' | 'create' | 'create_project' | 'permisos' | 'licencia'
type StatusFilter = 'activo' | 'pausado' | 'completado' | 'todos'

const STATUS_FILTER_LABELS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'completado', label: 'Completados' },
]

const ADMIN_NAV_ITEMS = [
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
  { id: 'permisos', label: 'Permisos', icon: KeyRound },
]

const AVATAR_COLORS = ['#2757EB', '#0EA5E9', '#EC4899', '#12B886', '#F59E0B', '#8B5CF6', '#EF4444', '#0891B2', '#DB2777']

function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function fillClassFor(pct: number): string {
  if (pct >= 60) return 'g2'
  if (pct >= 30) return 'g1'
  return 'g0'
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
      supabase.from('users').select('*').eq('role', 'team').eq('active', true),
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

  const navItems = [
    ...ADMIN_NAV_ITEMS.map(item => ({
      ...item,
      badge: item.id === 'chat_team' ? unreadTeamChat : item.id === 'chat_clients' ? unreadClientChat : 0,
    })),
    ...(user?.is_super_admin ? [{ id: 'licencia', label: 'Licencia', icon: ShieldCheck, badge: 0 }] : []),
  ]

  function selectView(id: string) {
    setView(id as View)
    if (id === 'chat_team') setUnreadTeamChat(0)
    if (id === 'chat_clients') setUnreadClientChat(0)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>

  const currentNavLabel = navItems.find(i => i.id === view)?.label || 'Panel de Control'

  return (
    <div className="v2app">
      <div className="v2-shell">
        {/* ── Sidebar ── */}
        <aside className="v2-sidebar">
          <div className="v2-brand">
            <div className="v2-brand-mark"><Logo size={26} /></div>
            <div>
              <div className="v2-brand-name">Sinertegia Launch 57</div>
              <div className="v2-brand-sub">Gestión de proyectos</div>
            </div>
          </div>

          {navItems.map(({ id, label, icon: Icon, badge }) => (
            <button key={id} type="button" onClick={() => selectView(id)}
              className={`v2-nav-item ${view === id ? 'active' : ''}`}>
              <Icon size={17} />
              {label}
              {!!badge && <span className="v2-badge">{badge > 9 ? '9+' : badge}</span>}
            </button>
          ))}

          <div className="v2-tip">
            <div className="v2-tip-head">💡 Consejo rápido</div>
            <p>Organiza tus tareas con prioridades y fechas de entrega para mejorar tu productividad.</p>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="v2-main">
          <header className="v2-topbar">
            <span className="v2-top-title display">{currentNavLabel}</span>
            <div className="v2-top-spacer" />
            <TopBarActions />
          </header>

          <div className="v2-content">

            {/* ═══ Vista: Proyectos (overview) ═══ */}
            {view === 'overview' && (
              <>
                <div className="v2-page-head">
                  <div>
                    <h1 className="v2-page-title display">Panel de Control</h1>
                    <div className="v2-page-meta">
                      <span className="v2-stat-inline"><b className="mono">{projects.filter(p => p.status === 'activo').length}</b> proyectos activos</span>
                      <span className="v2-sep" />
                      <span className="v2-stat-inline"><b className="mono">{teamMembers.length}</b> personas en el equipo</span>
                    </div>
                  </div>
                  <div className="v2-actions">
                    <button className="v2-btn v2-btn-ghost" onClick={() => setView('create_project')}>
                      <Plus /> Nuevo proyecto
                    </button>
                    <button className="v2-btn v2-btn-primary" onClick={() => setView('create')}>
                      <Plus /> Nueva tarea
                    </button>
                  </div>
                </div>

                {/* Triage: autorizaciones y vencidas */}
                {(pendingTraffickerReview.length > 0 || overdueTasks.length > 0 || clientChangesRequested.length > 0) && (
                  <div className="v2-triage">
                    {pendingTraffickerReview.length > 0 && (
                      <div className="v2-alert warn" onClick={() => { setSelectedProject(pendingTraffickerReview[0].project || null); setView('project') }}>
                        <div className="v2-alert-icon"><Search /></div>
                        <div className="v2-alert-body">
                          <div className="v2-alert-kicker">{pendingTraffickerReview.length} tarea{pendingTraffickerReview.length > 1 ? 's' : ''} espera{pendingTraffickerReview.length > 1 ? 'n' : ''} tu autorización</div>
                          <div className="v2-alert-title">{pendingTraffickerReview[0].title}</div>
                          <div className="v2-alert-desc">{pendingTraffickerReview[0].project?.client?.name} — {pendingTraffickerReview[0].project?.name}</div>
                        </div>
                        <button className="v2-btn v2-btn-warn">Autorizar</button>
                      </div>
                    )}
                    {overdueTasks.length > 0 && (
                      <div className="v2-alert due" onClick={() => { setSelectedProject(overdueTasks[0].project || null); setView('project') }}>
                        <div className="v2-alert-icon"><AlertTriangleIcon /></div>
                        <div className="v2-alert-body">
                          <div className="v2-alert-kicker">{overdueTasks.length} tarea{overdueTasks.length > 1 ? 's' : ''} vencida{overdueTasks.length > 1 ? 's' : ''}</div>
                          <div className="v2-alert-title">{overdueTasks[0].title}</div>
                          <div className="v2-alert-desc">{overdueTasks[0].project?.client?.name} — {overdueTasks[0].project?.name}</div>
                        </div>
                        <button className="v2-btn v2-btn-ghost">Revisar</button>
                      </div>
                    )}
                    {clientChangesRequested.length > 0 && (
                      <div className="v2-alert warn" onClick={() => { setSelectedProject(clientChangesRequested[0].project || null); setView('project') }}>
                        <div className="v2-alert-icon">✍️</div>
                        <div className="v2-alert-body">
                          <div className="v2-alert-kicker">{clientChangesRequested.length} cliente{clientChangesRequested.length > 1 ? 's solicitaron' : ' solicitó'} cambios</div>
                          <div className="v2-alert-title">{clientChangesRequested[0].title}</div>
                          <div className="v2-alert-desc">{clientChangesRequested[0].project?.client?.name} — {clientChangesRequested[0].project?.name}</div>
                        </div>
                        <button className="v2-btn v2-btn-warn">Ver cambios</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Toolbar: tabs de estado */}
                <div className="v2-toolbar">
                  <div className="v2-tabs">
                    {STATUS_FILTER_LABELS.map(({ value, label }) => (
                      <button key={value} className={`v2-tab ${statusFilter === value ? 'active' : ''}`} onClick={() => setStatusFilter(value)}>
                        {label}
                        <span className="v2-count">{value === 'todos' ? projects.length : projects.filter(p => p.status === value).length}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid de proyectos */}
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <FolderKanban size={32} className="mx-auto mb-2 opacity-30" />
                    <p>No hay proyectos {statusFilter !== 'todos' ? `"${STATUS_FILTER_LABELS.find(s => s.value === statusFilter)?.label.toLowerCase()}"` : ''}</p>
                    <button onClick={() => setView('create_project')} className="mt-3 text-blue-600 text-sm hover:underline">
                      + Crear el primer proyecto
                    </button>
                  </div>
                ) : (
                  <div className="v2-grid">
                    {filteredProjects.map(project => {
                      const pct = getProjectProgress(project.id)
                      const ptasks = tasks.filter(t => t.project_id === project.id)
                      const done = ptasks.filter(t => t.status === 'completada').length
                      const clientName = project.client?.name || '—'
                      const cardTier = pct === 100 ? 'done' : pct === 0 ? 'idle' : ''
                      const pillClass = project.status === 'activo' ? 'active' : project.status === 'pausado' ? 'paused' : 'completed'
                      return (
                        <article key={project.id} className={`v2-card ${cardTier}`}
                          onClick={() => { setSelectedProject(project); setView('project') }}>
                          <div className="v2-card-top">
                            <div className="v2-avatar-sq" style={{ background: `linear-gradient(145deg, ${avatarColorFor(clientName)}, ${avatarColorFor(clientName)}cc)` }}>
                              {initialsOf(clientName)}
                            </div>
                            <div className="v2-card-headings">
                              <div className="v2-kicker-name">{clientName}</div>
                              <div className="v2-card-title">{project.name}</div>
                            </div>
                            <span className={`v2-pill ${pillClass}`}>
                              <span className="v2-pd" />
                              {project.status === 'activo' ? 'Activo' : project.status === 'pausado' ? 'Pausado' : 'Completado'}
                            </span>
                          </div>
                          <div>
                            <div className="v2-progress-row">
                              <span className="v2-progress-label">Progreso</span>
                              <span className={`v2-progress-val mono ${pct === 100 ? 'v2-v-done' : pct === 0 ? 'v2-v-idle' : pct >= 30 ? 'v2-v-warm' : 'v2-v-mid'}`}>
                                {Math.round(pct)}<span style={{ fontSize: 11 }}>%</span>
                              </span>
                            </div>
                            <div className="v2-track"><div className={`v2-fill ${fillClassFor(pct)}`} style={{ width: `${pct}%` }} /></div>
                          </div>
                          <div className="v2-card-foot">
                            <span className="v2-foot-info"><CheckCircle2 /> <b>{done}/{ptasks.length}</b> tareas</span>
                            <button className="v2-link-btn" onClick={e => { e.stopPropagation(); setReportProject(project) }}>
                              Ver reporte <ArrowRight />
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </>
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
            {view === 'team' && <TeamCapacity teamMembers={teamMembers} tasks={tasks} onAssign={() => setView('create')} onUpdate={fetchAll} />}

            {/* Vista calendario */}
            {view === 'calendar' && <TeamCalendar teamMembers={teamMembers} tasks={tasks} onlineIds={onlineIds} />}

            {/* Vista rendimiento */}
            {view === 'performance' && <TeamPerformance teamMembers={teamMembers} tasks={tasks} />}

            {/* Vista mis tareas */}
            {view === 'mytasks' && <TeamDashboard embedded />}

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

            {/* Vista: Permisos por rol */}
            {view === 'permisos' && <RolePermissionsManager />}

            {/* Vista: Licencia (solo súper admin) */}
            {view === 'licencia' && user?.is_super_admin && <LicenseManager />}

          </div>
        </div>
      </div>

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
