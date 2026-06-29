import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import logoImg from '../assets/logo.png'

export interface ReportTask {
  title: string
  responsable: string
  priority: string
  date: string | null
}

const SLATE = '#323A44'
const SLATE_D = '#262C34'
const RED = '#D8232A'
const YELLOW = '#F2C20A'
const INK = '#2B313A'
const MUTED = '#8A93A0'
const CARD = '#FFFFFF'
const LINE = '#E7EBEF'
const GREEN = '#2E9E5B'
const PALETTE = [RED, SLATE, YELLOW, '#5B6470', '#E07A2B', GREEN, '#7A5BD8', '#C0392B']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function colorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function avatar(name: string, size = 18): string {
  return `<span style="width:${size}px;height:${size}px;border-radius:50%;background:${colorFor(name)};color:#fff;font-size:${size * 0.45}px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${esc(initials(name))}</span>`
}

function prioPill(p: string): string {
  if (p === 'alta' || p === 'critica') return `<span style="font-size:9.5px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;background:#FBE3E4;color:${RED};">● ${p === 'critica' ? 'Crítica' : 'Alta'}</span>`
  if (p === 'media') return `<span style="font-size:9.5px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;background:#FBF0CC;color:#9A7B0A;">● Media</span>`
  return `<span style="font-size:9.5px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;background:#E5EAEF;color:${SLATE};">● Baja</span>`
}

function dateChip(d: string | null): string {
  if (!d) return `<span style="font-size:9.5px;padding:3px 9px;border-radius:20px;white-space:nowrap;background:#F0F2F4;color:${MUTED};">Sin fecha</span>`
  return `<span style="font-size:9.5px;padding:3px 9px;border-radius:20px;white-space:nowrap;background:#EAF4FF;color:#2C6FB0;">📅 ${esc(d)}</span>`
}

function taskRow(t: ReportTask, idx: number): string {
  return `<div style="display:flex;align-items:center;gap:12px;background:${CARD};border:1px solid ${LINE};border-radius:12px;padding:9px 13px;margin-bottom:7px;box-shadow:0 2px 6px rgba(40,50,65,.04);">
    <div style="font-size:11px;font-weight:700;color:${MUTED};width:22px;flex:0 0 auto;text-align:center;">${String(idx).padStart(2, '0')}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:11.8px;font-weight:500;color:${INK};line-height:1.25;">${esc(t.title)}</div>
      <div style="display:flex;align-items:center;gap:7px;margin-top:4px;">${avatar(t.responsable)}<span style="font-size:10px;color:${MUTED};font-weight:300;">${esc(t.responsable)}</span></div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto;">${prioPill(t.priority)}${dateChip(t.date)}</div>
  </div>`
}

function section(title: string, items: ReportTask[], accent: string, icon: string): string {
  const body = items.length === 0
    ? `<div style="font-size:11.5px;color:${MUTED};padding:14px;text-align:center;background:${CARD};border:1px dashed ${LINE};border-radius:12px;">Sin tareas en esta categoría.</div>`
    : items.map((t, i) => taskRow(t, i + 1)).join('')
  return `<section style="margin-bottom:18px;">
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:11px;padding-bottom:9px;border-bottom:2px solid ${accent};">
      <span style="width:26px;height:26px;border-radius:8px;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;background:${accent};">${icon}</span>
      <h2 style="font-size:15px;font-weight:700;color:${SLATE};flex:1;letter-spacing:-.2px;margin:0;">${esc(title)}</h2>
      <span style="color:#fff;font-size:11px;font-weight:700;padding:3px 11px;border-radius:20px;background:${accent};">${items.length}</span>
    </div>
    <div>${body}</div>
  </section>`
}

