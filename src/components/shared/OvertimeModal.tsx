import { Clock } from 'lucide-react'
import { useWorkSession } from '../../contexts/WorkSessionContext'

export default function OvertimeModal() {
  const { continueOvertime, declineOvertime, elapsedMinutes } = useWorkSession()
  const isSaturday = new Date().getDay() === 6
  const endLabel = isSaturday ? '2:00 pm' : '6:00 pm'
  const hours = Math.floor(elapsedMinutes / 60)
  const mins = elapsedMinutes % 60

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-orange-50 px-6 py-5 text-center border-b border-orange-100">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock size={26} className="text-orange-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Ya son las {endLabel}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Llevas{' '}
            <span className="font-bold text-gray-800">{hours > 0 ? `${hours}h ` : ''}{mins}m</span>
            {' '}trabajando hoy
          </p>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 text-center mb-5">
            ¿Continuarás trabajando? Las horas adicionales se registrarán como <span className="font-semibold text-orange-600">horas extras</span>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={declineOvertime}
              className="py-3 px-4 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              No, ya salgo
            </button>
            <button
              onClick={continueOvertime}
              className="py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition"
            >
              ✅ Sí, horas extras
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
