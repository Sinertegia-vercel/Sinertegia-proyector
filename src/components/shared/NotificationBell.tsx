import { useEffect, useState, useRef } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  task_id?: string
  read: boolean
  created_at: string
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      fetchNotifications()
      const channel = supabase
        .channel(`notifications-${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => fetchNotifications())
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [user])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user!.id).eq('read', false)
    fetchNotifications()
  }

  async function markRead(id: string, taskId?: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (taskId) {
      setOpen(false)
      window.dispatchEvent(new CustomEvent('open-task', { detail: { taskId } }))
    }
  }

  const unread = notifications.filter(n => !n.read).length

  const unreadMentions = notifications.filter(n => !n.read && n.type === 'mention').length

  const typeIcon: Record<string, string> = {
    task: '📋',
    review: '🔍',
    comment: '💬',
    chat: '💬',
    mention: '@',
    task_request: '📩',
    deadline: '⚠️',
  }

  return (
    <div className="flex items-center gap-1" ref={ref}>
      {/* Badge @ para menciones */}
      {unreadMentions > 0 && (
        <span className="flex items-center justify-center bg-purple-600 text-white text-xs font-bold w-6 h-6 rounded-full cursor-default" title={`${unreadMentions} mención${unreadMentions > 1 ? 'es' : ''} sin leer`}>
          @
        </span>
      )}
      <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800 text-sm">Notificaciones</h4>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <CheckCheck size={13} /> Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">No tienes notificaciones</div>
            )}
            {notifications.map(n => (
              <div key={n.id} onClick={() => markRead(n.id, n.task_id)}
                className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${!n.read ? 'bg-blue-50' : ''}`}>
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">{typeIcon[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-gray-800 ${!n.read ? 'font-semibold' : ''}`}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
