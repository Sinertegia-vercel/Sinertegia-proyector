import { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export interface WorkSession {
  id: string
  user_id: string
  location: 'oficina' | 'home_office'
  started_at: string
  ended_at: string | null
  regular_minutes: number
  overtime_minutes: number
  date: string
}

interface WorkSessionContextType {
  currentSession: WorkSession | null
  needsCheckIn: boolean
  showOvertimeModal: boolean
  checkIn: (location: 'oficina' | 'home_office') => Promise<void>
  checkOut: () => Promise<void>
  continueOvertime: () => void
  declineOvertime: () => void
  elapsedMinutes: number
  isInOvertime: boolean
}

const WorkSessionContext = createContext<WorkSessionContextType>({
  currentSession: null, needsCheckIn: false, showOvertimeModal: false,
  checkIn: async () => {}, checkOut: async () => {},
  continueOvertime: () => {}, declineOvertime: () => {},
  elapsedMinutes: 0, isInOvertime: false,
})

function getEndHour() {
  return new Date().getDay() === 6 ? 14 : 18 // Sábado = 2pm, L-V = 6pm
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calcMinutes(startedAt: string, endedAt: string) {
  const start = new Date(startedAt)
  const end = new Date(endedAt)
  const schedEnd = new Date(start)
  schedEnd.setHours(getEndHour(), 0, 0, 0)
  const schedStart = new Date(start)
  schedStart.setHours(9, 0, 0, 0)

  // Minutos regulares: solapamiento con [9am, endHour]
  const regStart = Math.max(start.getTime(), schedStart.getTime())
  const regEnd = Math.min(end.getTime(), schedEnd.getTime())
  const regular_minutes = regEnd > regStart ? Math.round((regEnd - regStart) / 60000) : 0

  // Minutos extra: tiempo después del horario
  const otStart = Math.max(start.getTime(), schedEnd.getTime())
  const overtime_minutes = end.getTime() > otStart ? Math.round((end.getTime() - otStart) / 60000) : 0

  return { regular_minutes, overtime_minutes }
}

export function WorkSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null)
  const [needsCheckIn, setNeedsCheckIn] = useState(false)
  const [showOvertimeModal, setShowOvertimeModal] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const overtimeAlerted = useRef(false)

  const isInOvertime = new Date().getHours() >= getEndHour()

  const loadTodaySession = useCallback(async () => {
    if (!user || user.role === 'client') return

    // La sesión abierta es la fuente de verdad. No se filtra por `date` porque
    // una fecha UTC, una sesión nocturna o filas duplicadas podían ocultarla.
    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      // Ante un fallo temporal no mostramos el check-in: hacerlo podría crear
      // otra sesión y aparentar que el tiempo anterior se perdió.
      console.error('No se pudo recuperar la sesión laboral activa', error)
      setNeedsCheckIn(false)
      return
    }

    if (data) {
      const session = data as WorkSession
      setCurrentSession(session)
      setElapsedMinutes(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)))
      setNeedsCheckIn(false)
    } else {
      setCurrentSession(null)
      setElapsedMinutes(0)
      setNeedsCheckIn(true)
    }
  }, [user])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadTodaySession() }, 0)
    return () => window.clearTimeout(id)
  }, [loadTodaySession])

  // Reloj — actualiza cada minuto
  useEffect(() => {
    if (!currentSession) return
    const tick = () => {
      const start = new Date(currentSession.started_at)
      setElapsedMinutes(Math.max(0, Math.floor((Date.now() - start.getTime()) / 60000)))

      const now = new Date()
      const endHour = getEndHour()
      if (now.getHours() === endHour && now.getMinutes() === 0 && !overtimeAlerted.current) {
        overtimeAlerted.current = true
        setShowOvertimeModal(true)
      }
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [currentSession])

  async function checkIn(location: 'oficina' | 'home_office') {
    // Evita duplicar sesiones si el modal apareció por una recarga o una
    // respuesta lenta: primero recuperamos cualquier sesión que siga abierta.
    const { data: existingSession } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingSession) {
      const session = existingSession as WorkSession
      setCurrentSession(session)
      setElapsedMinutes(Math.max(0, Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)))
      setNeedsCheckIn(false)
      return
    }

    const { data } = await supabase
      .from('work_sessions')
      .insert({ user_id: user!.id, location, date: getLocalDateKey() })
      .select()
      .single()
    if (data) {
      setCurrentSession(data as WorkSession)
      setElapsedMinutes(0)
      setNeedsCheckIn(false)
    }
  }

  async function checkOut() {
    if (!currentSession) return
    const now = new Date().toISOString()
    const mins = calcMinutes(currentSession.started_at, now)
    await supabase.from('work_sessions').update({ ended_at: now, ...mins }).eq('id', currentSession.id)
    setCurrentSession(null)
    setElapsedMinutes(0)
  }

  function continueOvertime() { setShowOvertimeModal(false) }

  async function declineOvertime() {
    setShowOvertimeModal(false)
    await checkOut()
  }

  return (
    <WorkSessionContext.Provider value={{
      currentSession, needsCheckIn, showOvertimeModal,
      checkIn, checkOut, continueOvertime, declineOvertime,
      elapsedMinutes, isInOvertime,
    }}>
      {children}
    </WorkSessionContext.Provider>
  )
}

export const useWorkSession = () => useContext(WorkSessionContext)
