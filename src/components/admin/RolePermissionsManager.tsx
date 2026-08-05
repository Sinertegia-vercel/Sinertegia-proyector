import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  KeyRound,
  Link2,
  LoaderCircle,
  Map,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface PermissionRow {
  id: string
  role: 'team' | 'client'
  section_key: string
  allowed: boolean
}

const TEAM_SECTIONS = [
  { key: 'tasks', label: 'Mis tareas', description: 'Consultar y trabajar en las tareas asignadas.', icon: ClipboardList },
  { key: 'calendar', label: 'Mi calendario', description: 'Ver compromisos y fechas de entrega.', icon: CalendarDays },
  { key: 'roadmap', label: 'Hoja de ruta', description: 'Consultar la planeación de tareas en el tiempo.', icon: Map },
  { key: 'chat_team', label: 'Chat del equipo', description: 'Participar en conversaciones internas.', icon: MessagesSquare },
  { key: 'chat_clients', label: 'Chat con clientes', description: 'Conversar con los clientes asignados.', icon: MessageCircle },
  { key: 'entregables', label: 'Entregables', description: 'Subir, consultar y dar seguimiento a entregables.', icon: Link2 },
]

const CLIENT_SECTIONS = [
  { key: 'mistareas', label: 'Mis tareas', description: 'Consultar las tareas que requieren su participación.', icon: ClipboardList },
  { key: 'progreso', label: 'Todas las tareas', description: 'Ver el avance completo de sus proyectos.', icon: FolderKanban },
  { key: 'area', label: 'Por área', description: 'Consultar el trabajo organizado por departamento.', icon: Users },
  { key: 'calendario', label: 'Calendario', description: 'Ver fechas y próximos compromisos.', icon: CalendarDays },
  { key: 'roadmap', label: 'Hoja de ruta', description: 'Consultar la planeación general del proyecto.', icon: Map },
  { key: 'chat', label: 'Chat con el equipo', description: 'Comunicarse con el equipo responsable.', icon: MessageCircle },
  { key: 'entregables', label: 'Entregables', description: 'Revisar archivos, enlaces y versiones finales.', icon: Link2 },
]

type Role = 'team' | 'client'

