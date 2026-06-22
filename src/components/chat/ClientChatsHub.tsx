import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Client, Project, User } from '../../types'
import ClientChatRoom from './ClientChatRoom'
import CreateTaskModal from '../admin/CreateTaskModal'

interface Props {
  initialClients?: Client[]
}

export default function ClientChatsHub({ initialClients }: Props) {
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>(initialClients || [])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [convertTask, setConvertTask] = useState<{ content: string; messageId: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [user])

  async function fetchData() {
    if (!user) return
    setLoading(true)

    const [{ data: proj }, { data: team }] = await Promise.all([
      supabase.from('projects').select('*, client:clients(*)').eq('status', 'activo'),
      supabase.from('users').select('*').eq('role', 'team'),
    ])
    setProjects(proj || [])
    setTeamMembers(team || [])

    let clientList: Client[] = []

    if (user.role === 'admin') {
      // Admin ve todos los clientes
      const { data: cls } = await supabase.from('clients').select('*').order('name')
      clientList = cls || []
    } else {
      // Equipo ve clientes de client_team_members + clientes de proyectos con tareas asignadas
      const clientIds = new Set<string>()

      // 1. client_team_members
      const { data: assignments } = await supabase
        .from('client_team_members').select('client_id').eq('user_id', user.id)
      ;(assignments || []).forEach((a: any) => { if (a.client_id) clientIds.add(a.client_id) })

      // 2. Tareas asignadas → project_id → client_id (dos pasos para evitar problemas de RLS en joins)
      const { data: taskData } = await supabase
        .from('tasks').select('project_id').eq('assigned_to', user.id)
      const projectIds = [...new Set((taskData || []).map((t: any) => t.project_id).filter(Boolean))]

      if (projectIds.length > 0) {
        const { data: projectData } = await supabase
          .from('projects').select('client_id').in('id', projectIds)
        ;(projectData || []).forEach((p: any) => { if (p.client_id) clientIds.add(p.client_id) })
      }

      if (clientIds.size > 0) {
        const { data: cls } = await supabase
          .from('clients').select('*').in('id', [...clientIds]).order('name')
        clientList = cls || []
      }
    }

    setClients(clientList)
    if (clientList.length > 0) setSelectedClient(clientList[0])
    setLoading(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Cargando chats...</div>
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
        <p>No hay clientes registrados aún</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Lista de clientes */}
      <div className="w-56 shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="px-3 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clientes</p>
        </div>
        <div className="overflow-y-auto flex-1">
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className={`w-full text-left px-3 py-3 border-b border-gray-50 transition ${selectedClient?.id === client.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{client.name}</p>
                  <p className="text-xs text-gray-400 truncate">{client.company}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat room */}
      <div className="flex-1">
        {selectedClient ? (
          <ClientChatRoom
            client={selectedClient}
            onConvertToTask={(content, messageId) => setConvertTask({ content, messageId })}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 bg-white border border-gray-200 rounded-xl">
            <p className="text-sm">Selecciona un cliente para ver el chat</p>
          </div>
        )}
      </div>

      {/* Modal para convertir mensaje en tarea */}
      {convertTask && (
        <CreateTaskModal
          projects={projects}
          teamMembers={teamMembers}
          prefillTitle={convertTask.content}
          onClose={() => setConvertTask(null)}
          onCreated={() => setConvertTask(null)}
        />
      )}
    </div>
  )
}
