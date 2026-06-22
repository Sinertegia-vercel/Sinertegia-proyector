import type { Department, Priority } from '../types'

export interface TemplateTask {
  title: string
  department: Department
  priority: Priority
  group?: string // sub-grupo visual (solo para el modal de plantilla)
}

export interface ProjectTemplate {
  id: string
  name: string
  icon: string
  description: string
  tasks: TemplateTask[]
}

// ─────────────────────────────────────────────
//  TAREAS BASE (compartidas VSL y Webinar)
// ─────────────────────────────────────────────

const baseTasks: TemplateTask[] = [
  // ── Cliente ──
  { title: 'Llenar los 3 documentos', department: 'cliente', priority: 'alta' },
  { title: 'Reunión con el líder del proyecto para revisar guiones', department: 'cliente', priority: 'alta' },
  { title: 'Grabar VSL de webinar, Gracias y 12 anuncios', department: 'cliente', priority: 'alta' },
  { title: 'Compartir la grabación de video de VSL, Gracias, 12 anuncios', department: 'cliente', priority: 'alta' },
  { title: 'Crear Presentación', department: 'cliente', priority: 'alta' },
  { title: 'Revisar el embudo con el equipo para dar check final', department: 'cliente', priority: 'alta' },
  { title: 'Compartir con el equipo de BGI los links para autorizarlos', department: 'cliente', priority: 'alta' },
  { title: 'Solicitar reunión de revisión de presentación con Alfredo Mota', department: 'cliente', priority: 'alta' },
  // ── Líder (ScrumMaster) ──
  { title: 'Crear grupo de WhatsApp con cliente y equipo', department: 'lider', priority: 'alta' },
  { title: 'Enviar 3 documentos para llenar', department: 'lider', priority: 'alta' },
  { title: 'Agendar reunión inicial con cliente y equipo', department: 'lider', priority: 'alta' },
  { title: 'Recolección de accesos', department: 'lider', priority: 'alta' },
  { title: 'Reunión con el equipo interno, para confirmar fechas de entrega', department: 'lider', priority: 'alta' },
  { title: 'Validar guiones VSL, Gracias, 12 anuncios', department: 'lider', priority: 'alta' },
  { title: 'Agendar reunión con el cliente para el feedback y entrega de guiones', department: 'lider', priority: 'alta' },
  { title: 'Entregar al cliente para feedback los guiones', department: 'lider', priority: 'alta' },
  { title: 'Agendar sesión de grabación', department: 'lider', priority: 'alta' },
  { title: 'Revisar con el equipo de webmaster el embudo completo', department: 'lider', priority: 'alta' },
  { title: 'Solicitar reunión con el experto para dar check final del embudo', department: 'lider', priority: 'alta' },
  // ── Webmaster ──
  { title: 'Montar funnel completo en GHL', department: 'webmaster', priority: 'alta' },
  { title: 'Cambiar diseño visual de Pág. Gracias', department: 'webmaster', priority: 'alta' },
  { title: 'Cambiar diseño visual de Pág. Ingreso al Webinar', department: 'webmaster', priority: 'alta' },
  { title: 'Cambiar diseño visual y de texto a la Página de Oferta', department: 'webmaster', priority: 'alta' },
  { title: 'Instalar "Pixel" de Meta ADS', department: 'webmaster', priority: 'alta' },
  { title: 'Crear los "custom value" en GHL', department: 'webmaster', priority: 'alta' },
  { title: 'Crear grupo de WhatsApp en Funnelchat', department: 'webmaster', priority: 'alta' },
  { title: 'Crear el Evento en Addevent', department: 'webmaster', priority: 'alta' },
  { title: 'Crear la automatización de correos', department: 'webmaster', priority: 'alta' },
  { title: 'Agregar los copys en correo', department: 'webmaster', priority: 'alta' },
  { title: 'Agregar video de gracias y VSL', department: 'webmaster', priority: 'alta' },
  { title: 'Solicitar revisión de embudo con el líder', department: 'webmaster', priority: 'alta' },
  { title: 'Programar los mensajes de WhatsApp en Funnelchat', department: 'webmaster', priority: 'alta' },
  { title: 'Reset de timers de embudo', department: 'webmaster', priority: 'alta' },
  // ── Copy ──
  { title: 'Crear carpeta de ChatGPT del cliente', department: 'copy', priority: 'alta' },
  { title: 'Subir archivo de Preguntas de Poder', department: 'copy', priority: 'alta' },
  { title: 'Subir ADN de Marca (si aplica)', department: 'copy', priority: 'media' },
  { title: 'Subir el NTPVS a la carpeta del experto', department: 'copy', priority: 'alta' },
  { title: 'Hacer investigación en Comet (IG, TikTok, YT)', department: 'copy', priority: 'alta' },
  { title: 'Crear prompt experto: Mapa Emocional', department: 'copy', priority: 'alta' },
  { title: 'Crear prompt experto: Guiones VSL y Gracias', department: 'copy', priority: 'alta' },
  { title: 'Crear prompt: Meta Ads (guiones de video)', department: 'copy', priority: 'alta' },
  { title: 'Crear prompt experto: LP', department: 'copy', priority: 'alta' },
  { title: 'Crear prompt: Emails + WhatsApp', department: 'copy', priority: 'alta' },
  { title: 'Entregar textos a la Diseñadora de páginas web', department: 'copy', priority: 'alta' },
  { title: 'Entregar textos a la Web Master de Correo y WhatsApp', department: 'copy', priority: 'alta' },
  { title: 'Crear prompt: Copy In / Out para Ads', department: 'copy', priority: 'alta' },
  { title: 'Entregar textos de Copy In / Out para Ads a la diseñadora de ADS', department: 'copy', priority: 'alta' },
  // ── Diseño — Páginas web ──
  { title: 'Diseñar Landing Page (LP)', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar Página de Gracias', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar miniatura del video de LP y Gracias', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar imagen mockup para WhatsApp en página de gracias', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  // ── Diseño — Imágenes / Ads ──
  { title: 'Diseñar imágenes para correos', department: 'diseno', priority: 'alta', group: 'diseno_ads' },
  { title: 'Diseñar Mockup para página de Oferta', department: 'diseno', priority: 'alta', group: 'diseno_ads' },
  { title: 'Diseñar imágenes para grupo de WhatsApp', department: 'diseno', priority: 'alta', group: 'diseno_ads' },
  { title: 'Diseñar imágenes para mensajes de WhatsApp', department: 'diseno', priority: 'alta', group: 'diseno_ads' },
  { title: 'Diseñar 3 imágenes tipo carruseles para Meta Ads', department: 'diseno', priority: 'alta', group: 'diseno_ads' },
  { title: 'Diseñar 3 imágenes simples para Meta Ads', department: 'diseno', priority: 'alta', group: 'diseno_ads' },
  // ── Edición — Videos ──
  { title: 'Editar VSL principal', department: 'edicion', priority: 'alta', group: 'edicion_video' },
  { title: 'Editar video de Gracias', department: 'edicion', priority: 'alta', group: 'edicion_video' },
  { title: 'Editar 6 anuncios — ronda 1 (2 fríos, 2 templados, 2 calientes)', department: 'edicion', priority: 'alta', group: 'edicion_video' },
  { title: 'Editar 6 anuncios — ronda 2 (2 fríos, 2 templados, 2 calientes)', department: 'edicion', priority: 'alta', group: 'edicion_video' },
  // ── Trafficker ──
  { title: 'Revisar cuenta publicitaria y BM', department: 'trafficker', priority: 'alta' },
  { title: 'Crear Pixel de Meta', department: 'trafficker', priority: 'alta' },
  { title: 'Compartir Pixel a Web Master', department: 'trafficker', priority: 'alta' },
  { title: 'Montar campañas en Meta Ads', department: 'trafficker', priority: 'alta' },
  { title: 'Lanzar campañas', department: 'trafficker', priority: 'alta' },
  // ── Grabación (Producción) ──
  { title: 'Grabar 12 anuncios', department: 'grabacion', priority: 'alta' },
  { title: 'Grabar VSL y Video de Gracias', department: 'grabacion', priority: 'alta' },
  { title: 'Encarpetar', department: 'grabacion', priority: 'media' },
]

const vslTasks: TemplateTask[] = baseTasks

const webinarTasks: TemplateTask[] = [
  ...baseTasks.filter(t => t.group !== 'diseno_web'), // reemplazamos diseno_web con versión webinar
  // Diseño — Páginas web (webinar agrega: presentación del webinar)
  { title: 'Diseñar Landing Page (LP)', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar Página de Gracias', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar miniatura del video de LP y Gracias', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar imagen mockup para WhatsApp en página de gracias', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  { title: 'Diseñar presentación de webinar (solo diseño, no estructura)', department: 'diseno', priority: 'alta', group: 'diseno_web' },
  // Edición — Presentación (solo webinar)
  { title: 'Video de Edificación - Presentación', department: 'edicion', priority: 'alta', group: 'edicion_presentacion' },
]

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'vsl',
    name: 'VSL',
    icon: '🎬',
    description: 'Embudo VSL completo — producción de video, copy, diseño, webmaster y tráfico',
    tasks: vslTasks,
  },
  {
    id: 'webinar',
    name: 'Webinar',
    icon: '📡',
    description: 'Embudo Webinar — incluye presentación del webinar y video de edificación',
    tasks: webinarTasks,
  },
  {
    id: 'otro',
    name: 'Sin plantilla',
    icon: '➕',
    description: 'Proyecto en blanco — agregas las tareas manualmente',
    tasks: [],
  },
]

