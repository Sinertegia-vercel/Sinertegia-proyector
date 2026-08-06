import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, LoaderCircle, Mail, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Client, Department, User } from '../../types'
import UserAvatar from '../shared/UserAvatar'

type Tab = 'client' | 'team' | 'admin'
type Section = { key: string; label: string; description: string }
type Permission = { user_id: string; section_key: string; allowed: boolean }

const SECTIONS: Record<Tab, Section[]> = {
  admin: [
    ['overview', 'Proyectos', 'Consultar y administrar proyectos'],
    ['team', 'Carga del equipo', 'Distribuir trabajo y revisar disponibilidad'],
    ['calendar', 'Calendario general', 'Consultar fechas de todo el equipo'],
    ['performance', 'Rendimiento', 'Acceder a métricas del equipo'],
    ['mytasks', 'Mis tareas', 'Trabajar en sus tareas'],
    ['roadmap', 'Hoja de ruta', 'Consultar la planeación general'],
    ['clientes', 'Clientes', 'Administrar clientes y asignaciones'],
    ['requests', 'Solicitudes', 'Autorizar solicitudes de clientes'],
    ['chat_team', 'Chat del equipo', 'Participar en conversaciones internas'],
    ['chat_clients', 'Chat con clientes', 'Conversar con clientes'],
    ['entregables', 'Entregables', 'Revisar y administrar entregables'],
    ['funnels', 'Embudos', 'Crear y modificar plantillas de proyectos'],
  ].map(([key, label, description]) => ({ key, label, description })),
  team: [
    ['tasks', 'Mis tareas', 'Consultar y trabajar en tareas asignadas'],
    ['calendar', 'Mi calendario', 'Ver fechas y compromisos'],
    ['roadmap', 'Hoja de ruta', 'Consultar la planeación de tareas'],
    ['chat_team', 'Chat del equipo', 'Participar en el chat interno'],
    ['chat_clients', 'Chat con clientes', 'Conversar con clientes asignados'],
    ['entregables', 'Entregables', 'Subir y consultar entregables'],
  ].map(([key, label, description]) => ({ key, label, description })),
  client: [
    ['mistareas', 'Mis tareas', 'Consultar tareas que requieren su participación'],
    ['progreso', 'Todas las tareas', 'Ver el avance completo'],
    ['area', 'Por área', 'Consultar trabajo por departamento'],
    ['calendario', 'Calendario', 'Ver fechas y compromisos'],
    ['roadmap', 'Hoja de ruta', 'Consultar la planeación del proyecto'],
    ['chat', 'Chat con el equipo', 'Comunicarse con el equipo'],
    ['entregables', 'Entregables', 'Revisar archivos y versiones finales'],
  ].map(([key, label, description]) => ({ key, label, description })),
}

const DEPARTMENTS: Department[] = ['edicion', 'grabacion', 'diseno', 'copy', 'webmaster', 'trafficker', 'lider']

interface Person {
  id: string
  userId?: string
  name: string
  email: string
  role: Tab
  subtitle: string
  active: boolean
  avatarUrl?: string | null
  isSuperAdmin?: boolean
}

