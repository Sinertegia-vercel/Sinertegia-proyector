import { Building2, Home, MonitorSmartphone } from 'lucide-react'
import { useWorkSession } from '../../contexts/WorkSessionContext'
import { useAuth } from '../../contexts/AuthContext'

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768
}

export default function CheckInModal() {
  const { user } = useAuth()
  const { checkIn } = useWorkSession()

  const hora = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  const fecha = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const dia = new Date().getDay()
  const hora24 = new Date().getHours()
  const esDomingo = dia === 0
  const esTarde = hora24 >= 18 || (dia === 6 && hora24 >= 14)
  const esCelular = isMobileDevice()

  if (esCelular) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
        style={{ background: 'linear-gradient(135deg, rgba(29,78,216,0.92) 0%, rgba(185,28,28,0.88) 100%)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center">
          <div className="bg-gradient-to-r from-blue-700 to-red-600 px-6 py-5 text-white">
            <p className="text-3xl mb-1">💻</p>
            <h2 className="text-xl font-bold">Hola, {user?.full_name?.split(' ')[0]}</h2>
          </div>
          <div className="p-6">
            <MonitorSmartphone size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-800 mb-2">Registro solo desde computadora</p>
            <p className="text-sm text-gray-500">
              El registro de asistencia únicamente está disponible desde una computadora o laptop. Por favor entra desde tu equipo de trabajo.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'linear-gradient(135deg, rgba(29,78,216,0.92) 0%, rgba(185,28,28,0.88) 100%)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-red-600 px-6 py-5 text-white text-center">
          <p className="text-3xl mb-1">👋</p>
          <h2 className="text-xl font-bold">¡Buen día, {user?.full_name?.split(' ')[0]}!</h2>
          <p className="text-blue-200 text-sm mt-1 capitalize">{fecha} · {hora}</p>
        </div>

        <div className="p-6">
          {esDomingo && (
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-xs text-purple-700 text-center font-medium">
              😴 Hoy es domingo — día de descanso. Las horas se registrarán como extras.
            </div>
          )}
          {!esDomingo && esTarde && (
            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 text-center font-medium">
              ⏰ Estás entrando en horario de horas extras
            </div>
          )}

          <p className="text-sm font-semibold text-gray-700 text-center mb-4">¿Dónde trabajas hoy?</p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => checkIn('oficina')}
              className="flex flex-col items-center gap-3 py-6 px-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <Building2 size={36} className="text-gray-300 group-hover:text-blue-500 transition" />
              <div className="text-center">
                <p className="font-bold text-gray-700 group-hover:text-blue-700">🏢 Oficina</p>
              </div>
            </button>
            <button
              onClick={() => checkIn('home_office')}
              className="flex flex-col items-center gap-3 py-6 px-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
            >
              <Home size={36} className="text-gray-300 group-hover:text-purple-500 transition" />
              <div className="text-center">
                <p className="font-bold text-gray-700 group-hover:text-purple-700">🏠 Home Office</p>
              </div>
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Horario: L-V 9:00–18:00 · Sáb 9:00–14:00
          </p>
        </div>
      </div>
    </div>
  )
}
