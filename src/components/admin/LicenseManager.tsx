import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface License {
  status: 'active' | 'suspended'
  plan_name: string | null
  expires_at: string | null
  notes: string | null
}

export default function LicenseManager() {
  const [license, setLicense] = useState<License | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planName, setPlanName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchLicense()
  }, [])

  async function fetchLicense() {
    const { data } = await supabase.from('app_license').select('*').eq('id', 1).single()
    if (data) {
      setLicense(data as License)
      setPlanName(data.plan_name || '')
      setExpiresAt(data.expires_at || '')
      setNotes(data.notes || '')
    }
    setLoading(false)
  }

  async function saveDetails() {
    setSaving(true)
    await supabase.from('app_license').update({
      plan_name: planName.trim() || null,
      expires_at: expiresAt || null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    await fetchLicense()
    setSaving(false)
  }

  async function toggleStatus() {
    if (!license) return
    setSaving(true)
    const newStatus = license.status === 'active' ? 'suspended' : 'active'
    await supabase.from('app_license').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', 1)
    await fetchLicense()
    setSaving(false)
  }

  if (loading || !license) return <div className="text-center py-12 text-gray-400">Cargando licencia...</div>

  const isActive = license.status === 'active'

  return (
    <div className="max-w-lg space-y-5">
      <p className="text-sm text-gray-500">
        Panel exclusivo de súper administrador. Si suspendes la licencia, <strong>nadie</strong> (excepto tú) podrá entrar a esta aplicación hasta que la reactives — útil si esta instancia se vendió o rentó y el pago no se cubrió.
      </p>

      <div className={`rounded-xl border p-5 ${isActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-3">
          {isActive ? <ShieldCheck size={28} className="text-green-600" /> : <ShieldAlert size={28} className="text-red-600" />}
          <div>
            <p className={`font-bold ${isActive ? 'text-green-800' : 'text-red-800'}`}>
              {isActive ? 'Licencia activa' : 'Licencia suspendida'}
            </p>
            <p className={`text-xs ${isActive ? 'text-green-600' : 'text-red-600'}`}>
              {isActive ? 'Todos los usuarios pueden entrar normalmente.' : 'Solo el súper administrador puede entrar.'}
            </p>
          </div>
        </div>
        <button onClick={toggleStatus} disabled={saving}
          className={`mt-4 w-full py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
            isActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
          }`}>
          {saving ? 'Procesando...' : isActive ? 'Suspender aplicación' : 'Reactivar aplicación'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles de la renta / venta</p>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre del plan / cliente</label>
          <input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="Ej: Plan mensual — Agencia XYZ"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vence el</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <button onClick={saveDetails} disabled={saving}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold py-2 rounded-lg transition disabled:opacity-50">
          Guardar detalles
        </button>
      </div>
    </div>
  )
}