export default function RolePermissionsManager() {
  const { user: currentUser } = useAuth()
  const [tab, setTab] = useState<Tab>('client')
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roleDefaults, setRoleDefaults] = useState<Record<string, boolean>>({})
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteStatus, setInviteStatus] = useState('')
  const [invite, setInvite] = useState({
    full_name: '',
    email: '',
    company: '',
    department: '' as Department | '',
  })
  const [invitePermissions, setInvitePermissions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    const [usersResult, clientsResult, permissionsResult, defaultsResult] = await Promise.all([
      supabase.from('users').select('*').order('full_name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('user_permissions').select('user_id, section_key, allowed'),
      supabase.from('role_permissions').select('role, section_key, allowed'),
    ])
    setUsers((usersResult.data as User[]) || [])
    setClients((clientsResult.data as Client[]) || [])
    setPermissions((permissionsResult.data as Permission[]) || [])
    const defaults: Record<string, boolean> = {}
    ;(defaultsResult.data || []).forEach((row) => {
      defaults[`${row.role}:${row.section_key}`] = row.allowed
    })
    setRoleDefaults(defaults)
    if (usersResult.error || clientsResult.error || permissionsResult.error) setError('No fue posible cargar todos los usuarios y permisos.')
    setLoading(false)
  }

  const people = useMemo<Person[]>(() => {
    if (tab === 'client')
      return clients.map((client) => {
        const linked = users.find((item) => item.id === client.user_id)
        return {
          id: client.id,
          userId: linked?.id,
          name: client.name,
          email: linked?.email || 'Invitación pendiente',
          role: 'client',
          subtitle: client.company || 'Cliente',
          active: client.active !== false && linked?.active !== false,
          avatarUrl: linked?.avatar_url || client.avatar_url,
        }
      })
    return users
      .filter((item) => item.role === tab)
      .map((item) => ({
        id: item.id,
        userId: item.id,
        name: item.full_name,
        email: item.email,
        role: tab,
        subtitle: item.department || (tab === 'admin' ? 'Administrador' : 'Equipo'),
        active: item.active !== false,
        avatarUrl: item.avatar_url,
        isSuperAdmin: item.is_super_admin,
      }))
  }, [tab, users, clients])

  const visiblePeople = people.filter((person) => `${person.name} ${person.email}`.toLowerCase().includes(search.toLowerCase()))
  const selected = people.find((person) => person.id === selectedId) || visiblePeople[0]

  function allowed(sectionKey: string) {
    if (selected?.isSuperAdmin) return true
    const specific = permissions.find((row) => row.user_id === selected?.userId && row.section_key === sectionKey)
    if (specific) return specific.allowed
    return roleDefaults[`${tab}:${sectionKey}`] !== false
  }

  async function toggle(sectionKey: string) {
    if (!selected?.userId || selected.isSuperAdmin) return
    const next = !allowed(sectionKey)
    setSaving(sectionKey)
    const { error: saveError } = await supabase.from('user_permissions').upsert({ user_id: selected.userId, section_key: sectionKey, allowed: next }, { onConflict: 'user_id,section_key' })
    if (saveError) setError('No se pudo guardar el permiso individual.')
    else
      setPermissions((previous) => [
        ...previous.filter((row) => !(row.user_id === selected.userId && row.section_key === sectionKey)),
        { user_id: selected.userId!, section_key: sectionKey, allowed: next },
      ])
    setSaving('')
  }

  async function toggleAll() {
    if (!selected?.userId || selected.isSuperAdmin) return
    const sections = SECTIONS[tab]
    const next = !sections.every((section) => allowed(section.key))
    setSaving('all')
    const payload = sections.map((section) => ({
      user_id: selected.userId!,
      section_key: section.key,
      allowed: next,
    }))
    const { error: saveError } = await supabase.from('user_permissions').upsert(payload, { onConflict: 'user_id,section_key' })
    if (saveError) setError('No se pudieron guardar los permisos.')
    else {
      setPermissions((previous) => [...previous.filter((row) => row.user_id !== selected.userId), ...payload])
    }
    setSaving('')
  }

  async function deactivate() {
    if (!selected || selected.isSuperAdmin || selected.userId === currentUser?.id) return
    if (!window.confirm(`¿Desactivar el acceso de ${selected.name}? El historial se conservará.`)) return
    setSaving('delete')
    if (selected.role === 'client') {
      await supabase.from('clients').update({ active: false }).eq('id', selected.id)
      if (selected.userId) await supabase.from('users').update({ active: false }).eq('id', selected.userId)
    } else if (selected.userId) await supabase.from('users').update({ active: false }).eq('id', selected.userId)
    await load()
    setSaving('')
  }

  function resetInvite() {
    setInvite({ full_name: '', email: '', company: '', department: '' })
    setInvitePermissions(Object.fromEntries(SECTIONS[tab].map((section) => [section.key, roleDefaults[`${tab}:${section.key}`] !== false])))
    setInviteLink('')
    setInviteStatus('')
    setError('')
  }

  async function createInvitation(event: React.FormEvent) {
    event.preventDefault()
    if (!invite.full_name.trim() || !invite.email.trim()) return
    setSaving('invite')
    setInviteStatus('')
    let url: string
    const permissionPreset = Object.fromEntries(SECTIONS[tab].map((section) => [section.key, invitePermissions[section.key] !== false]))
    if (tab === 'client') {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: invite.full_name.trim(),
          company: invite.company.trim() || invite.full_name.trim(),
          active: true,
        })
        .select('id')
        .single()
      if (clientError || !client) {
        setError('No se pudo crear el cliente.')
        setSaving('')
        return
      }
      const { data, error: invitationError } = await supabase
        .from('client_invitations')
        .insert({
          client_id: client.id,
          email: invite.email.trim(),
          permissions: permissionPreset,
        })
        .select('id')
        .single()
      if (invitationError || !data) {
        setError('No se pudo crear la invitación.')
        setSaving('')
        return
      }
      url = `https://agencia.sinertegia.com?invite=${data.id}`
    } else {
      const { data, error: invitationError } = await supabase
        .from('team_invitations')
        .insert({
          email: invite.email.trim(),
          full_name: invite.full_name.trim(),
          role: tab,
          department: invite.department || null,
          permissions: permissionPreset,
        })
        .select('id')
        .single()
      if (invitationError || !data) {
        setError('No se pudo crear la invitación.')
        setSaving('')
        return
      }
      url = `https://agencia.sinertegia.com?team_invite=${data.id}`
    }
    setInviteLink(url)
    const roleLabel = tab === 'admin' ? 'administrador' : tab === 'team' ? 'integrante del equipo' : 'cliente'
    const { error: mailError } = await supabase.functions.invoke('send-user-invitation', {
      body: {
        email: invite.email.trim(),
        fullName: invite.full_name.trim(),
        roleLabel,
        inviteUrl: url,
      },
    })
    setInviteStatus(mailError ? 'Invitación creada. Configura la función de correo o comparte el enlace.' : 'Invitación enviada por correo correctamente.')
    setSaving('')
    await load()
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteLink)
    setInviteStatus('Enlace copiado.')
  }

  if (loading)
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-400">
        <LoaderCircle className="animate-spin" size={18} /> Cargando usuarios y permisos...
      </div>
    )

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600">
            <KeyRound size={14} /> Administración
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios y permisos</h1>
          <p className="mt-1 text-sm text-gray-500">Administra el acceso individual de clientes, equipo y administradores.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetInvite()
            setInviteOpen(true)
          }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={17} /> Agregar persona
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(
          [
            ['client', 'Clientes'],
            ['team', 'Equipo'],
            ['admin', 'Administradores'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setTab(value)
              setSearch('')
            }}
            className={`rounded-lg px-5 py-2 text-sm font-semibold ${tab === value ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {label} <span className="ml-1 opacity-70">{value === tab ? people.length : ''}</span>
          </button>
        ))}
      </div>

      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        <aside className="border-r border-gray-200 bg-gray-50/60 p-4">
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar persona..." className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="space-y-2">
            {visiblePeople.map((person) => (
              <button
                key={person.id}
                onClick={() => setSelectedId(person.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected?.id === person.id ? 'border-blue-300 bg-blue-50' : 'border-transparent bg-white hover:border-gray-200'}`}
              >
                <UserAvatar name={person.name} avatarUrl={person.avatarUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 truncate text-sm font-bold text-gray-800">
                    {person.name}
                    {person.isSuperAdmin && <ShieldCheck size={14} className="text-amber-500" />}
                  </span>
                  <span className="block truncate text-xs text-gray-400">{person.email}</span>
                </span>
                <span className={`h-2.5 w-2.5 rounded-full ${person.active ? 'bg-green-500' : 'bg-gray-300'}`} />
              </button>
            ))}
          </div>
          {visiblePeople.length === 0 && <p className="py-12 text-center text-sm text-gray-400">No hay personas en esta sección.</p>}
        </aside>

        <main className="p-5 lg:p-7">
          {!selected ? (
            <div className="grid h-full place-items-center text-sm text-gray-400">Selecciona o agrega una persona.</div>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                    {selected.isSuperAdmin && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">Superadmin</span>}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {selected.subtitle} · {selected.email}
                  </p>
                </div>
                {!selected.isSuperAdmin && (
                  <button
                    onClick={deactivate}
                    disabled={saving === 'delete'}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} /> {selected.active ? 'Desactivar acceso' : 'Acceso desactivado'}
                  </button>
                )}
              </div>
              {!selected.userId ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Este cliente todavía no ha aceptado su invitación. Podrás personalizar sus permisos cuando cree su cuenta.
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-blue-900">Acceso a todas las secciones</p>
                      <p className="text-xs text-blue-600">Control individual para esta persona</p>
                    </div>
                    <button
                      onClick={toggleAll}
                      disabled={selected.isSuperAdmin || !!saving}
                      className={`relative h-7 w-12 rounded-full ${SECTIONS[tab].every((section) => allowed(section.key)) ? 'bg-blue-600' : 'bg-gray-300'} disabled:opacity-60`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${SECTIONS[tab].every((section) => allowed(section.key)) ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {SECTIONS[tab].map((section) => {
                      const enabled = allowed(section.key)
                      return (
                        <div key={section.key} className="flex items-center gap-3 px-4 py-3.5">
                          <span className={`grid h-9 w-9 place-items-center rounded-lg ${enabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <Check size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-gray-800">{section.label}</span>
                            <span className="block truncate text-xs text-gray-400">{section.description}</span>
                          </span>
                          <button
                            onClick={() => toggle(section.key)}
                            disabled={selected.isSuperAdmin || !!saving}
                            className={`relative h-6 w-11 rounded-full ${enabled ? 'bg-blue-600' : 'bg-gray-300'} disabled:opacity-60`}
                          >
                            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
                            {saving === section.key && <LoaderCircle className="absolute left-3.5 top-1.5 animate-spin text-white" size={11} />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {selected.isSuperAdmin && (
                    <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <ShieldCheck size={18} className="shrink-0" />
                      El superadmin siempre conserva acceso completo.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h2 className="font-bold text-gray-900">Agregar {tab === 'admin' ? 'administrador' : tab === 'team' ? 'integrante del equipo' : 'cliente'}</h2>
                <p className="text-xs text-gray-400">Se enviará una invitación para crear su acceso.</p>
              </div>
              <button onClick={() => setInviteOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <form onSubmit={createInvitation} className="space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-gray-600">
                  Nombre completo
                  <input
                    value={invite.full_name}
                    onChange={(event) =>
                      setInvite((value) => ({
                        ...value,
                        full_name: event.target.value,
                      }))
                    }
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold text-gray-600">
                  Correo
                  <input
                    type="email"
                    value={invite.email}
                    onChange={(event) =>
                      setInvite((value) => ({
                        ...value,
                        email: event.target.value,
                      }))
                    }
                    required
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {tab === 'client' ? (
                <label className="block text-xs font-semibold text-gray-600">
                  Empresa
                  <input
                    value={invite.company}
                    onChange={(event) =>
                      setInvite((value) => ({
                        ...value,
                        company: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              ) : (
                <label className="block text-xs font-semibold text-gray-600">
                  Departamento
                  <select
                    value={invite.department}
                    onChange={(event) =>
                      setInvite((value) => ({
                        ...value,
                        department: event.target.value as Department,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sin departamento</option>
                    {DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">Accesos iniciales</p>
                    <p className="text-xs text-gray-400">Elige qué podrá ver esta persona al entrar.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const all = SECTIONS[tab].every((section) => invitePermissions[section.key] !== false)
                      setInvitePermissions(Object.fromEntries(SECTIONS[tab].map((section) => [section.key, !all])))
                    }}
                    className="shrink-0 text-xs font-bold text-blue-600"
                  >
                    {SECTIONS[tab].every((section) => invitePermissions[section.key] !== false) ? 'Quitar todos' : 'Permitir todos'}
                  </button>
                </div>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {SECTIONS[tab].map((section) => {
                    const enabled = invitePermissions[section.key] !== false
                    return (
                      <label key={section.key} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() =>
                            setInvitePermissions((previous) => ({
                              ...previous,
                              [section.key]: !enabled,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-700">{section.label}</span>
                          <span className="block truncate text-xs text-gray-400">{section.description}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </section>
              {inviteStatus && <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">{inviteStatus}</p>}
              {inviteLink && (
                <div className="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <input readOnly value={inviteLink} className="min-w-0 flex-1 bg-transparent text-xs text-gray-500 outline-none" />
                  <button type="button" onClick={copyInvite} className="flex items-center gap-1 text-xs font-bold text-blue-600">
                    <Copy size={13} /> Copiar
                  </button>
                </div>
              )}
              <button disabled={saving === 'invite'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                {saving === 'invite' ? <LoaderCircle className="animate-spin" size={16} /> : <Mail size={16} />} Crear y enviar invitación
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
