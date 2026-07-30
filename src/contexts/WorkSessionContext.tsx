import { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { User } from '../types'

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

function getScheduleHours(user: User, date = new Date()) {
  return {
    start: user.work_start ?? 9,
    end: user.work_end ?? (date.getDay() === 6 ? 14 : 18),
  }
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isSessionFromToday(session: WorkSession) {
  const today = getLocalDateKey()
  return session.date === today || getLocalDateKey(new Date(session.started_at)) === today
}

function calcMinutes(startedAt: string, endedAt: string, user: User) {
  const start = new Date(startedAt)
  const end = new Date(endedAt)
  const schedule = getScheduleHours(user, start)
  const schedEnd = new Date(start)
  schedEnd.setHours(schedule.end, 0, 0, 0)
  const schedStart = new Date(start)
  schedStart.setHours(schedule.start, 0, 0, 0)

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

  const schedule = user ? getScheduleHours(user) : { start: 9, end: 18 }
  const isInOvertime = new Date().getHours() >= schedule.end

  const loadTodaySession = useCallback(async () => {
    if (!user || user.role === 'client') return

    const { data, error } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: true })

    if (error) {
      // Ante un fallo temporal no mostramos el check-in: hacerlo podría crear
      // otra sesión y aparentar que el tiempo anterior se perdió.
      console.error('No se pudo recuperar la sesión laboral activa', error)
      setNeedsCheckIn(false)
      return
    }

    const openSessions = (data || []) as WorkSession[]
    const todaySessions = openSessions.filter(isSessionFromToday)
    const staleSessions = openSessions.filter(session => !isSessionFromToday(session))

    // Una sesión nunca debe cruzar al día siguiente. Si quedó abierta por
    // cerrar la pestaña, se termina automáticamente a la hora de salida de
    // esa persona para que el contador no acumule 24 horas.
    await Promise.all(staleSessions.map(async session => {
      const startedAt = new Date(session.started_at)
      const scheduledEnd = new Date(startedAt)
      scheduledEnd.setHours(getScheduleHours(user, startedAt).end, 0, 0, 0)
      const endedAt = scheduledEnd.toISOString()
      const mins = calcMinutes(session.started_at, endedAt, user)
      await supabase.from('work_sessions').update({ ended_at: endedAt, ...mins }).eq('id', session.id)
    }))

    if (todaySessions.length > 0) {
      // Si el error anterior creó duplicados, conservar la primera entrada
      // mantiene la hora real en la que la persona comenzó a trabajar.
      const session = todaySessions[0]
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
      const endHour = user ? getScheduleHours(user, now).end : 18
      if (now.getHours() === endHour && now.getMinutes() === 0 && !overtimeAlerted.current) {
        overtimeAlerted.current = true
        setShowOvertimeModal(true)
      }
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [currentSession, user])

  async function checkIn(location: 'oficina' | 'home_office') {
    const { data: openRows } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user!.id)
      .is('ended_at', null)
      .order('started_at', { ascending: true })

    const existingSession = ((openRows || []) as WorkSession[]).find(isSessionFromToday)
    if (existingSession) {
      const session = existingSession
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
    if (!currentSession || !user) return
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)

    const todaySessions = ((data || [currentSession]) as WorkSession[]).filter(isSessionFromToday)
    await Promise.all(todaySessions.map(session => {
      const mins = calcMinutes(session.started_at, now, user)
      return supabase.from('work_sessions').update({ ended_at: now, ...mins }).eq('id', session.id)
    }))
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
