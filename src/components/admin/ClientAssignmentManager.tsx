import { useEffect, useState } from 'react'
import { UserPlus, X, Link, Copy, Check, Plus, Workflow } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Client, User } from '../../types'
import UserAvatar from '../shared/UserAvatar'

interface Assignment {
  id: string
  client_id: string
  user_id: string
  user: User
}

interface Props {
  clients: Client[]
  teamMembers: User[]
  onCreateProject: () => void
  onOpenFunnels: () => void
}

export default function ClientAssignmentManager({ clients, teamMembers, onCreateProject, onOpenFunnels }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [adding, setAdding] = useState<{ clientId: string; userId: string } | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchAssignments()
  }, [])

  async function fetchAssignments() {
    const { data } = await supabase
      .from('client_team_members')
      .select('*, user:users(*)')
    setAssignments((data as any) || [])
  }

  function assignedTo(clientId: string): User[] {
    return assignments.filter(a => a.client_id === clientId).map(a => a.user)
  }

  function availableToAdd(clientId: string): User[] {
    const assignedIds = assignedTo(clientId).map(u => u.id)
    return teamMembers.filter(m => !assignedIds.includes(m.id))
  }

  async function addAssignment(clientId: string, userId: string) {
    setLoadingId(clientId)
    await supabase.from('client_team_members').insert({ client_id: clientId, user_id: userId })
    await fetchAssignments()
    setAdding(null)
    setLoadingId(null)
  }

  async function generateInviteLink(clientId: string) {
    const { data } = await supabase
      .from('client_invitations')
      .insert({ client_id: clientId })
      .select('id')
      .single()
    if (data) {
      const url = `https://agencia.sinertegia.com?invite=${data.id}`
      setGeneratedLinks(prev => ({ ...prev, [clientId]: url }))
    }
  }

  async function copyLink(clientId: string) {
    const link = generatedLinks[clientId]
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopiedId(clientId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function removeAssignment(clientId: string, userId: string) {
    setLoadingId(userId + clientId)
    await supabase.from('client_team_members')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', userId)
    await fetchAssignments()
    setLoadingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-gray-900">Clientes y accesos</h2><p className="text-sm text-gray-500">Crea un cliente con su proyecto, comparte su invitación y asigna al equipo responsable.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onOpenFunnels} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Workflow size={16} /> Administrar embudos</button>
          <button onClick={onCreateProject} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={16} /> Nuevo proyecto / cliente</button>
        </div>
      </div>

      {clients.map(client => {
        const assigned = assignedTo(client.id)
        const available = availableToAdd(client.id)
        const isAddingHere = adding?.clientId === client.id

        return (
          <div key={client.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{client.name}</p>
                <p className="text-xs text-gray-400">{client.company}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => generateInviteLink(client.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition"
                >
                  <Link size={13} /> Invitar cliente
                </button>
                {available.length > 0 && (
                  <button
                    onClick={() => setAdding(isAddingHere ? null : { clientId: client.id, userId: '' })}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
                  >
                    <UserPlus size={13} /> Asignar equipo
                  </button>
                )}
              </div>
            </div>

            {/* Link de invitación generado */}
            {generatedLinks[client.id] && (
              <div className="mb-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <p className="text-xs text-green-700 flex-1 truncate font-mono">{generatedLinks[client.id]}</p>
                <button
                  onClick={() => copyLink(client.id)}
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-900 transition"
                >
                  {copiedId === client.id ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            )}

            {/* Dropdown para agregar */}
            {isAddingHere && (
              <div className="mb-3 flex gap-2">
                <select
                  value={adding.userId}
                  onChange={e => setAdding({ clientId: client.id, userId: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecciona integrante</option>
                  {available.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name} · {m.department}</option>
                  ))}
                </select>
                <button
                  disabled={!adding.userId || loadingId === client.id}
                  onClick={() => adding.userId && addAssignment(client.id, adding.userId)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
                >
                  {loadingId === client.id ? '...' : 'Agregar'}
                </button>
              </div>
            )}

            {/* Equipo asignado */}
            {assigned.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin equipo asignado</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {assigned.map(member => (
                  <div key={member.id}
                    className="flex items-center gap-1.5 bg-gray-100 rounded-full pl-1 pr-2 py-0.5">
                    <UserAvatar name={member.full_name} avatarUrl={member.avatar_url} size={22} />
                    <span className="text-xs font-medium text-gray-700">{member.full_name}</span>
                    <button
                      onClick={() => removeAssignment(client.id, member.id)}
                      disabled={loadingId === member.id + client.id}
                      className="text-gray-400 hover:text-red-500 transition ml-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
