import { useState, useEffect } from 'react'
import { X, Plus, ChevronLeft, CheckSquare, Square, GripVertical } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Client, User } from '../../types'
import { PROJECT_TEMPLATES, GROUP_LABELS, GROUP_COLORS, TEMPLATE_GROUP_ORDER } from '../../data/projectTemplates'

interface Props {
  clients: Client[]
  teamMembers: User[]
  onClose: () => void
  onCreated: () => void
}

interface CombinedTask {
  title: string
  department: string
  priority: string
  isCustom: boolean
  group?: string
}

export default function CreateProjectModal({ clients, teamMembers, onClose, onCreated }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newClient, setNewClient] = useState({ name: '', company: '' })
  const [form, setForm] = useState({ name: '', description: '', templateId: '' })
  const [saving, setSaving] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [error, setError] = useState('')

  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([])

  const [combinedTasks, setCombinedTasks] = useState<CombinedTask[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [deptAssignees, setDeptAssignees] = useState<Record<string, string>>({})
  const [deptAssignees2, setDeptAssignees2] = useState<Record<string, string>>({})
  const [taskOverrides, setTaskOverrides] = useState<Record<number, string>>({})
  const [addingTaskToGroup, setAddingTaskToGroup] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [clientUser, setClientUser] = useState<User | null>(null)
  const [clientUsers, setClientUsers] = useState<User[]>([])

  useEffect(() => {
    supabase.from('users').select('*').eq('role', 'client').order('full_name').then(({ data }) => {
      if (data) setClientUsers(data as User[])
    })
  }, [])

  const clientAssignees = clientUsers.map(u => ({ id: u.id, full_name: `${u.full_name} (cliente)` }))

  const allAssignees = [
    ...(clientUser ? [{ id: clientUser.id, full_name: `${clientUser.full_name} (cliente)` }] : clientAssignees),
    ...(user ? [{ id: user.id, full_name: `${user.full_name} (yo)` }] : []),
    ...teamMembers,
  ]

  const clientGroupAssignees = [
    ...clientAssignees,
    ...(user ? [{ id: user.id, full_name: `${user.full_name} (yo)` }] : []),
    ...teamMembers,
  ]

  function validateStep1() {
    if (!form.name.trim()) { setError('El nombre del proyecto es obligatorio'); return false }
    if (mode === 'existing' && !selectedClientId) { setError('Selecciona un cliente'); return false }
    if (mode === 'new' && !newClient.name.trim()) { setError('El nombre del cliente es obligatorio'); return false }
    if (!form.templateId) { setError('Selecciona un tipo de proyecto'); return false }
    setError('')
    return true
  }

  async function handleContinue() {
    if (!validateStep1()) return
    const tpl = PROJECT_TEMPLATES.find(t => t.id === form.templateId)

    if (form.templateId === 'otro') {
      handleCreate([])
      return
    }

    setLoadingTasks(true)
    const { data: customDbTasks } = await supabase
      .from('template_tasks')
      .select('*')
      .eq('template_id', form.templateId)
      .order('created_at')

    const baseTasks: CombinedTask[] = (tpl?.tasks || []).map(t => ({ ...t, isCustom: false, group: t.group }))
    const customTasks: CombinedTask[] = (customDbTasks || []).map(t => ({
      title: t.title,
      department: t.department,
      priority: t.priority,
      isCustom: true,
    }))
    const all = [...baseTasks, ...customTasks]

    setCombinedTasks(all)
    setSelectedTasks(new Set(all.map((_, i) => i)))

    const defaults: Record<string, string> = {}
    if (user) { defaults['lider'] = user.id }

    // Buscar el usuario vinculado al cliente seleccionado
    const selectedClient = clients.find(c => c.id === selectedClientId)
    if (selectedClient?.user_id) {
      const { data: cUser } = await supabase.from('users').select('*').eq('id', selectedClient.user_id).single()
      if (cUser) {
        setClientUser(cUser as User)
        defaults['cliente'] = cUser.id
      }
    } else {
      setClientUser(null)
    }

    setDeptAssignees(defaults)
    setLoadingTasks(false)
    setStep(2)
  }

  function toggleTask(idx: number) {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  function toggleDept(groupKey: string) {
    const idxs = combinedTasks
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => (t.group || t.department) === groupKey)
      .map(({ i }) => i)
    const allSel = idxs.every(i => selectedTasks.has(i))
    setSelectedTasks(prev => {
      const next = new Set(prev)
      idxs.forEach(i => allSel ? next.delete(i) : next.add(i))
      return next
    })
  }

  function handleDrop(targetIdx: number) {
    if (draggedIdx === null || draggedIdx === targetIdx) { setDraggedIdx(null); setDragOverIdx(null); return }
    const draggedGroup = combinedTasks[draggedIdx].group || combinedTasks[draggedIdx].department
    const targetGroup = combinedTasks[targetIdx].group || combinedTasks[targetIdx].department
    if (draggedGroup !== targetGroup) { setDraggedIdx(null); setDragOverIdx(null); return }

    const newTasks = [...combinedTasks]
    const [moved] = newTasks.splice(draggedIdx, 1)
    newTasks.splice(draggedIdx < targetIdx ? targetIdx - 1 : targetIdx, 0, moved)

    const oldToNew: Record<number, number> = {}
    newTasks.forEach((task, newIdx) => { const o = combinedTasks.indexOf(task); if (o !== -1) oldToNew[o] = newIdx })

    const newSelected = new Set<number>()
    selectedTasks.forEach(i => { if (oldToNew[i] !== undefined) newSelected.add(oldToNew[i]) })

    const newOverrides: Record<number, string> = {}
    Object.entries(taskOverrides).forEach(([k, v]) => { const n = oldToNew[parseInt(k)]; if (n !== undefined) newOverrides[n] = v })

    setCombinedTasks(newTasks)
    setSelectedTasks(newSelected)
    setTaskOverrides(newOverrides)
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  function groupToDepartment(groupKey: string): string {
    if (groupKey === 'diseno_web' || groupKey === 'diseno_ads') return 'diseno'
    if (groupKey === 'edicion_video' || groupKey === 'edicion_presentacion') return 'edicion'
    return groupKey
  }

  function addTaskToGroup(groupKey: string) {
    if (!newTaskTitle.trim()) return
    const newTask: CombinedTask = {
      title: newTaskTitle.trim(),
      department: groupToDepartment(groupKey),
      priority: 'media',
      isCustom: true,
      group: groupKey,
    }
    const newIdx = combinedTasks.length
    setCombinedTasks(prev => [...prev, newTask])
    setSelectedTasks(prev => new Set([...prev, newIdx]))
    if (deptAssignees[groupKey]) {
      setTaskOverrides(prev => ({ ...prev, [newIdx]: deptAssignees[groupKey] }))
    }
    setNewTaskTitle('')
    setAddingTaskToGroup(null)
  }

  async function handleCreate(tasks?: CombinedTask[]) {
    if (!validateStep1()) return
    setSaving(true)

    let clientId = selectedClientId
    if (mode === 'new') {
      const { data, error: clientErr } = await supabase.from('clients').insert({
        name: newClient.name.trim(),
        company: newClient.company.trim() || newClient.name.trim(),
      }).select().single()
      if (clientErr || !data) { setError('Error al crear el cliente'); setSaving(false); return }
      clientId = data.id

      // Guardar asignaciones de equipo
      if (selectedTeamMembers.length > 0) {
        await supabase.from('client_team_members').insert(
          selectedTeamMembers.map(userId => ({ client_id: clientId, user_id: userId }))
        )
      }
    }

    const { data: project, error: projErr } = await supabase.from('projects').insert({
      client_id: clientId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      status: 'activo',
    }).select().single()
    if (projErr || !project) { setError('Error al crear el proyecto'); setSaving(false); return }

    const tasksToUse = tasks !== undefined ? tasks : combinedTasks
    const selectedList = [...selectedTasks].sort((a, b) => a - b)
    if (selectedList.length > 0) {
      const tasksToInsert = selectedList.map(idx => {
        const t = tasksToUse[idx]
        return {
          project_id: project.id,
          title: t.title,
          department: t.department,
          assigned_to: taskOverrides[idx] || deptAssignees[t.group || t.department] || user!.id,
          priority: t.priority,
          status: 'pendiente',
          created_by: user!.id,
        }
      })
      await supabase.from('tasks').insert(tasksToInsert)

      // Agregar asignados a client_team_members para que puedan ver el chat
      const uniqueAssignees = [...new Set(tasksToInsert.map((t: any) => t.assigned_to).filter(Boolean))]
      if (uniqueAssignees.length > 0) {
        const { data: existing } = await supabase
          .from('client_team_members')
          .select('user_id')
          .eq('client_id', clientId)
        const existingIds = new Set((existing || []).map((m: any) => m.user_id))
        const toAdd = uniqueAssignees.filter(id => !existingIds.has(id))
        if (toAdd.length > 0) {
          await supabase.from('client_team_members').insert(
            toAdd.map(userId => ({ client_id: clientId, user_id: userId }))
          )
        }
      }

      // Notificar a cada asignado único (excluyendo al creador)
      const assigneesToNotify = uniqueAssignees.filter(id => id !== user!.id)
      const clientName = mode === 'existing'
        ? clients.find((c: any) => c.id === clientId)?.name || 'un cliente'
        : newClient.name || 'un cliente'
      if (assigneesToNotify.length > 0) {
        await supabase.from('notifications').insert(
          assigneesToNotify.map(userId => ({
            user_id: userId,
            title: '📋 Tienes nuevas tareas',
            message: `Se creó el proyecto "${form.name}" para ${clientName}. Revisa tus tareas asignadas.`,
            type: 'task',
          }))
        )
      }
    }

    onCreated()
    onClose()
  }

  // Group combined tasks by sub-grupo (group ?? department)
  const tasksByGroup: Record<string, Array<{ title: string; idx: number; isCustom: boolean }>> = {}
  combinedTasks.forEach((t, i) => {
    const key = t.group || t.department
    if (!tasksByGroup[key]) tasksByGroup[key] = []
    tasksByGroup[key].push({ title: t.title, idx: i, isCustom: t.isCustom })
  })

  const selectedCount = selectedTasks.size
  const selectedTpl = PROJECT_TEMPLATES.find(t => t.id === form.templateId)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col ${step === 2 ? 'max-w-3xl max-h-[92vh]' : 'max-w-lg'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-600 transition">
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {step === 1 ? 'Nuevo proyecto' : `Selecciona las tareas — ${selectedTpl?.icon} ${selectedTpl?.name}`}
              </h3>
              {step === 2 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedCount} tareas seleccionadas · desmarca las que no apliquen
                  {combinedTasks.some(t => t.isCustom) && (
                    <span className="ml-2 text-blue-500">· 🔖 = tarea fija personalizada</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Cliente */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Cliente *</label>
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setMode('existing')}
                  className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition ${mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Cliente existente
                </button>
                <button type="button" onClick={() => setMode('new')}
                  className={`flex-1 py-1.5 text-sm rounded-lg font-medium transition flex items-center justify-center gap-1 ${mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Plus size={14} /> Nuevo cliente
                </button>
              </div>
              {mode === 'existing' ? (
                <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecciona un cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company && c.company !== c.name ? ` — ${c.company}` : ''}</option>)}
                </select>
              ) : (
                <div className="space-y-3">
                  <input value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                    placeholder="Nombre del cliente *"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={newClient.company} onChange={e => setNewClient({ ...newClient, company: e.target.value })}
                    placeholder="Empresa (opcional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

                  {/* Equipo asignado a este cliente */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                      Equipo asignado a este cliente
                    </label>
                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                      {teamMembers.map(member => {
                        const isSelected = selectedTeamMembers.includes(member.id)
                        return (
                          <label key={member.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-gray-50 last:border-0 transition ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => setSelectedTeamMembers(prev =>
                                isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                              )}
                              className="w-4 h-4 accent-blue-600"
                            />
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {member.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{member.full_name}</p>
                              {member.department && (
                                <p className="text-xs text-gray-400 capitalize">{member.department}</p>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                    {selectedTeamMembers.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1.5 font-medium">
                        {selectedTeamMembers.length} persona{selectedTeamMembers.length > 1 ? 's' : ''} seleccionada{selectedTeamMembers.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Nombre del proyecto */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nombre del proyecto *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Lanzamiento Webinar Q2, Campaña Meta..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Descripción</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2} placeholder="Breve descripción del proyecto..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* Tipo de embudo */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Tipo de embudo *</label>
              <div className="grid grid-cols-3 gap-3">
                {PROJECT_TEMPLATES.map(tpl => (
                  <button key={tpl.id} type="button"
                    onClick={() => setForm({ ...form, templateId: tpl.id })}
                    className={`border-2 rounded-xl p-4 text-left transition cursor-pointer ${
                      form.templateId === tpl.id
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}>
                    <p className="text-2xl mb-1">{tpl.icon}</p>
                    <p className="font-semibold text-sm text-gray-800">{tpl.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{tpl.description}</p>
                    {tpl.tasks.length > 0 && (
                      <p className="text-xs font-semibold text-blue-500 mt-2">{tpl.tasks.length}+ tareas</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button type="button" onClick={handleContinue} disabled={loadingTasks}
                className="px-6 py-2 bg-gradient-to-r from-blue-700 to-red-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
                {loadingTasks ? 'Cargando tareas...' : form.templateId === 'otro' ? 'Crear proyecto' : 'Siguiente → Seleccionar tareas'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Task selection ── */}
        {step === 2 && (
          <>
            <div className="overflow-y-auto flex-1">
              {TEMPLATE_GROUP_ORDER.filter(g => tasksByGroup[g]).map(groupKey => {
                const groupTasks = tasksByGroup[groupKey]
                const allSel = groupTasks.every(t => selectedTasks.has(t.idx))
                const colorClass = GROUP_COLORS[groupKey] || 'bg-gray-100 text-gray-700 border-gray-200'

                return (
                  <div key={groupKey}>
                    <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-y border-gray-100 sticky top-0 z-10">
                      <button onClick={() => toggleDept(groupKey)} className="shrink-0">
                        {allSel
                          ? <CheckSquare size={18} className="text-blue-600" />
                          : <Square size={18} className="text-gray-400" />}
                      </button>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
                        {GROUP_LABELS[groupKey]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {groupTasks.filter(t => selectedTasks.has(t.idx)).length}/{groupTasks.length}
                      </span>
                      <div className="ml-auto flex items-center gap-2">
                        {/* Persona principal */}
                        <select value={deptAssignees[groupKey] || ''}
                          onChange={e => {
                            setDeptAssignees(prev => ({ ...prev, [groupKey]: e.target.value }))
                            // Si se borra la persona 1, limpiar persona 2 y overrides del grupo
                            if (!e.target.value) {
                              setDeptAssignees2(prev => { const n = {...prev}; delete n[groupKey]; return n })
                              const groupIdxs = new Set(groupTasks.map(t => t.idx))
                              setTaskOverrides(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !groupIdxs.has(Number(k)))))
                            }
                          }}
                          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="">Asignar persona...</option>
                          {(groupKey === 'cliente' ? clientGroupAssignees : allAssignees).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                        </select>

                        {/* Persona 2: aparece solo si hay persona 1 */}
                        {deptAssignees[groupKey] && (
                          deptAssignees2[groupKey] ? (
                            <select value={deptAssignees2[groupKey]}
                              onChange={e => {
                                if (!e.target.value) {
                                  setDeptAssignees2(prev => { const n = {...prev}; delete n[groupKey]; return n })
                                  const groupIdxs = new Set(groupTasks.map(t => t.idx))
                                  setTaskOverrides(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => !groupIdxs.has(Number(k)))))
                                } else {
                                  setDeptAssignees2(prev => ({ ...prev, [groupKey]: e.target.value }))
                                }
                              }}
                              className="text-sm border border-purple-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-purple-50 text-purple-700">
                              <option value="">— quitar</option>
                              {allAssignees.filter(m => m.id !== deptAssignees[groupKey]).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                            </select>
                          ) : (
                            <button
                              onClick={() => setDeptAssignees2(prev => ({ ...prev, [groupKey]: '' }))}
                              title="Agregar segunda persona a este grupo"
                              className="flex items-center gap-1 text-xs text-purple-600 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2 py-1.5 rounded-lg transition shrink-0 font-medium">
                              <Plus size={12} /> persona
                            </button>
                          )
                        )}

                        <button
                          onClick={() => {
                            setAddingTaskToGroup(addingTaskToGroup === groupKey ? null : groupKey)
                            setNewTaskTitle('')
                          }}
                          title="Agregar tarea a esta área"
                          className="w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition shrink-0">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {addingTaskToGroup === groupKey && (
                      <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 border-b border-blue-100">
                        <input
                          autoFocus
                          value={newTaskTitle}
                          onChange={e => setNewTaskTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') addTaskToGroup(groupKey)
                            if (e.key === 'Escape') { setAddingTaskToGroup(null); setNewTaskTitle('') }
                          }}
                          placeholder="Título de la nueva tarea..."
                          className="flex-1 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button onClick={() => addTaskToGroup(groupKey)} disabled={!newTaskTitle.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                          Agregar
                        </button>
                        <button onClick={() => { setAddingTaskToGroup(null); setNewTaskTitle('') }}
                          className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-300 transition">
                          Cancelar
                        </button>
                      </div>
                    )}

                    <div className="divide-y divide-gray-50">
                      {groupTasks.map(task => (
                        <div key={task.idx}
                          draggable
                          onDragStart={() => setDraggedIdx(task.idx)}
                          onDragOver={e => { e.preventDefault(); setDragOverIdx(task.idx) }}
                          onDrop={() => handleDrop(task.idx)}
                          onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null) }}
                          className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition
                            ${!selectedTasks.has(task.idx) ? 'opacity-40' : ''}
                            ${draggedIdx === task.idx ? 'opacity-25' : ''}
                            ${dragOverIdx === task.idx && draggedIdx !== task.idx ? 'border-t-2 border-blue-400' : ''}
                          `}>
                          <GripVertical size={14}
                            className="text-gray-300 opacity-0 group-hover:opacity-100 transition shrink-0 cursor-grab active:cursor-grabbing" />
                          <input type="checkbox" checked={selectedTasks.has(task.idx)}
                            onChange={() => toggleTask(task.idx)}
                            className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer" />
                          <span className="text-sm text-gray-700 flex-1 leading-tight">{task.title}</span>
                          {task.isCustom && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">🔖</span>
                          )}
                          {/* Toggle persona 1 / persona 2 cuando hay dos asignados en el grupo */}
                          {selectedTasks.has(task.idx) && deptAssignees[groupKey] && deptAssignees2[groupKey] && (() => {
                            const p1 = allAssignees.find(m => m.id === deptAssignees[groupKey])
                            const p2 = allAssignees.find(m => m.id === deptAssignees2[groupKey])
                            const current = taskOverrides[task.idx] || deptAssignees[groupKey]
                            const isP2 = current === deptAssignees2[groupKey]
                            return (
                              <div className="flex items-center gap-0.5 shrink-0 border border-gray-200 rounded-lg overflow-hidden">
                                <button type="button"
                                  onClick={() => setTaskOverrides(prev => { const n = {...prev}; delete n[task.idx]; return n })}
                                  className={`px-2 py-1 text-xs font-medium transition ${!isP2 ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                                  {p1?.full_name.split(' ')[0]}
                                </button>
                                <button type="button"
                                  onClick={() => setTaskOverrides(prev => ({ ...prev, [task.idx]: deptAssignees2[groupKey] }))}
                                  className={`px-2 py-1 text-xs font-medium transition ${isP2 ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                                  {p2?.full_name.split(' ')[0]}
                                </button>
                              </div>
                            )
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-gray-100 p-4 bg-white shrink-0 flex items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                <span className="font-semibold text-gray-800">{selectedCount}</span> tareas se crearán
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">← Volver</button>
                <button onClick={() => handleCreate()} disabled={saving || selectedCount === 0}
                  className="px-6 py-2 bg-gradient-to-r from-blue-700 to-red-600 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60">
                  {saving ? 'Creando...' : `Crear proyecto con ${selectedCount} tareas`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
