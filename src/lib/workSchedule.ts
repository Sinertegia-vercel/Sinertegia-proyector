import type { User, WorkDaySchedule, WorkSchedule } from '../types'

export const WEEK_DAYS = [
  { key: '1', short: 'Lun', label: 'Lunes' },
  { key: '2', short: 'Mar', label: 'Martes' },
  { key: '3', short: 'Mié', label: 'Miércoles' },
  { key: '4', short: 'Jue', label: 'Jueves' },
  { key: '5', short: 'Vie', label: 'Viernes' },
  { key: '6', short: 'Sáb', label: 'Sábado' },
  { key: '0', short: 'Dom', label: 'Domingo' },
] as const

export function defaultWorkSchedule(user?: Pick<User, 'work_start' | 'work_end'> | null): WorkSchedule {
  const weekday = { enabled: true, start: user?.work_start ?? 9, end: user?.work_end ?? 18 }
  return {
    '0': { enabled: false, start: 9, end: 18 },
    '1': { ...weekday }, '2': { ...weekday }, '3': { ...weekday }, '4': { ...weekday }, '5': { ...weekday },
    '6': { enabled: true, start: 9, end: 14 },
  }
}

export function resolvedWorkSchedule(user?: Pick<User, 'work_schedule' | 'work_start' | 'work_end'> | null): WorkSchedule {
  return { ...defaultWorkSchedule(user), ...(user?.work_schedule || {}) }
}

export function scheduleForDate(user: Pick<User, 'work_schedule' | 'work_start' | 'work_end'>, date = new Date()): WorkDaySchedule {
  return resolvedWorkSchedule(user)[String(date.getDay())]
}

export function formatHour(hour: number) { return `${String(hour).padStart(2, '0')}:00` }
