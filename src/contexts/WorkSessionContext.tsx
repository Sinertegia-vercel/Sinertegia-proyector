import { createContext, useContext, useEffect, useState, useRef } from 'react'
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

function isWorkDay() {
  return new Date().getDay() !== 0 // No domingo
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

  useEffect(() => {
    if (!user || user.role === 'client') return
    loadTodaySession()
  }, [user])

  async function loadTodaySession() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('date', today)
      .is('ended_at', null)
      .maybeSingle()

    if (data) {
      setCurrentSession(data)
      setNeedsCheckIn(false)
    } else {
      setNeedsCheckIn(true)
    }
  }

  // Reloj — actualiza cada minuto
  useEffect(() => {
    if (!currentSession) return
    const tick = () => {
      const start = new Date(currentSession.started_at)
      setElapsedMinutes(Math.round((Date.now() - start.getTime()) / 60000))

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
    const { data } = await supabase
      .from('work_sessions')
      .insert({ user_id: user!.id, location, date: new Date().toISOString().split('T')[0] })
      .select()
      .single()
    if (data) { setCurrentSession(data); setNeedsCheckIn(false) }
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
