interface Props { value: string; onChange: (value: string) => void; required?: boolean }

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function BirthdayDatePicker({ value, onChange, required }: Props) {
  const [year = '', month = '', day = ''] = value ? value.split('-') : []
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 90 }, (_, index) => currentYear - 15 - index)
  const maxDays = month && year ? new Date(Number(year), Number(month), 0).getDate() : 31
  function update(nextDay: string, nextMonth: string, nextYear: string) {
    if (!nextDay || !nextMonth || !nextYear) return onChange('')
    const safeDay = Math.min(Number(nextDay), new Date(Number(nextYear), Number(nextMonth), 0).getDate())
    onChange(`${nextYear}-${nextMonth.padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`)
  }
  const classes = 'h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  return <div className="grid grid-cols-[.8fr_1.35fr_1fr] gap-2">
    <select aria-label="Día de nacimiento" required={required} value={day ? String(Number(day)) : ''} onChange={e => update(e.target.value, month, year)} className={classes}><option value="">Día</option>{Array.from({ length: maxDays }, (_, i) => i + 1).map(item => <option key={item} value={item}>{item}</option>)}</select>
    <select aria-label="Mes de nacimiento" required={required} value={month ? String(Number(month)) : ''} onChange={e => update(day, e.target.value, year)} className={classes}><option value="">Mes</option>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
    <select aria-label="Año de nacimiento" required={required} value={year} onChange={e => update(day, month, e.target.value)} className={classes}><option value="">Año</option>{years.map(item => <option key={item} value={item}>{item}</option>)}</select>
  </div>
}
