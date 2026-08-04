import { useEffect, useState } from 'react'
import { Activity, BarChart3, BriefcaseBusiness, CalendarDays, Camera, CheckCircle2, Clock3, KeyRound, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useWorkSession } from '../../contexts/WorkSessionContext'
import { supabase } from '../../lib/supabase'
import UserAvatar from './UserAvatar'

interface Props { onClose?: () => void; onChangePhoto: () => void; onChangePassword: () => void; embedded?: boolean }
type Tab = 'datos' | 'laboral' | 'seguridad' | 'preferencias'
const DEPTS: Record<string, string> = { edicion: 'Edición', grabacion: 'Grabación', diseno: 'Diseño', copy: 'Copy', webmaster: 'Webmaster', trafficker: 'Trafficker', lider: 'Líder', cliente: 'Cliente' }

export default function UserProfile({ onClose, onChangePhoto, onChangePassword, embedded = false }: Props) {
  const { user, session, refreshUser } = useAuth()
  const { currentSession, elapsedMinutes } = useWorkSession()
  const metadata = session?.user?.user_metadata || {}
  const [tab, setTab] = useState<Tab>('datos')
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: metadata.phone || '', birth_date: metadata.birth_date || '', timezone: metadata.timezone || 'America/Mexico_City', address: metadata.address || '', language: metadata.language || 'es-MX', compact_mode: Boolean(metadata.compact_mode), email_notifications: metadata.email_notifications !== false })
  const [stats, setStats] = useState({ completed: 0, review: 0, onTime: 0 })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('tasks').select('status, review_status, commitment_date, completion_date').eq('assigned_to', user.id).then(({ data }) => {
      const rows = data || []; const completed = rows.filter(t => t.status === 'completada')
      const onTime = completed.length ? Math.round(completed.filter(t => !t.commitment_date || (t.completion_date && t.completion_date <= t.commitment_date)).length / completed.length * 100) : 0
      setStats({ completed: completed.length, review: rows.filter(t => t.review_status === 'pendiente_revision' || t.review_status === 'en_revision').length, onTime })
    })
  }, [user])

  async function saveProfile() {
    if (!user || form.full_name.trim().length < 2) return
    setSaving(true); setMessage('')
    const { error: userError } = await supabase.from('users').update({ full_name: form.full_name.trim() }).eq('id', user.id)
    const { error: authError } = await supabase.auth.updateUser({ data: { phone: form.phone.trim(), birth_date: form.birth_date || null, timezone: form.timezone, address: form.address.trim(), language: form.language, compact_mode: form.compact_mode, email_notifications: form.email_notifications } })
    if (userError || authError) setMessage(userError?.message || authError?.message || 'No se pudieron guardar los cambios.')
    else { await refreshUser(); setMessage('Cambios guardados correctamente.') }
    setSaving(false)
  }

  const start = user?.work_start ?? 9, end = user?.work_end ?? 18
  const hours = Math.floor(elapsedMinutes / 60), minutes = elapsedMinutes % 60
  const progress = Math.min(100, elapsedMinutes / Math.max(60, (end - start) * 60) * 100)
  const lastSignIn = session?.user?.last_sign_in_at ? new Date(session.user.last_sign_in_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin registro'

  return <div className={embedded ? 'w-full' : 'fixed inset-0 z-[60] overflow-y-auto bg-[#f5f6fb]'}>
    {!embedded && <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shadow-sm"><div><h1 className="text-xl font-bold text-slate-900">Mi perfil</h1><p className="text-xs text-slate-500">Administra tu información personal y laboral</p></div><button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={20} /></button></header>}
    <main className={`mx-auto max-w-[1380px] space-y-5 ${embedded ? '' : 'p-4 sm:p-6'}`}>
      {embedded && <div className="mb-1"><h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1><p className="mt-1 text-sm text-slate-500">Administra tu información personal y laboral</p></div>}
      <div className="grid gap-5 lg:grid-cols-[1.12fr_1fr]">
        <Card className="flex flex-wrap items-center gap-6"><UserAvatar name={user?.full_name || 'Usuario'} avatarUrl={user?.avatar_url} size={112} isOnline={Boolean(currentSession)} /><div className="min-w-0 flex-1"><h2 className="truncate text-2xl font-bold text-slate-900">{user?.full_name}</h2><p className="mt-1 flex items-center gap-2 text-sm capitalize text-slate-500"><UserRound size={15} />{user?.role}</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-600"><BriefcaseBusiness size={15} />Departamento: {DEPTS[user?.department || ''] || 'Sin asignar'}</p>{currentSession && <span className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"><i className="h-2 w-2 animate-pulse rounded-full bg-green-500" />En sesión</span>}</div><button onClick={onChangePhoto} className="flex items-center gap-2 rounded-xl border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Camera size={16} />Cambiar foto</button></Card>
        <Card><h3 className="flex items-center gap-2 font-bold text-slate-900"><CalendarDays size={18} />Jornada de hoy</h3><div className="mt-6 grid grid-cols-3 divide-x divide-slate-200 text-center"><Small label="Entrada" value={`${start}:00`} /><Small label="Salida" value={`${end}:00`} /><Small label="Tiempo trabajado" value={`${hours} h ${minutes} min`} green /></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-green-500" style={{ width: `${progress}%` }} /></div><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>0 h</span><span>{end - start} h</span></div></Card>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">{([{ key: 'datos', label: 'Datos personales' }, { key: 'laboral', label: 'Información laboral' }, { key: 'seguridad', label: 'Seguridad' }, { key: 'preferencias', label: 'Preferencias' }] as { key: Tab; label: string }[]).map(item => <button key={item.key} onClick={() => setTab(item.key)} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-semibold ${tab === item.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{item.label}</button>)}</nav>

      {tab === 'datos' && <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]"><Card><h3 className="flex items-center gap-2 font-bold text-slate-900"><UserRound size={18} />Datos personales</h3><div className="grid gap-x-4 sm:grid-cols-2"><Field label="Nombre completo"><input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></Field><Field label="Correo electrónico"><input value={user?.email || ''} readOnly className="bg-slate-50 text-slate-500" /></Field><Field label="Teléfono"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Añadir teléfono" /></Field><Field label="Fecha de nacimiento"><input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} /></Field><Field label="Zona horaria"><select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}><option value="America/Mexico_City">Ciudad de México (GMT-6)</option><option value="America/Cancun">Cancún (GMT-5)</option><option value="America/Tijuana">Tijuana (GMT-8)</option></select></Field><Field label="Dirección"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Añadir dirección" /></Field></div><SaveButton saving={saving} onClick={saveProfile} />{message && <p className={`mt-3 text-xs font-semibold ${message.includes('correctamente') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}</Card><WorkInfo user={user} /></div>}
      {tab === 'laboral' && <div className="grid gap-5 lg:grid-cols-2"><WorkInfo user={user} /><Card><h3 className="flex items-center gap-2 font-bold"><Clock3 size={18} />Horario asignado</h3><p className="mt-5 text-sm text-slate-600">Tu jornada habitual es de <strong>{start}:00 a {end}:00</strong>.</p><p className="mt-2 text-xs text-slate-400">Puesto, departamento y horario solamente pueden modificarlos los administradores.</p></Card></div>}
      {tab === 'seguridad' && <Card className="max-w-2xl"><h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} />Seguridad de la cuenta</h3><div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 p-4"><div><p className="text-sm font-semibold">Contraseña</p><p className="text-xs text-slate-400">Actualízala periódicamente.</p></div><button onClick={onChangePassword} className="flex items-center gap-2 rounded-xl border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700"><KeyRound size={15} />Cambiar contraseña</button></div><div className="mt-3 rounded-xl border border-slate-200 p-4"><p className="text-sm font-semibold">Último inicio de sesión</p><p className="mt-1 text-xs text-slate-500">{lastSignIn}</p></div></Card>}
      {tab === 'preferencias' && <Card className="max-w-2xl"><h3 className="font-bold">Preferencias</h3><Field label="Idioma"><select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}><option value="es-MX">Español (México)</option><option value="en-US">English</option></select></Field><Toggle label="Notificaciones por correo" checked={form.email_notifications} onChange={v => setForm({ ...form, email_notifications: v })} /><Toggle label="Vista compacta" checked={form.compact_mode} onChange={v => setForm({ ...form, compact_mode: v })} /><SaveButton saving={saving} onClick={saveProfile} /></Card>}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]"><Card><h3 className="flex items-center gap-2 font-bold"><BarChart3 size={18} />Resumen de desempeño</h3><div className="mt-5 grid grid-cols-3 divide-x divide-slate-200 text-center"><Metric icon={<CheckCircle2 />} value={stats.completed} label="Completadas" tone="text-green-600" /><Metric icon={<Clock3 />} value={stats.review} label="En revisión" tone="text-amber-500" /><Metric icon={<Activity />} value={`${stats.onTime}%`} label="A tiempo" tone="text-blue-600" /></div></Card><Card><h3 className="flex items-center gap-2 font-bold"><Activity size={18} />Actividad reciente</h3><div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Último inicio de sesión</p><p className="mt-1 text-xs text-slate-500">{lastSignIn}</p></div></Card></div>
    </main>
  </div>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</section> }
