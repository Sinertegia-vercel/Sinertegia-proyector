import { AuthProvider, useAuth } from './contexts/AuthContext'
import { WorkSessionProvider, useWorkSession } from './contexts/WorkSessionContext'
import LoginPage from './components/auth/LoginPage'
import ChangePasswordModal from './components/auth/ChangePasswordModal'
import ResetPasswordPage from './components/auth/ResetPasswordPage'
import ClientRegistrationPage from './components/auth/ClientRegistrationPage'
import Navbar from './components/shared/Navbar'
import AdminDashboard from './components/admin/AdminDashboard'
import TeamDashboard from './components/team/TeamDashboard'
import ClientPortal from './components/client/ClientPortal'
import CheckInModal from './components/shared/CheckInModal'
import OvertimeModal from './components/shared/OvertimeModal'
import './index.css'

function AppContent() {
  const { session, user, loading, isPasswordRecovery, unauthorizedEmail } = useAuth()
  const { needsCheckIn, showOvertimeModal } = useWorkSession()
  const inviteToken = new URLSearchParams(window.location.search).get('invite')

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-red-700 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm opacity-70">Cargando...</p>
        </div>
      </div>
    )
  }

  if (isPasswordRecovery) return <ResetPasswordPage />

  if (!session || !user) {
    if (inviteToken) return <ClientRegistrationPage inviteToken={inviteToken} />
    return <LoginPage unauthorizedEmail={unauthorizedEmail} />
  }

  if (user.must_change_password) return <ChangePasswordModal />

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative z-40">
        <Navbar />
      </div>
      <main>
        {user.role === 'admin' && <AdminDashboard />}
        {user.role === 'team' && <TeamDashboard />}
        {user.role === 'client' && <ClientPortal />}
      </main>

      {/* Modales del reloj checador (equipo y admin) */}
      {user.role !== 'client' && needsCheckIn && <CheckInModal />}
      {user.role !== 'client' && showOvertimeModal && <OvertimeModal />}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WorkSessionProvider>
        <AppContent />
      </WorkSessionProvider>
    </AuthProvider>
  )
}