// ── Labels y colores por departamento (para portal cliente y vistas generales) ──
export const DEPT_LABELS: Record<string, string> = {
  cliente: 'Cliente',
  lider: 'Líder / ScrumMaster',
  webmaster: 'WebMaster',
  copy: 'Copy',
  diseno: 'Diseño',
  edicion: 'Edición',
  trafficker: 'Trafficker',
  grabacion: 'Grabación / Producción',
}

export const DEPT_COLORS: Record<string, string> = {
  cliente: 'bg-blue-100 text-blue-700 border-blue-200',
  lider: 'bg-purple-100 text-purple-700 border-purple-200',
  webmaster: 'bg-pink-100 text-pink-700 border-pink-200',
  copy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  diseno: 'bg-green-100 text-green-700 border-green-200',
  edicion: 'bg-orange-100 text-orange-700 border-orange-200',
  trafficker: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  grabacion: 'bg-violet-100 text-violet-700 border-violet-200',
}

export const DEPT_ORDER: string[] = [
  'cliente', 'lider', 'webmaster', 'copy', 'diseno', 'edicion', 'trafficker', 'grabacion',
]

// ── Sub-grupos para el modal de plantilla ──
export const GROUP_LABELS: Record<string, string> = {
  cliente: 'Cliente',
  lider: 'Líder / ScrumMaster',
  webmaster: 'WebMaster',
  copy: 'Copy',
  diseno_web: 'Diseño — Páginas web',
  diseno_ads: 'Diseño — Imágenes / Ads',
  edicion_video: 'Edición — Videos',
  edicion_presentacion: 'Edición — Presentación',
  trafficker: 'Trafficker',
  grabacion: 'Grabación / Producción',
}

export const GROUP_COLORS: Record<string, string> = {
  cliente: 'bg-blue-100 text-blue-700 border-blue-200',
  lider: 'bg-purple-100 text-purple-700 border-purple-200',
  webmaster: 'bg-pink-100 text-pink-700 border-pink-200',
  copy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  diseno_web: 'bg-green-100 text-green-700 border-green-200',
  diseno_ads: 'bg-teal-100 text-teal-700 border-teal-200',
  edicion_video: 'bg-orange-100 text-orange-700 border-orange-200',
  edicion_presentacion: 'bg-amber-100 text-amber-800 border-amber-200',
  trafficker: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  grabacion: 'bg-violet-100 text-violet-700 border-violet-200',
}

export const TEMPLATE_GROUP_ORDER: string[] = [
  'cliente', 'lider', 'webmaster', 'copy',
  'diseno_web', 'diseno_ads',
  'edicion_video', 'edicion_presentacion',
  'trafficker', 'grabacion',
]
