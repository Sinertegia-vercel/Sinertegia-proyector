import type { LucideIcon } from 'lucide-react'
import { Lightbulb } from 'lucide-react'

export interface SidebarItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface Props {
  items: SidebarItem[]
  activeId: string
  onSelect: (id: string) => void
}

export default function Sidebar({ items, activeId, onSelect }: Props) {
  return (
    <aside className="w-16 md:w-60 shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col self-start">
      <nav className="flex-1 p-2 md:p-3 space-y-1">
        {items.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} type="button" onClick={() => onSelect(id)}
            className={`relative w-full flex items-center justify-center md:justify-start gap-3 px-2 md:px-3 py-2.5 rounded-lg text-sm font-medium transition text-left ${
              activeId === id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            <Icon size={16} className="shrink-0" />
            <span className="truncate hidden md:inline">{label}</span>
            {!!badge && (
              <span className="absolute top-1 right-1 md:static md:ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="hidden md:block p-3 border-t border-gray-100">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
            <Lightbulb size={13} /> Consejo rápido
          </p>
          <p className="text-xs text-blue-600 mt-1.5 leading-relaxed">
            Organiza tus tareas con prioridades y fechas de entrega para mejorar tu productividad.
          </p>
        </div>
      </div>
    </aside>
  )
}
