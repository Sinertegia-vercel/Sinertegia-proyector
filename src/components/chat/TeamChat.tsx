import { useEffect, useState, useRef } from 'react'
import { Users, Music } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { ChatMessage, User } from '../../types'
import MentionInput from './MentionInput'

function renderWithMentions(content: string, userNames: string[]) {
  if (!content || !userNames.length) return <span>{content}</span>
  const escaped = userNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g')
  const parts = content.split(regex)
  return (
    <span>
      {parts.map((part, i) =>
        userNames.some(n => part === `@${n}`)
          ? <span key={i} className="bg-blue-100 text-blue-700 rounded px-0.5 font-semibold">{part}</span>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

function FilePreview({ url, type, name, isMe }: { url: string; type: string; name: string; isMe: boolean }) {
  if (type === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name} className="max-w-[200px] max-h-[200px] rounded-lg object-cover mt-1 hover:opacity-90 transition" />
      </a>
    )
  }
  if (type === 'audio') {
    return (
      <div className={`mt-1 flex items-center gap-2 rounded-xl px-3 py-2 ${isMe ? 'bg-blue-700' : 'bg-gray-100'}`}>
        <Music size={14} className={isMe ? 'text-blue-200' : 'text-gray-500'} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs truncate mb-1 ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>{name}</p>
          <audio controls src={url} className="w-full h-8" style={{ maxWidth: '200px' }} />
        </div>
      </div>
    )
  }
  return null
}

async function getOrCreateTeamRoom(): Promise<string | null> {
  const { data: existing } = await supabase
    .from('chat_rooms').select('id').eq('type', 'team').maybeSingle()
  if (existing) return existing.id
  const { data: created } = await supabase
    .from('chat_rooms').insert({ type: 'team', name: 'Chat del Equipo' }).select('id').single()
  return created?.id || null
}

export default function TeamChat() {
  const { user } = useAuth()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatUsers, setChatUsers] = useState<User[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { initRoom() }, [])

  useEffect(() => {
    if (!roomId) return
    const channel = supabase.channel(`team-chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        () => fetchMessages(roomId))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function initRoom() {
    const [id, { data: users }] = await Promise.all([
      getOrCreateTeamRoom(),
      supabase.from('users').select('*').in('role', ['admin', 'team']),
    ])
    setChatUsers(users || [])
    if (id) { setRoomId(id); await fetchMessages(id) }
    setLoading(false)
  }

  async function fetchMessages(id: string) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:users!sender_id(id, full_name, role)')
      .eq('room_id', id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages((data as ChatMessage[]) || [])
  }

  async function sendMessage() {
    if (!newMessage.trim() && !selectedFile) return
    if (!roomId || !user) return

    const content = newMessage.trim()
    setNewMessage('')
    const fileToSend = selectedFile
    setSelectedFile(null)

    let file_url: string | undefined
    let file_type: string | undefined
    let file_name: string | undefined

    if (fileToSend) {
      const ext = fileToSend.name.split('.').pop()
      const path = `${roomId}/${Date.now()}_${fileToSend.name}`
      const { error } = await supabase.storage.from('chat-files').upload(path, fileToSend)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
        file_url = publicUrl
        file_type = fileToSend.type.startsWith('image/') ? 'image' : 'audio'
        file_name = fileToSend.name
      }
    }

    await supabase.from('chat_messages').insert({
      room_id: roomId,
      sender_id: user.id,
      content: content || '',
      ...(file_url ? { file_url, file_type, file_name } : {}),
    })

    const others = chatUsers.filter(u => u.id !== user.id)
    if (others.length > 0) {
      const messagePreview = content.slice(0, 100) + (content.length > 100 ? '...' : '')
      await supabase.from('notifications').insert(
        others.map(u => {
          const isMentioned = content.includes(`@${u.full_name}`)
          return {
            user_id: u.id,
            title: isMentioned ? `@${user.full_name} te mencionó en el chat` : `💬 ${user.full_name} en el Chat del Equipo`,
            message: messagePreview,
            type: isMentioned ? 'mention' : 'chat',
            read: false,
          }
        })
      )
    }
    fetchMessages(roomId)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando chat...</div>

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-700 to-blue-900 text-white flex items-center gap-2">
        <Users size={16} />
        <div>
          <h3 className="font-semibold text-sm">Chat Interno del Equipo</h3>
          <p className="text-xs text-blue-200">Solo visible para el equipo</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <Users size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay mensajes aún. ¡Sé el primero!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id
          const senderName = (msg.sender as any)?.full_name || 'Usuario'
          const initial = senderName.charAt(0).toUpperCase()
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'}`}>
                {initial}
              </div>
              <div className={`max-w-xs lg:max-w-md flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <span className="text-xs text-gray-400 mb-1 ml-1">{senderName}</span>}
                {msg.content && (
                  <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'}`}>
                    {renderWithMentions(msg.content, chatUsers.map(u => u.full_name))}
                  </div>
                )}
                {msg.file_url && msg.file_type && msg.file_name && (
                  <FilePreview url={msg.file_url} type={msg.file_type} name={msg.file_name} isMe={isMe} />
                )}
                <span className="text-xs text-gray-300 mt-1 mx-1">
                  {new Date(msg.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 p-3 bg-white">
        <MentionInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={sendMessage}
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          onClearFile={() => setSelectedFile(null)}
          users={chatUsers.filter(u => u.id !== user?.id)}
          placeholder="Escribe un mensaje... (@ para mencionar)"
        />
      </div>
    </div>
  )
}
