import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Project, User, Priority, Department } from '../../types'

interface Props {
  projects: Project[]
  teamMembers: User[]
  defaultProjectId?: string
  prefillTitle?: string
  onClose: () => void
  onCreated: () => void
}

const DEPARTMENTS: { value: Department; label: string }[] = [
  { value: 'edicion', label: 'Edición' },
  { value: 'grabacion', label: 'Grabación' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'copy', label: 'Copy' },
  { value: 'webmaster', label: 'Webmaster' },
  { value: 'trafficker', label: 'Trafficker' },
  { value: 'lider', label: 'Líder de Proyecto' },
  { value: 'cliente', label: 'Tarea del Cliente' },
]

export default function CreateTaskModal({ projects, teamMembers, defaultProjectId, prefillTitle, onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    project_id: defaultProjectId || '',
    title: prefillTitle || '',
    description: '',
    assigned_to: '',
    department: '' as Department,
    priority: 'media' as Priority,
    start_date: '',
    needed_date: '',
    commitment_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveToTemplate, setSaveToTemplate] = useState(false)
  const [templateType, setTemplateType] = useState<'vsl' | 'webinar'>('vsl')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id || !form.title || !form.assigned_to || !form.department) {
      setError('Por favor completa todos los campos requeridos')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('tasks').insert({
      project_id: form.project_id,
      title: form.title,
      description: form.description || null,
      assigned_to: form.assigned_to,
      department: form.department,
      priority: form.priority,
      status: 'pendiente',
      start_date: form.start_date || null,
      needed_date: form.needed_date || null,
      commitment_date: form.commitment_date || null,
      created_by: user!.id,
    })
    if (err) { setError('Error al crear la tarea'); setSaving(false); return }

    // Guardar en plantilla si se marcó
    if (saveToTemplate && form.title && form.department) {
      await supabase.from('template_tasks').insert({
        title: form.title,
        department: form.department,
        priority: form.priority,
        template_id: templateType,
      })
    }

    // Notificaciones al asignado y al cliente
    const project = projects.find(p => p.id === form.project_id)
    const notifs: any[] = []

    if (form.assigned_to) {
      notifs.push({
        user_id: form.assigned_to,
        title: '📋 Nueva tarea asignada',
        message: `"${form.title}" — ${project?.client?.name || project?.name || 'Proyecto'}`,
        type: 'task',
      })
    }

    if (project?.client?.user_id) {
      notifs.push({
        user_id: project.client.user_id,
        title: '📋 Nueva tarea en tu proyecto',
        message: `"${form.title}" — ${project?.name || 'Tu proyecto'}`,
        type: 'task',
      })
    }

    if (notifs.length > 0) {
      await supabase.from('notifications').insert(notifs)
    }

    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Nueva tarea</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleCreate} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Proyecto / Cliente *</label>
            <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Selecciona un proyecto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.client?.name} — {p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Título de la tarea *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Editar 3 videos para campaña"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Descripción</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Detalle de la tarea..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Asignar a *</label>
              <select value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona persona</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Departamento *</label>
              <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value as Department })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecciona</option>
                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Prioridad</label>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="critica">🔴 Crítica</option>
              <option value="alta">🟠 Alta</option>
              <option value="media">🟡 Media</option>
              <option value="baja">🟢 Baja</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Fecha de inicio</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-orange-600 mb-1 uppercase tracking-wide">📅 La necesito para (Líder)</label>
              <input type="date" value={form.needed_date} onChange={e => setForm({ ...form, needed_date: e.target.value })}
                className="w-full border-2 border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-orange-50" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-green-700 mb-1 uppercase tracking-wide">📆 Mi compromiso de entrega</label>
            <input type="date" value={form.commitment_date} onChange={e => setForm({ ...form, commitment_date: e.target.value })}
              className="w-full border-2 border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-green-50" />
            <p className="text-xs text-green-600 mt-1">¿Para qué fecha te comprometes a entregar esta tarea?</p>
          </div>

          {/* Fijar en plantilla */}
          <div className={`border-2 rounded-xl p-4 transition ${saveToTemplate ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={saveToTemplate} onChange={e => setSaveToTemplate(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <div>
                <p className="text-sm font-semibold text-gray-700">🔖 Fijar en plantilla para futuros proyectos</p>
                <p className="text-xs text-gray-400">Esta tarea aparecerá automáticamente la próxima vez que crees un proyecto de ese tipo</p>
              </div>
            </label>
            {saveToTemplate && (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setTemplateType('vsl')}
                  className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition ${templateType === 'vsl' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  🎬 VSL
                </button>
                <button type="button" onClick={() => setTemplateType('webinar')}
                  className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition ${templateType === 'webinar' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                  📡 Webinar
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 bg-gradient-to-r from-blue-700 to-red-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
              {saving ? 'Creando...' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
