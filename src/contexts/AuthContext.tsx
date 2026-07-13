import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  isPasswordRecovery: boolean
  unauthorizedEmail: string | null
  deactivatedEmail: string | null
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isPasswordRecovery: false,
  unauthorizedEmail: null,
  deactivatedEmail: null,
  signOut: async () => {},
  refreshUser: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null)
  const [deactivatedEmail, setDeactivatedEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchUser(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
        setSession(session)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) fetchUser(session.user.id)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUser(id: string) {
    const { data } = await supabase.from('users').select('*').eq('id', id).single()
    if (!data) {
      // Cuenta autenticada (ej. Google) pero sin registro en el sistema: se rechaza el acceso.
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      setUnauthorizedEmail(currentSession?.user.email || null)
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setLoading(false)
      return
    }
    if ((data as any).active === false) {
      // Cuenta desactivada por el admin: se rechaza el acceso sin borrar su historial.
      setDeactivatedEmail(data.email)
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setLoading(false)
      return
    }
    setUser(data)
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshUser() {
    if (session) await fetchUser(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, isPasswordRecovery, unauthorizedEmail, deactivatedEmail, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