function Small({ label, value, green }: { label: string; value: string; green?: boolean }) { return <div><p className="text-xs text-slate-400">{label}</p><p className={`mt-1 font-bold ${green ? 'text-green-600' : 'text-slate-800'}`}>{value}</p></div> }
function Field({ label, children }: { label: string; children: React.ReactElement }) { return <label className="mt-4 block text-xs font-semibold text-slate-600">{label}<span className="mt-1 block [&>input]:w-full [&>input]:rounded-lg [&>input]:border [&>input]:border-slate-300 [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>select]:w-full [&>select]:rounded-lg [&>select]:border [&>select]:border-slate-300 [&>select]:bg-white [&>select]:px-3 [&>select]:py-2.5 [&>select]:text-sm">{children}</span></label> }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <div className="mt-5 flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-sm font-medium text-slate-700">{label}</span><button type="button" onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${checked ? 'left-6' : 'left-1'}`} /></button></div> }
function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) { return <button onClick={onClick} disabled={saving} className="mt-5 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} />{saving ? 'Guardando...' : 'Guardar cambios'}</button> }
function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone: string }) { return <div className="px-3"><span className={`mx-auto flex w-fit ${tone}`}>{icon}</span><p className="mt-1 text-2xl font-bold">{value}</p><p className="text-xs text-slate-500">{label}</p></div> }
function WorkInfo({ user }: { user: ReturnType<typeof useAuth>['user'] }) { return <Card><h3 className="flex items-center gap-2 font-bold"><BriefcaseBusiness size={18} />Información laboral</h3><dl className="mt-5 divide-y divide-slate-200 text-sm"><Row label="Puesto" value={DEPTS[user?.department || ''] || user?.role || 'Sin asignar'} /><Row label="Departamento" value={DEPTS[user?.department || ''] || 'Sin asignar'} /><Row label="Horario" value={`L–V · ${user?.work_start ?? 9}:00–${user?.work_end ?? 18}:00`} /><Row label="Modalidad" value="Según registro diario" /><Row label="Rol de acceso" value={user?.role || '—'} /></dl><p className="mt-5 text-xs text-slate-400">Estos datos los administra la empresa.</p></Card> }
function Row({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-2 gap-3 py-3"><dt className="text-slate-500">{label}</dt><dd className="font-medium capitalize">{value}</dd></div> }