function buildReportHtml(opts: {
  titulo: string
  subtitulo: string
  fecha: string
  pie: string
  completadas: ReportTask[]
  enProgreso: ReportTask[]
  pendientes: ReportTask[]
}): string {
  const { titulo, subtitulo, fecha, pie, completadas, enProgreso, pendientes } = opts
  const all = [...completadas, ...enProgreso, ...pendientes]
  const total = Math.max(all.length, 1)
  const nComp = completadas.length, nProg = enProgreso.length, nPend = pendientes.length
  const pct = Math.round((nComp / total) * 100)

  const totalByResp = new Map<string, number>()
  const doneByResp = new Map<string, number>()
  all.forEach(t => totalByResp.set(t.responsable, (totalByResp.get(t.responsable) || 0) + 1))
  completadas.forEach(t => doneByResp.set(t.responsable, (doneByResp.get(t.responsable) || 0) + 1))
  const maxc = Math.max(...totalByResp.values(), 1)
  const respRows = [...totalByResp.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, c]) => {
      const done = doneByResp.get(name) || 0
      const w = Math.round((c / maxc) * 100)
      const wd = c ? Math.round((done / c) * 100) : 0
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px;">
        <div style="width:165px;font-size:11px;font-weight:500;color:${INK};display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden;">
          ${avatar(name)}<span style="overflow:hidden;text-overflow:ellipsis;">${esc(name)}</span>
        </div>
        <div style="flex:1;height:13px;background:#EEF2F5;border-radius:8px;overflow:hidden;">
          <div style="height:100%;border-radius:8px;position:relative;width:${w}%;background:${colorFor(name)};">
            <div style="position:absolute;left:0;top:0;height:100%;background:rgba(255,255,255,.45);width:${wd}%;"></div>
          </div>
        </div>
        <div style="width:42px;text-align:right;font-size:11px;font-weight:600;color:${MUTED};">${done}/${c}</div>
      </div>`
    }).join('')

  return `<div style="width:793px;font-family:'Poppins','Segoe UI',sans-serif;color:${INK};background:#F4F6F8;">
    <div style="position:relative;background:linear-gradient(135deg,${SLATE} 0%,${SLATE_D} 100%);color:#fff;padding:30px 34px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:18px;position:relative;z-index:2;">
        <div style="width:78px;height:78px;background:#fff;border-radius:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(0,0,0,.25);flex:0 0 auto;">
          <img src="${logoImg}" style="width:62px;height:62px;object-fit:contain;" />
        </div>
        <div>
          <span style="display:inline-block;font-size:10px;letter-spacing:2.5px;font-weight:600;color:${YELLOW};text-transform:uppercase;margin-bottom:8px;">Reporte de Tareas</span>
          <h1 style="font-size:25px;font-weight:700;letter-spacing:-.3px;line-height:1.1;margin:0;">${esc(titulo)}</h1>
          <div style="font-size:12.5px;color:#C7CDD6;margin-top:4px;font-weight:300;">${esc(subtitulo)} · Generado el ${esc(fecha)}</div>
        </div>
      </div>
    </div>
    <div style="height:5px;width:100%;background:linear-gradient(90deg,${RED} 0 60%,${YELLOW} 60% 100%);"></div>

    <div style="display:flex;gap:12px;padding:22px 34px 6px;">
      ${[
        { cap: 'Completadas', num: nComp, foot: `${pct}% del total`, color: GREEN, numColor: SLATE },
        { cap: 'En progreso', num: nProg, foot: 'activas ahora', color: YELLOW, numColor: SLATE },
        { cap: 'Pendientes', num: nPend, foot: 'por arrancar', color: RED, numColor: RED },
        { cap: 'Total', num: all.length, foot: 'tareas del proyecto', color: SLATE, numColor: SLATE },
      ].map(k => `
      <div style="flex:1;background:${CARD};border-radius:16px;padding:16px 16px 14px;box-shadow:0 4px 14px rgba(40,50,65,.06);border:1px solid ${LINE};position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;width:5px;height:100%;background:${k.color};"></div>
        <div style="font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:${MUTED};">${k.cap}</div>
        <div style="font-size:32px;font-weight:700;line-height:1;margin-top:6px;color:${k.numColor};">${k.num}</div>
        <div style="font-size:10.5px;color:${MUTED};margin-top:4px;font-weight:300;">${k.foot}</div>
      </div>`).join('')}
    </div>

    <div style="padding:8px 34px 4px;">
      <div style="background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:16px 18px;box-shadow:0 4px 14px rgba(40,50,65,.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:12px;font-weight:600;color:${SLATE};">Avance general del proyecto</span>
          <span style="font-size:13px;font-weight:700;color:${GREEN};">${pct}% completado</span>
        </div>
        <div style="height:14px;background:#EAEFF3;border-radius:10px;overflow:hidden;display:flex;">
          <div style="background:linear-gradient(90deg,${GREEN},#37b86b);width:${(nComp / total * 100).toFixed(1)}%;"></div>
          <div style="background:repeating-linear-gradient(45deg,#F3D6D7,#F3D6D7 6px,#fae4e5 6px,#fae4e5 12px);width:${(nPend / total * 100).toFixed(1)}%;"></div>
        </div>
        <div style="display:flex;gap:18px;margin-top:9px;font-size:10.5px;color:${MUTED};">
          <span><i style="width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:middle;background:${GREEN};"></i>Completadas (${nComp})</span>
          <span><i style="width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:middle;background:${YELLOW};"></i>En progreso (${nProg})</span>
          <span><i style="width:9px;height:9px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:middle;background:#F3D6D7;"></i>Pendientes (${nPend})</span>
        </div>
      </div>
    </div>

    <div style="padding:14px 34px 4px;">
      <div style="background:${CARD};border:1px solid ${LINE};border-radius:16px;padding:16px 18px 14px;box-shadow:0 4px 14px rgba(40,50,65,.06);">
        <h3 style="font-size:12px;font-weight:600;color:${SLATE};margin-bottom:12px;display:flex;align-items:center;gap:8px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${RED};display:inline-block;"></span>
          Carga por responsable <span style="font-weight:300;color:${MUTED};font-size:10px;">(completadas / total)</span>
        </h3>
        ${respRows}
      </div>
    </div>

    <div style="padding:16px 34px 24px;">
      ${section('Completadas', completadas, GREEN, '✓')}
      ${section('En progreso', enProgreso, YELLOW, '◐')}
      ${section('Faltantes / Pendientes', pendientes, RED, '!')}
    </div>

    <div style="position:relative;height:20mm;padding:0 34px;display:flex;align-items:center;justify-content:space-between;background:${SLATE};color:#fff;font-size:9.5px;font-weight:300;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${RED} 0 60%,${YELLOW} 60% 100%);"></div>
      <div><b>${esc(pie)}</b></div>
      <div style="color:#C7CDD6;">Generado el ${esc(fecha)}</div>
    </div>
  </div>`
}

export async function generateClientReportPdf(opts: {
  titulo: string
  subtitulo: string
  fecha: string
  pie: string
  completadas: ReportTask[]
  enProgreso: ReportTask[]
  pendientes: ReportTask[]
  filename: string
}) {
  const html = buildReportHtml(opts)

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    })

    const pageWidthMm = 210
    const pageHeightMm = 297
    const imgHeightMm = (canvas.height * pageWidthMm) / canvas.width
    const imgData = canvas.toDataURL('image/png')

    if (imgHeightMm <= pageHeightMm) {
      // Cabe en una sola hoja: la hoja se hace del tamaño exacto del contenido, sin espacio sobrante.
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pageWidthMm, imgHeightMm] })
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, imgHeightMm)
      pdf.save(opts.filename)
      return
    }

    // No cabe en una sola hoja: se reparte en hojas A4 normales.
    const pdf = new jsPDF('p', 'mm', 'a4')
    let heightLeft = imgHeightMm
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, pageWidthMm, imgHeightMm)
    heightLeft -= pageHeightMm

    while (heightLeft > 0) {
      position = heightLeft - imgHeightMm
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, pageWidthMm, imgHeightMm)
      heightLeft -= pageHeightMm
    }

    pdf.save(opts.filename)
  } finally {
    document.body.removeChild(container)
  }
}
