import { useState, useEffect } from 'react'
import { X, ExternalLink, Send, CheckCircle, RotateCcw, ShieldCheck, ThumbsUp, Plus, Trash2, MessageSquare, Pencil, Upload, FileCode } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Task, User, Comment } from '../../types'

interface Props {
  task: Task
  onClose: () => void
  onUpdate: () => void
  onReviewDone?: (taskId: string) => void
}

export default function TaskDetailModal({ task, onClose, onUpdate, onReviewDone }: Props) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isTeam = user?.role === 'team'
  const isReviewer = user?.id === task.reviewer_id
  const canAuthorize = isAdmin || user?.department === 'trafficker' || user?.department === 'lider'

  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [links, setLinks] = useState<{ id: string; label: string; url: string }[]>(task.links || [])
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [reviewerId, setReviewerId] = useState(task.reviewer_id || '')
  const [reworkNote, setReworkNote] = useState('')
  const [showRework, setShowRework] = useState(false)
  const [busy, setBusy] = useState(false)
  const [currentStatus, setCurrentStatus] = useState(task.status)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [commitDate, setCommitDate] = useState(task.commitment_date || '')
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentValue, setEditCommentValue] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    supabase.from('users').select('*')
      .in('role', ['admin', 'team'])
      .order('full_name')
      .then(({ data }) => setTeamMembers(data || []))
  }, [])

  useEffect(() => {
    fetchComments()
  }, [task.id])

  async function fetchComments() {
    const { data } = await supabase
      .from('task_comments')
      .select('*, user:users(id, full_name)')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
    setComments((data as Comment[]) || [])
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !user) return
    setSendingComment(true)
    await supabase.from('task_comments').insert({
      task_id: task.id, user_id: user.id, content: newComment.trim(),
    })

    // Avisar al encargado que creó/asignó la tarea (si no es quien comenta)
    if (task.created_by && task.created_by !== user.id) {
      await supabase.from('notifications').insert({
        user_id: task.created_by,
        title: '💬 Nuevo comentario',
        message: `${user.full_name} comentó en "${task.title}": ${newComment.trim().slice(0, 80)}`,
        type: 'comment',
        task_id: task.id,
      })
    }

    setNewComment('')
    await fetchComments()
    setSendingComment(false)
    onUpdate()
  }

  function startEditComment(c: Comment) {
    setEditingCommentId(c.id)
    setEditCommentValue(c.content)
  }

  async function saveEditComment(id: string) {
    if (!editCommentValue.trim()) return
    try {
      const { error } = await supabase.from('task_comments').update({ content: editCommentValue.trim() }).eq('id', id)
      if (error) console.error('Error al editar comentario:', error)
      setEditingCommentId(null)
      await fetchComments()
    } catch (err) {
      console.error('Error al editar comentario:', err)
      setEditingCommentId(null)
    }
  }

  async function deleteComment(id: string) {
    try {
      const { error } = await supabase.from('task_comments').delete().eq('id', id)
      if (error) console.error('Error al borrar comentario:', error)
      await fetchComments()
      onUpdate()
    } catch (err) {
      console.error('Error al borrar comentario:', err)
    }
  }

  // ─── determinar paso actual ───────────────────────────────────────────────
  const step = !task.review_status ? 1
    : task.review_status === 'pendiente_revision' ? 2
    : task.review_status === 'pendiente_trafficker' ? 3
    : task.review_status === 'aprobada' ? 4
    : task.review_status === 'cambios_solicitados' ? 0   // retrabajo
    : 1

  // ─── helpers ─────────────────────────────────────────────────────────────
  async function addLink(e: React.FormEvent) {
    e.preventDefault()
    if (!newLabel.trim() || !newUrl.trim()) return
    const { data } = await supabase.from('task_links')
      .insert({ task_id: task.id, label: newLabel.trim(), url: newUrl.trim() })
      .select().single()
    if (data) setLinks(prev => [...prev, data])
    setNewLabel(''); setNewUrl('')
  }

  async function removeLink(id: string) {
    await supabase.from('task_links').delete().eq('id', id)
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  async function uploadHtmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (!file.name.toLowerCase().endsWith('.html')) {
      setUploadError('Solo se aceptan archivos .html')
      return
    }
    setUploadError('')
    setUploadingFile(true)
    const path = `task-deliverables/${task.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('chat-files').upload(path, file, { contentType: 'text/html' })
    if (error) {
      setUploadError('No se pudo subir el archivo')
      setUploadingFile(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
    const { data } = await supabase.from('task_links')
      .insert({ task_id: task.id, label: file.name, url: publicUrl })
      .select().single()
    if (data) setLinks(prev => [...prev, data])
    setUploadingFile(false)
  }

  async function updateReviewStatus(newStatus: string) {
    await supabase.rpc('update_task_review_status', {
      p_task_id: task.id,
      p_review_status: newStatus,
    })
  }

  // ─── PASO 1 → solicitar revisión ─────────────────────────────────────────
  async function submitForReview() {
    setBusy(true)
    await supabase.from('tasks').update({
      status: 'completada',
      ...(reviewerId ? { reviewer_id: reviewerId } : {}),
    }).eq('id', task.id)
    await updateReviewStatus('pendiente_revision')

    const notifyIds: string[] = reviewerId ? [reviewerId] : []
    if (!reviewerId) {
      const [{ data: admins }, { data: traf }] = await Promise.all([
        supabase.from('users').select('id').eq('role', 'admin'),
        supabase.from('users').select('id').eq('department', 'trafficker'),
      ])
      ;[...(admins || []), ...(traf || [])].forEach((u: any) => {
        if (u.id !== user?.id) notifyIds.push(u.id)
      })
    }
    if (notifyIds.length > 0) {
      await supabase.from('notifications').insert(notifyIds.map(id => ({
        user_id: id,
        title: '🔍 Revisión solicitada',
        message: `${user?.full_name} solicita revisión de: "${task.title}"`,
        type: 'review',
        task_id: task.id,
      })))
    }
    setBusy(false); onUpdate(); onClose()
  }

  // ─── PASO 2 → revisor aprueba → pasa a trafficker ────────────────────────
  async function approveToTrafficker() {
    setBusy(true)
    await updateReviewStatus('pendiente_trafficker')
    const now = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    await supabase.from('task_comments').insert({
      task_id: task.id, user_id: user!.id,
      content: `✅ Revisado y aprobado por ${user?.full_name} el ${now}. Pasando a validación del Trafficker.`,
    })

    // Buscar trafficker del proyecto
    const notifyIds = new Set<string>()
    const clientId = task.project?.client?.id || (task.project as any)?.client_id
    if (clientId) {
      const { data: members } = await supabase
        .from('client_team_members')
        .select('user_id, user:users!user_id(department)')
        .eq('client_id', clientId)
      const trafMember = (members || []).find((m: any) => m.user?.department === 'trafficker')
      if (trafMember) notifyIds.add(trafMember.user_id)

      if (notifyIds.size === 0) {
        const { data: ptasks } = await supabase
          .from('tasks').select('assigned_to, assignee:users!assigned_to(department)')
          .eq('project_id', task.project_id)
        const pt = (ptasks || []).find((t: any) => t.assignee?.department === 'trafficker')
        if (pt) notifyIds.add(pt.assigned_to)
      }
    }
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
    ;(admins || []).forEach((u: any) => notifyIds.add(u.id))

    if (notifyIds.size > 0) {
      await supabase.from('notifications').insert([...notifyIds].map(id => ({
        user_id: id, title: '✅ Listo para autorización',
        message: `${user?.full_name} aprobó "${task.title}". Requiere tu autorización final.`,
        type: 'review', task_id: task.id,
      })))
    }
    setBusy(false); onReviewDone?.(task.id); onUpdate(); onClose()
  }

  // ─── PASO 2 → solicitar retrabajo ────────────────────────────────────────
  async function requestRework() {
    if (!reworkNote.trim()) return
    setBusy(true)
    await updateReviewStatus('cambios_solicitados')
    await supabase.from('tasks').insert({
      project_id: task.project_id,
      title: `🔄 Retrabajo: ${task.title}`,
      description: reworkNote.trim(),
      assigned_to: task.assigned_to,
      department: task.department,
      priority: task.priority,
      status: 'pendiente',
      created_by: user!.id,
    })
    if (task.assigned_to) {
      await supabase.from('notifications').insert({
        user_id: task.assigned_to, title: '🔄 Se solicitaron cambios',
        message: `"${task.title}" necesita ajustes: ${reworkNote.trim().slice(0, 80)}`,
        type: 'review', task_id: task.id,
      })
    }
    setBusy(false); onReviewDone?.(task.id); onUpdate(); onClose()
  }

  // ─── ADMIN → reactivar tarea ─────────────────────────────────────────────
  async function reactivateTask() {
    setBusy(true)
    await supabase.from('tasks').update({
      status: 'en_progreso',
      review_status: null,
      completion_date: null,
    }).eq('id', task.id)
    setBusy(false); onUpdate(); onClose()
  }

  // ─── PASO 3 → trafficker autoriza para cliente ───────────────────────────
  async function authorizeForClient() {
    setBusy(true)
    await updateReviewStatus('aprobada')
    const notifs: any[] = []
    if (task.assigned_to) notifs.push({
      user_id: task.assigned_to, title: '✅ Entregable autorizado',
      message: `"${task.title}" fue autorizado y el cliente ya puede verlo.`, type: 'review',
    })
    const clientUserId = task.project?.client?.user_id
    if (clientUserId) notifs.push({
      user_id: clientUserId, title: '🎉 Nuevo entregable listo',
      message: `"${task.title}" ya está disponible para ti.`, type: 'review',
    })
    if (notifs.length > 0) await supabase.from('notifications').insert(notifs)
    setBusy(false); onUpdate(); onClose()
  }

  // ─── cambiar estatus operativo ───────────────────────────────────────────
  const STATUS_OPTIONS = [
    { value: 'pendiente',   label: 'Pendiente',   color: 'bg-gray-100 text-gray-600 border-gray-300' },
    { value: 'en_progreso', label: 'En progreso', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    { value: 'bloqueada',   label: '⚠ Detenida',  color: 'bg-red-100 text-red-700 border-red-300' },
  ]

  async function saveCommitDate(date: string) {
    setCommitDate(date)
    await supabase.from('tasks').update({ commitment_date: date || null }).eq('id', task.id)
    onUpdate()
  }

  async function changeStatus(newStatus: string) {
    setCurrentStatus(newStatus as any)
    setStatusMenuOpen(false)
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    onUpdate()
  }

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const stepLabel = ['🔄 Retrabajo pendiente', '📝 En progreso', '🔍 En revisión', '⏳ Esperando Trafficker', '✅ Autorizado'][step] || ''
  const stepColor = [
    'bg-orange-100 text-orange-700 border-orange-300',
    'bg-gray-100 text-gray-600 border-gray-300',
    'bg-yellow-100 text-yellow-700 border-yellow-300',
    'bg-blue-100 text-blue-700 border-blue-300',
    'bg-green-100 text-green-700 border-green-300',
  ][step] || ''

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-8">

        {/* ── Cabecera ── */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-bold text-gray-900 leading-snug">{task.title}</h3>
            <p className="text-xs text-gray-400 mt-1">{task.project?.client?.name} — {task.project?.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${stepColor}`}>{stepLabel}</span>

            {/* Selector de estatus operativo — visible si la tarea no está completada */}
            {currentStatus !== 'completada' && (isTeam || isAdmin) && (() => {
              const opt = STATUS_OPTIONS.find(o => o.value === currentStatus) || STATUS_OPTIONS[0]
              return (
                <div className="relative">
                  <button type="button" onClick={() => setStatusMenuOpen(o => !o)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer transition hover:opacity-80 ${opt.color}`}>
                    {opt.label} ▾
                  </button>
                  {statusMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setStatusMenuOpen(false)} />
                      <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[140px] py-1 overflow-hidden">
                        {STATUS_OPTIONS.map(o => (
                          <button key={o.value} type="button" onClick={() => changeStatus(o.value)}
                            className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-gray-50 transition ${o.value === currentStatus ? 'opacity-40 cursor-default' : ''}`}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Indicador de pasos ── */}
          <div className="flex items-center gap-2">
            {[
              { n: 1, label: 'Equipo completa' },
              { n: 2, label: 'Revisor aprueba' },
              { n: 3, label: 'Trafficker autoriza' },
            ].map(({ n, label }, i) => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    step >= n
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : step === 4
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {step > n || step === 4 ? <CheckCircle size={14} /> : n}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-1 text-center leading-tight">{label}</span>
                </div>
                {i < 2 && <div className={`h-0.5 w-6 shrink-0 mb-4 ${step > n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* ── Fecha compromiso ── */}
          {(isTeam || isAdmin) && step === 1 && (
            <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <span className="text-lg shrink-0">📅</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-700 mb-1">¿Para cuándo te comprometes a entregar?</p>
                <input
                  type="date"
                  value={commitDate}
                  onChange={e => saveCommitDate(e.target.value)}
                  className="text-sm border border-orange-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-700 w-full sm:w-auto"
                />
              </div>
              {commitDate && (
                <button type="button" onClick={() => saveCommitDate('')}
                  className="text-xs text-orange-400 hover:text-orange-600 shrink-0">
                  Borrar
                </button>
              )}
            </div>
          )}

          {/* Mostrar fecha si ya está fijada y no está en paso 1 */}
          {commitDate && step > 1 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
              <span>📅</span>
              <span>Compromiso de entrega: <strong className="text-gray-700">{new Date(commitDate + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
            </div>
          )}

          {/* ── Links / Entregables ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Entregables</p>
            {links.length === 0 && (
              <p className="text-xs text-red-500 mb-2 font-medium">📎 Es obligatorio añadir al menos un link o archivo del entregable</p>
            )}
            <div className="space-y-1.5 mb-3">
              {links.map(link => {
                const isHtmlFile = link.url.toLowerCase().includes('.html')
                return (
                  <div key={link.id} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                    {isHtmlFile ? <FileCode size={13} className="text-blue-500 shrink-0" /> : <ExternalLink size={13} className="text-blue-500 shrink-0" />}
                    <a href={link.url} target="_blank" rel="noreferrer"
                      className="text-sm text-blue-600 hover:underline flex-1 truncate font-medium">
                      {link.label}
                    </a>
                    {(isTeam || isAdmin) && (
                      <button type="button" onClick={() => removeLink(link.id)}
                        className="text-gray-300 hover:text-red-400 transition shrink-0">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Agregar link o archivo .html (solo equipo o admin, y solo en pasos 1-2) */}
            {(isTeam || isAdmin) && step <= 2 && (
              <div className="space-y-2">
                <form onSubmit={addLink} className="flex gap-2">
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    placeholder="Nombre del link" required
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                    placeholder="https://..." type="url" required
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="submit"
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition text-xs font-semibold">
                    <Plus size={14} />
                  </button>
                </form>

                <label className="flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer transition">
                  <Upload size={13} />
                  {uploadingFile ? 'Subiendo...' : 'Subir archivo .html (ej: exportado de Claude)'}
                  <input type="file" accept=".html" className="hidden" onChange={uploadHtmlFile} disabled={uploadingFile} />
                </label>
                {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              PASO 1 — Admin/Líder: completar sin revisión
          ═══════════════════════════════════════════════════════ */}
          {step === 1 && isAdmin && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-green-800">¿Lista la tarea?</p>
              <p className="text-xs text-green-600">Como líder, puedes completar esta tarea directamente sin pasar por revisión.</p>
              <button type="button" onClick={async () => {
                setBusy(true)
                await supabase.from('tasks').update({ status: 'completada' }).eq('id', task.id)
                await updateReviewStatus('aprobada')
                setBusy(false); onUpdate(); onClose()
              }} disabled={busy || links.length === 0}
                title={links.length === 0 ? 'Añade al menos un entregable primero' : undefined}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
                <CheckCircle size={14} />
                {busy ? 'Completando...' : 'Marcar como completada'}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              PASO 1 — Equipo solicita revisión
          ═══════════════════════════════════════════════════════ */}
          {step === 1 && isTeam && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-blue-800">Paso 1 — ¿Listo el entregable?</p>
              <p className="text-xs text-blue-600">Agrega el link de entrega arriba y elige quién lo revisa.</p>
              <div>
                <label className="block text-xs font-semibold text-blue-700 mb-1">¿Quién lo revisa?</label>
                <select value={reviewerId} onChange={e => setReviewerId(e.target.value)}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Trafficker / Líder (por defecto)</option>
                  {teamMembers.filter(m => m.id !== user?.id).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={submitForReview} disabled={busy || links.length === 0}
                title={links.length === 0 ? 'Añade al menos un entregable primero' : undefined}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
                <Send size={14} />
                {busy ? 'Enviando...' : links.length === 0 ? 'Añade un entregable para continuar' : 'Solicitar revisión'}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              PASO 2 — Revisor aprueba o pide cambios
          ═══════════════════════════════════════════════════════ */}
          {step === 2 && (isReviewer || canAuthorize) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-yellow-800">Paso 2 — Revisión del entregable</p>
              <p className="text-xs text-yellow-600">Revisa los links de arriba y decide.</p>

              {/* Revisor interno → pasa a Trafficker */}
              {isReviewer && !canAuthorize && (
                <button type="button" onClick={approveToTrafficker} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
                  <ThumbsUp size={14} />
                  {busy ? 'Enviando...' : '✅ Aprobar — pasar a Trafficker'}
                </button>
              )}

              {/* Trafficker / Admin → autoriza directo */}
              {canAuthorize && (
                <button type="button" onClick={authorizeForClient} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
                  <ShieldCheck size={14} />
                  {busy ? 'Autorizando...' : '🛡️ Autorizar — mostrar al cliente'}
                </button>
              )}

              {/* Solicitar retrabajo */}
              {!showRework ? (
                <button type="button" onClick={() => setShowRework(true)}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-lg transition">
                  <RotateCcw size={14} />
                  🔄 Solicitar retrabajo
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea value={reworkNote} onChange={e => setReworkNote(e.target.value)} rows={3}
                    placeholder="Describe qué cambios se necesitan..."
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={requestRework} disabled={busy || !reworkNote.trim()}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50">
                      {busy ? 'Enviando...' : 'Confirmar retrabajo'}
                    </button>
                    <button type="button" onClick={() => { setShowRework(false); setReworkNote('') }}
                      className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              PASO 3 — Trafficker autoriza para el cliente
          ═══════════════════════════════════════════════════════ */}
          {step === 3 && canAuthorize && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-green-800">Paso 3 — Autorización final</p>
              <p className="text-xs text-green-600">El revisor ya aprobó el entregable. Autorízalo para que el cliente lo vea.</p>
              <button type="button" onClick={authorizeForClient} disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
                <ShieldCheck size={14} />
                {busy ? 'Autorizando...' : '🛡️ Autorizar — el cliente ya puede verlo'}
              </button>
              {/* También puede pedir retrabajo */}
              {!showRework ? (
                <button type="button" onClick={() => setShowRework(true)}
                  className="w-full flex items-center justify-center gap-2 border border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100 text-sm font-semibold py-2 rounded-lg transition">
                  <RotateCcw size={14} />
                  Solicitar cambios
                </button>
              ) : (
                <div className="space-y-2">
                  <textarea value={reworkNote} onChange={e => setReworkNote(e.target.value)} rows={3}
                    placeholder="Describe qué cambios se necesitan..."
                    className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                  <div className="flex gap-2">
                    <button type="button" onClick={requestRework} disabled={busy || !reworkNote.trim()}
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50">
                      {busy ? 'Enviando...' : 'Confirmar cambios'}
                    </button>
                    <button type="button" onClick={() => { setShowRework(false); setReworkNote('') }}
                      className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Estado: autorizado ✅ */}
          {step === 4 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-800">Entregable autorizado</p>
                <p className="text-xs text-green-600 mt-0.5">El cliente ya puede ver este entregable.</p>
              </div>
            </div>
          )}

          {/* Estado: retrabajo solicitado */}
          {step === 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
              <RotateCcw size={20} className="text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-orange-800">Se creó una tarea de retrabajo</p>
                <p className="text-xs text-orange-600 mt-0.5">El responsable original fue notificado para hacer los ajustes.</p>
              </div>
            </div>
          )}

          {/* ── Admin: reactivar tarea ── */}
          {isAdmin && step > 1 && (
            <div className="border border-dashed border-red-200 rounded-xl p-3 flex items-center justify-between gap-3 bg-red-50/50">
              <div>
                <p className="text-xs font-semibold text-red-700">Zona admin</p>
                <p className="text-[11px] text-red-400">Regresa la tarea a "En progreso" y borra el avance de revisión.</p>
              </div>
              <button type="button" onClick={reactivateTask} disabled={busy}
                className="shrink-0 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition disabled:opacity-50">
                <RotateCcw size={13} />
                Reactivar
              </button>
            </div>
          )}

          {/* ── Comentarios ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MessageSquare size={13} /> Comentarios
            </p>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {comments.length === 0 && (
                <p className="text-xs text-gray-400">Aún no hay comentarios, escribe el primero</p>
              )}
              {comments.map(c => {
                const canEdit = user?.id === c.user_id || isAdmin
                return (
                  <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2 group">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-700">{c.user?.full_name || 'Usuario'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {canEdit && editingCommentId !== c.id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button type="button" onClick={() => startEditComment(c)}
                              title="Editar comentario" className="text-gray-400 hover:text-blue-500 transition">
                              <Pencil size={11} />
                            </button>
                            <button type="button" onClick={() => deleteComment(c.id)}
                              title="Borrar comentario" className="text-gray-400 hover:text-red-500 transition">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          autoFocus
                          value={editCommentValue}
                          onChange={e => setEditCommentValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEditComment(c.id)
                            if (e.key === 'Escape') setEditingCommentId(null)
                          }}
                          className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button type="button" onClick={() => saveEditComment(c.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2">Guardar</button>
                        <button type="button" onClick={() => setEditingCommentId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1">Cancelar</button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
                    )}
                  </div>
                )
              })}
            </div>
            <form onSubmit={sendComment} className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={sendingComment || !newComment.trim()}
                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                <Send size={14} />
              </button>
            </form>
          </div>

          {/* Botón cerrar */}
          <div className="pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
