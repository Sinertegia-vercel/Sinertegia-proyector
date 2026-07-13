import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface PermissionRow {
  id: string
  role: 'team' | 'client'
  section_key: string
  allowed: boolean
}

const TEAM_SECTIONS = [
  { key: 'tasks', label: 'Mis tareas' },
  { key: 'calendar', label: 'Mi Calendario' },
  { key: 'roadmap', label: 'Hoja de Ruta' },
  { key: 'chat_team', label: 'Chat del Equipo' },
  { key: 'chat_clients', label: 'Chat con Clientes' },
  { key: 'entregables', label: 'Entregables' },
]

const CLIENT_SECTIONS = [
  { key: 'mistareas', label: 'Mis tareas' },
  { key: 'progreso', label: 'Todas las tareas' },
  { key: 'area', label: 'Por área' },
  { key: 'calendario', label: 'Calendario' },
  { key: 'roadmap', label: 'Hoja de Ruta' },
  { key: 'chat', label: 'Chat con el equipo' },
  { key: 'entregables', label: 'Entregables' },
]

export default function RolePermissionsManager() {
  const [rows, setRows] = useState<PermissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    fetchPermissions()
  }, [])

  async function fetchPermissions() {
    const { data } = await supabase.from('role_permissions').select('*')
    setRows((data as PermissionRow[]) || [])
    setLoading(false)
  }

  function isAllowed(role: 'team' | 'client', key: string): boolean {
    const row = rows.find(r => r.role === role && r.section_key === key)
    return row ? row.allowed : true
  }

  async function toggle(role: 'team' | 'client', key: string) {
    const current = isAllowed(role, key)
    const rowKey = `${role}:${key}`
    setSavingKey(rowKey)
    setRows(prev => {
      const exists = prev.some(r => r.role === role && r.section_key === key)
      if (exists) return prev.map(r => r.role === role && r.section_key === key ? { ...r, allowed: !current } : r)
      return [...prev, { id: rowKey, role, section_key: key, allowed: !current }]
    })
    await supabase.from('role_permissions')
      .upsert({ role, section_key: key, allowed: !current }, { onConflict: 'role,section_key' })
    setSavingKey(null)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando permisos...</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-gray-500">
        Marca qué secciones puede ver cada rol. Los cambios aplican de inmediato — la próxima vez que esa persona entre (o recargue), verá el menú actualizado.
        Los administradores siempre ven todo, esto no los afecta.
      </p>

      {[
        { role: 'team' as const, title: 'Equipo', sections: TEAM_SECTIONS, headerClass: 'bg-blue-50', textClass: 'text-blue-700' },
        { role: 'client' as const, title: 'Clientes', sections: CLIENT_SECTIONS, headerClass: 'bg-purple-50', textClass: 'text-purple-700' },
      ].map(({ role, title, sections, headerClass, textClass }) => (
        <div key={role} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className={`px-5 py-3 border-b border-gray-100 ${headerClass}`}>
            <p className={`font-bold text-sm ${textClass}`}>{title}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {sections.map(s => {
              const allowed = isAllowed(role, s.key)
              const rowKey = `${role}:${s.key}`
              return (
                <button key={s.key} type="button" onClick={() => toggle(role, s.key)} disabled={savingKey === rowKey}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition text-left">
                  <span className="text-sm text-gray-700">{s.label}</span>
                  <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    allowed ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {allowed && <Check size={13} className="text-white" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