export default function RolePermissionsManager() {
  const [rows, setRows] = useState<PermissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPermissions()
  }, [])

  async function fetchPermissions() {
    const { data, error: fetchError } = await supabase.from('role_permissions').select('*')
    if (fetchError) setError('No fue posible cargar los permisos. Intenta recargar la página.')
    setRows((data as PermissionRow[]) || [])
    setLoading(false)
  }

  function isAllowed(role: Role, key: string): boolean {
    const row = rows.find(item => item.role === role && item.section_key === key)
    return row ? row.allowed : true
  }

  function updateLocal(role: Role, key: string, allowed: boolean) {
    setRows(previous => {
      const exists = previous.some(item => item.role === role && item.section_key === key)
      if (exists) return previous.map(item => item.role === role && item.section_key === key ? { ...item, allowed } : item)
      return [...previous, { id: `${role}:${key}`, role, section_key: key, allowed }]
    })
  }

  function showSaved(key: string) {
    setSavedKey(key)
    window.setTimeout(() => setSavedKey(current => current === key ? null : current), 1600)
  }

  async function toggle(role: Role, key: string) {
    const nextAllowed = !isAllowed(role, key)
    const rowKey = `${role}:${key}`
    setError('')
    setSavingKey(rowKey)
    updateLocal(role, key, nextAllowed)

    const { error: saveError } = await supabase.from('role_permissions')
      .upsert({ role, section_key: key, allowed: nextAllowed }, { onConflict: 'role,section_key' })

    if (saveError) {
      updateLocal(role, key, !nextAllowed)
      setError('No se pudo guardar el permiso. Intenta nuevamente.')
    } else {
      showSaved(rowKey)
    }
    setSavingKey(null)
  }

  async function toggleAll(role: Role, keys: string[]) {
    const allAllowed = keys.every(key => isAllowed(role, key))
    const nextAllowed = !allAllowed
    const rowKey = `${role}:all`
    setError('')
    setSavingKey(rowKey)
    keys.forEach(key => updateLocal(role, key, nextAllowed))

    const payload = keys.map(section_key => ({ role, section_key, allowed: nextAllowed }))
    const { error: saveError } = await supabase.from('role_permissions')
      .upsert(payload, { onConflict: 'role,section_key' })

    if (saveError) {
      await fetchPermissions()
      setError('No se pudieron actualizar todos los permisos. Intenta nuevamente.')
    } else {
      showSaved(rowKey)
    }
    setSavingKey(null)
  }

  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400"><LoaderCircle size={18} className="animate-spin" /> Cargando permisos...</div>

  const roles = [
    { role: 'team' as const, title: 'Equipo', subtitle: 'Accesos para colaboradores internos', sections: TEAM_SECTIONS, icon: Users, accent: 'blue' },
    { role: 'client' as const, title: 'Clientes', subtitle: 'Accesos disponibles en el portal del cliente', sections: CLIENT_SECTIONS, icon: ShieldCheck, accent: 'purple' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600"><KeyRound size={14} /> Control de acceso</div>
          <h1 className="text-2xl font-bold text-gray-900">Permisos por rol</h1>
          <p className="mt-1 text-sm text-gray-500">Decide qué secciones puede ver cada tipo de usuario dentro de la aplicación.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700">
          <CheckCircle2 size={15} /> Los cambios se guardan automáticamente
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {roles.map(({ role, title, subtitle, sections, icon: RoleIcon, accent }) => {
          const enabledCount = sections.filter(section => isAllowed(role, section.key)).length
          const allAllowed = enabledCount === sections.length
          const bulkKey = `${role}:all`
          const isBulkSaving = savingKey === bulkKey
          const blue = accent === 'blue'

          return (
            <section key={role} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className={`border-b px-5 py-5 ${blue ? 'border-blue-100 bg-blue-50/70' : 'border-purple-100 bg-purple-50/70'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${blue ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}><RoleIcon size={21} /></div>
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900">{title}</h2>
                      <p className="truncate text-xs text-gray-500">{subtitle}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <strong className={`text-lg ${blue ? 'text-blue-700' : 'text-purple-700'}`}>{enabledCount}/{sections.length}</strong>
                    <p className="text-[11px] text-gray-400">activos</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-white/80 bg-white/80 px-3 py-2.5">
                  <div><p className="text-sm font-semibold text-gray-700">Permitir todas las secciones</p><p className="text-[11px] text-gray-400">Control general para este rol</p></div>
                  <button type="button" onClick={() => toggleAll(role, sections.map(section => section.key))} disabled={savingKey !== null}
                    className={`relative h-6 w-11 rounded-full transition ${allAllowed ? (blue ? 'bg-blue-600' : 'bg-purple-600') : 'bg-gray-300'} disabled:opacity-60`} aria-pressed={allAllowed}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${allAllowed ? 'left-6' : 'left-1'}`} />
                    {isBulkSaving && <LoaderCircle size={12} className="absolute left-[14px] top-[6px] animate-spin text-white" />}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {sections.map(section => {
                  const allowed = isAllowed(role, section.key)
                  const rowKey = `${role}:${section.key}`
                  const Icon = section.icon
                  const saving = savingKey === rowKey
                  const saved = savedKey === rowKey

                  return (
                    <div key={section.key} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50/80">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${allowed ? (blue ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600') : 'bg-gray-100 text-gray-400'}`}><Icon size={17} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><p className="text-sm font-semibold text-gray-800">{section.label}</p>{saved && <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600"><Check size={11} /> Guardado</span>}</div>
                        <p className="truncate text-xs text-gray-400">{section.description}</p>
                      </div>
                      <button type="button" onClick={() => toggle(role, section.key)} disabled={savingKey !== null}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${allowed ? (blue ? 'bg-blue-600' : 'bg-purple-600') : 'bg-gray-300'} disabled:opacity-60`} aria-label={`${allowed ? 'Ocultar' : 'Mostrar'} ${section.label}`} aria-pressed={allowed}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${allowed ? 'left-6' : 'left-1'}`} />
                        {saving && <LoaderCircle size={12} className="absolute left-[14px] top-[6px] animate-spin text-white" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <p><strong>Los administradores siempre conservan acceso completo.</strong> Los usuarios afectados verán el menú actualizado al recargar o volver a entrar.</p>
      </div>
    </div>
  )
}
