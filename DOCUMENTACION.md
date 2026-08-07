# Documentación — Sinertegia Launch 57

FAVOR DE DOCUMENTAR CADA CAMBIO QUE SE LE HAGA AL CODIGO 

Guía rápida para entender, prender y modificar este proyecto.

## 1. ¿Qué es esto?

Una app web de gestión de proyectos para la agencia: el equipo crea/avanza tareas, los traffickers/líderes las revisan y autorizan, y los clientes ven sus entregables y piden cambios. Todo corre sobre:

| Pieza | Para qué |
|---|---|
| **React + TypeScript** | La interfaz (todo lo que se ve y se hace clic) |
| **Vite** | Levanta el proyecto en desarrollo y lo compila para producción |
| **Tailwind CSS** | Estilos (clases como `bg-blue-600`, `rounded-xl`, etc.) |
| **Supabase** | Base de datos (Postgres), login de usuarios, archivos (storage) y tiempo real (chat/notificaciones) |
| **Vercel** | Donde vive la página publicada (sinertegia-launch-57) |
| **GitHub** | Donde vive el código (`tonytrafficker57/Sinertegia-proyector`). Cada `git push` a `main` redeploya solo en Vercel |

## 2. Cómo encenderlo en tu computadora

```bash
npm install        # solo la primera vez, o si cambia package.json
npm run dev         # levanta el servidor de desarrollo
```

Abre `http://localhost:5173`. Cada vez que guardas un archivo (Ctrl+S), el navegador se actualiza solo (hot reload) — no hace falta recargar a mano.

Para ver cómo quedaría en producción antes de subirlo:
```bash
npm run build       # compila a la carpeta dist/
npm run preview     # sirve esa carpeta compilada
```

**Si `npm run dev` o `npm run build` truenan** con un error de `rolldown-binding` o "Cannot find native binding": borra las carpetas `node_modules` y el archivo `package-lock.json`, y corre `npm install` de nuevo en tu máquina (es un problema de instalación, no del código).

## 3. Cómo se conecta a Supabase

Archivo [`src/lib/supabase.ts`](src/lib/supabase.ts): crea un único cliente de Supabase usando dos variables de entorno del archivo `.env` (que NO se sube a GitHub, está en `.gitignore`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Todo el resto del código importa ese cliente (`import { supabase } from '../../lib/supabase'`) y lo usa para:
- `supabase.from('tabla').select()/.insert()/.update()/.delete()` → leer/escribir en la base de datos
- `supabase.auth.*` → login, registro, recuperar contraseña, Google
- `supabase.storage.*` → subir archivos (fotos de chat, portadas de cliente)
- `supabase.channel(...)` → tiempo real (mensajes nuevos, notificaciones, quién está en línea)

En producción (Vercel), estas mismas variables se configuran en **Vercel → tu proyecto → Settings → Environment Variables** (ya están puestas).

## 4. Cómo entra cada usuario (autenticación)

[`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) — el "cerebro" de la sesión. Se encarga de:
- Revisar si hay una sesión activa al abrir la app
- Buscar al usuario en la tabla `users` (por su `id`) para saber su **rol** (`admin`, `team`, `client`)
- Si alguien entra con Google pero su correo no está en la tabla `users`, lo rechaza (`unauthorizedEmail`)

[`src/App.tsx`](src/App.tsx) — decide qué pantalla mostrar según el estado de sesión:
- Sin sesión → [`LoginPage`](src/components/auth/LoginPage.tsx) (correo/contraseña, "olvidé contraseña", o Google)
- Recuperando contraseña → [`ResetPasswordPage`](src/components/auth/ResetPasswordPage.tsx)
- `user.role === 'admin'` → [`AdminDashboard`](src/components/admin/AdminDashboard.tsx)
- `user.role === 'team'` → [`TeamDashboard`](src/components/team/TeamDashboard.tsx)
- `user.role === 'client'` → [`ClientPortal`](src/components/client/ClientPortal.tsx)

## 4.1 ¿Cómo sabe la app si eres cliente, equipo o admin?

El login es **el mismo formulario para todos** (correo/contraseña o Google) — no hay manera de "elegir" el tipo de cuenta al entrar. Lo que decide qué pantalla ves es la columna `role` de la tabla `users` en Supabase, asignada desde que se creó la cuenta:

- **Cliente** → se pone solo (`role: 'client'`) cuando el cliente completa su registro desde el link de invitación que genera el admin al crear un proyecto ([`ClientRegistrationPage.tsx`](src/components/auth/ClientRegistrationPage.tsx)).

- **Equipo / Admin** → no hay botón en la app para esto. Se crea **a mano en Supabase** → Table Editor → tabla `users`, escribiendo `role` (`team` o `admin`) y `department`.

Con base en ese `role`, [`App.tsx`](src/App.tsx) decide qué dashboard mostrar.

## 5. Mapa de carpetas (lo importante)

```
src/
  lib/supabase.ts            → cliente único de Supabase
  contexts/
    AuthContext.tsx           → sesión y rol del usuario
    WorkSessionContext.tsx     → checador de entrada/salida del equipo
  components/
    auth/        → login, registro de clientes por invitación, cambio de contraseña
    admin/       → vista del admin: proyectos, tareas, equipo, clientes, reportes
    team/        → vista del equipo: "Mis tareas", calendario, hoja de ruta
    client/      → portal del cliente: avance de su proyecto, comentarios, solicitudes
    chat/        → chat interno del equipo y chats por cliente (tiempo real)
    shared/      → piezas reutilizables: navbar, campana de notificaciones, modales
  types/index.ts              → forma de los datos (Task, User, Client, etc.) — útil para saber qué campos tiene cada cosa
```

## 6. Las funciones/flujos más importantes

**Flujo de una tarea** (todo en [`TaskDetailModal.tsx`](src/components/team/TaskDetailModal.tsx)):
1. Equipo trabaja la tarea → agrega links (opcional) → "Solicitar revisión"
2. Revisor aprueba → pasa a Trafficker, o pide retrabajo
3. Trafficker/Admin autoriza → el cliente ya la puede ver
4. Admin puede "Reactivar" una tarea en cualquier punto si algo salió mal

**Notificaciones**: cada acción importante (revisión solicitada, mensaje de chat, cambios pedidos por cliente, etc.) inserta una fila en la tabla `notifications`. [`NotificationBell.tsx`](src/components/shared/NotificationBell.tsx) las escucha en tiempo real con `supabase.channel(...)` y las muestra en la campanita del navbar.

**Chat**: [`TeamChat.tsx`](src/components/chat/TeamChat.tsx) (equipo) y [`ClientChatRoom.tsx`](src/components/chat/ClientChatRoom.tsx)/[`ClientChatsHub.tsx`](src/components/chat/ClientChatsHub.tsx) (por cliente). Los mensajes se guardan en `chat_messages` y se reciben en vivo por canal de Supabase; al mandar un mensaje se notifica a los demás miembros.

**Login con Google**: botón en [`LoginPage.tsx`](src/components/auth/LoginPage.tsx) llama a `supabase.auth.signInWithOAuth({ provider: 'google' })`. Está configurado en tres lugares externos (si algún día deja de funcionar, revisa ahí primero):
- Google Cloud Console → proyecto "Clienes Ads Sinertegia" → Auth Platform → Clientes → "Sinertegia Login"
- Supabase → Authentication → Providers → Google (switch debe estar **activado**)
- El "Callback URL" de Supabase debe coincidir con el "URI de redireccionamiento autorizado" en Google Cloud

## 7. Cómo subir cambios a producción (en tiempo real)

1. Edita el código aquí, pruébalo con `npm run dev`
2. Sube los cambios a GitHub:
   ```bash
   git add -A
   git commit -m "Describe qué cambiaste"
   git push origin main
   ```
3. Vercel detecta el push automáticamente y publica solo (1-2 minutos). Lo puedes ver en **vercel.com → tu proyecto → Deployments**, esperando que diga **Ready**.

No hace falta tocar nada en Vercel para esto — la conexión GitHub↔Vercel ya quedó hecha.

## 8. Bitácora de cambios

- **Modal de entrega simplificado**: el flujo principal ahora prioriza fecha, entregables, revisor y el botón “Enviar a revisión”. Dependencias, subtareas y tiempo trabajado se agruparon bajo “Opciones adicionales”; comentarios se muestran en una sección desplegable con contador. El indicador de tres pasos se reemplazó por una línea compacta, se eliminó el botón “Cerrar” duplicado y el nombre del link pasó a ser opcional (se genera desde el dominio). La advertencia de entregable obligatorio aparece solo cuando se intenta enviar sin adjuntar nada.
- **“Por autorizar” abre la tarea exacta**: al pulsar la fila “Por autorizar” de la bandeja “Requiere atención”, ya no se abre la vista general del proyecto. Se abre directamente el modal de la tarea pendiente correspondiente, con un aviso azul que repite el nombre exacto y señala “Tarea que debes autorizar”. El botón “Ir a la decisión” desplaza al administrador hacia la sección de autorización o solicitud de cambios, que también queda resaltada.
- **Reloj limitado al turno diario**: se corrigió la recuperación que podía mostrar más de 24 horas al tomar una sesión abierta del día anterior. El reloj solo recupera sesiones iniciadas en la fecha local actual y usa `work_start`/`work_end` de cada integrante (con 9:00–18:00 como respaldo). Las sesiones antiguas que hayan quedado abiertas se cierran automáticamente a la hora de salida configurada. Si el error previo creó varias entradas del mismo día, se conserva la primera para respetar la hora real de inicio y al marcar salida se cierran todos los duplicados del día.
- **Bandeja “Requiere atención” simplificada**: las categorías con contador `0` ahora se ocultan automáticamente, por lo que la tarjeta solo muestra pendientes reales y reduce su altura según el contenido. Si autorizaciones, vencimientos y cambios están todos en cero, se muestra un único estado compacto “Todo al día”. La lógica de las tres categorías se conserva; únicamente cambia su presentación.
- **Corrección del reloj al refrescar**: `WorkSessionContext.tsx` ahora recupera la sesión laboral abierta más reciente usando `ended_at IS NULL`, sin depender de una fecha UTC ni fallar si quedaron varias filas abiertas. El contador se reconstruye desde `started_at`, por lo que conserva el tiempo trabajado después de refrescar. Antes de crear una entrada nueva, `checkIn()` vuelve a buscar una sesión abierta para evitar duplicados. Las fechas nuevas se guardan con la fecha local del dispositivo y un fallo temporal de Supabase ya no abre erróneamente el modal de entrada.
- **Panel principal más visual y accionable**: la vista inicial del administrador ahora incluye un “Resumen ejecutivo” con proyectos activos, tareas abiertas, tareas terminadas en los últimos 7 días y personas activas. Se añadió un indicador de salud operativa calculado según proyectos activos sin tareas vencidas, y una bandeja permanente “Requiere atención” para autorizaciones, tareas fuera de fecha y cambios solicitados por clientes. Las tarjetas navegan a las vistas ya existentes y muestran estados vacíos claros cuando todo está al día. El diseño se adapta a tablet y móvil.
- **Optimización de carga sin eliminar funciones**: los dashboards de Admin, Equipo y Cliente ahora se cargan de forma diferida desde `App.tsx`. La animación WebGL de `FloatingLines` conserva todos sus efectos, pero Three.js se descarga solo al mostrar el login. La generación de reportes conserva `html2canvas` y `jsPDF`, pero esas librerías se descargan únicamente cuando el usuario pulsa “Generar PDF”. El paquete inicial de producción bajó de aproximadamente 2.2 MB a 430 KB; las funciones pesadas quedaron en módulos independientes. También se añadió `AppErrorBoundary.tsx`, que reemplaza una pantalla blanca por un mensaje recuperable con botón para recargar si ocurre un error no controlado.
- **Rediseño visual "V2" — ahora en Admin, Equipo y Cliente**: a partir de un mockup del usuario, se rediseñaron las 3 vistas (sidebar + topbar) con una estética más premium — tipografías nuevas (Space Grotesk para títulos, Inter para texto, JetBrains Mono para números, cargadas vía Google Fonts en [`index.html`](index.html)), sidebar oscura con marca/logo, tarjetas con barra de color lateral y barra de progreso animada. **Colores adaptados**: el mockup original usaba morado; aquí se adaptó a la paleta azul/rojo real de la marca (`--brand: #2757EB`).
  - Todo el CSS vive en un solo archivo compartido, [`src/styles/DashboardV2.css`](src/styles/DashboardV2.css), con **todas las clases prefijadas bajo `.v2app`** y nombres genéricos (`v2-sidebar`, `v2-topbar`, `v2-card`, `v2-stat-card`, `v2-table-wrap`, etc.) para que las 3 vistas lo reutilicen sin duplicar CSS. (Antes existía un `AdminDashboardV2.css` solo para Admin — se eliminó y se migró a este archivo compartido.)
  - **Admin** ([`AdminDashboard.tsx`](src/components/admin/AdminDashboard.tsx)): sidebar propia (ya no usa el `Sidebar.tsx` compartido) con los mismos ítems de siempre; la vista "Proyectos" tiene el rediseño completo (triage de autorizaciones/vencidas/cambios de cliente, tabs de estado, grid de tarjetas). Las demás pestañas de Admin no se tocaron por dentro, solo heredan el nuevo marco.
  - **Equipo** ("Mi espacio" en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx), rama no-embedded): mismo sidebar oscuro, ahora con **botón de colapsar** (clic en el logo) reimplementado a mano (ya no usa `Sidebar.tsx` en modo `collapsible`). Tarjetas de stats, gráficas y tabla de tareas reskineados con las clases `v2-stat-card`/`v2-surface`/`v2-table-wrap`, conservando toda su lógica (gráficas de recharts, filtros, etc.) intacta. La rama `embedded` (usada dentro de "Mis tareas" del Admin) **no se tocó**, sigue con su estilo simple de siempre.
  - **Cliente** ([`ClientPortal.tsx`](src/components/client/ClientPortal.tsx)): mismo sidebar oscuro con los ítems del portal. La función de "foto de portada" (la imagen que sube el cliente y se desvanece de fondo) se conservó, moviéndose para empezar después del ancho de la sidebar (`left: 248px` en vez de `left: 0`) y así no taparla.
  - Como las 3 vistas ahora traen su propio topbar con marca y acciones, se **eliminó el `<Navbar/>` global por completo** (ya no se usa para ningún rol) en [`App.tsx`](src/App.tsx) — cada dashboard reutiliza `TopBarActions.tsx` tal cual (buscador, timer del checador, notificaciones, avatar) dentro de su propio topbar nuevo.
  - Solo la vista "Proyectos" (`view === 'overview'`) tiene el rediseño completo (triage + tabs + tarjetas nuevas). El resto de las vistas de Admin (Capacidad del equipo, Calendario, Rendimiento, etc.) no se tocaron — simplemente ahora viven dentro de este nuevo marco de sidebar/topbar.
- **5 funciones nuevas en la tarea** ([`TaskDetailModal.tsx`](src/components/team/TaskDetailModal.tsx)), todas en el SQL [`sql/2026-07-15_subtareas_tiempo_dependencias_recordatorios.sql`](sql/2026-07-15_subtareas_tiempo_dependencias_recordatorios.sql):
  1. **Adjuntar archivos reales**: `uploadFile()` (antes `uploadHtmlFile()`) ya no restringe a `.html` — acepta cualquier archivo hasta 20MB (imágenes, PDF, Word, etc.), sube al mismo bucket `chat-files` bajo `task-deliverables/{task_id}/...`, y `fileIconFor()` elige el ícono según la extensión (imagen/PDF-Word/html/link).
  2. **Recordatorios automáticos de fecha próxima a vencer**: función de Postgres `notify_upcoming_deadlines()` que revisa tareas no completadas con `commitment_date` a 0-2 días, e inserta una notificación (`type: 'deadline'`, ya estaba permitido en el constraint) evitando duplicados si ya se avisó en las últimas 20 horas. Se programa con `pg_cron` para correr diario. **Antes de correr ese SQL, hay que activar la extensión `pg_cron`** en Supabase → Database → Extensions.
  3. **Subtareas / checklist**: tabla `task_subtasks` (título, completada, posición). Sección nueva en el modal con checkboxes, contador "(2/5)", agregar/borrar.
  4. **Tiempo trabajado por tarea**: tabla `task_time_entries` (inicio/fin/minutos). Cronómetro real en el modal — botón "Iniciar tiempo" / "Detener" con contador en vivo (mm:ss), guarda los minutos exactos al detener. Muestra el historial de quién le dedicó cuánto tiempo y cuándo.
  5. **Dependencias entre tareas**: columna `depends_on_task_id` en `tasks` (una tarea puede depender de otra del mismo proyecto). Selector "Depende de" en el modal; si la tarea de la que depende no está completada, aparece un aviso naranja de advertencia (no bloquea la acción, solo avisa).
- **Súper administrador + licencia de la app**: pensado para cuando esta misma app se vende/renta como copia independiente a otras agencias (cada quien con su propio Supabase). Se agregó una columna `is_super_admin` en `users` y una tabla de una sola fila `app_license` (`status`: `active`/`suspended`, plan, fecha de vencimiento, notas). En [`AuthContext.tsx`](src/contexts/AuthContext.tsx), al iniciar sesión se revisa `app_license` — si está `suspended`, **nadie puede entrar excepto quien tenga `is_super_admin = true`**, con mensaje claro en el login. El súper admin ve un ítem extra "Licencia" en su menú ([`LicenseManager.tsx`](src/components/admin/LicenseManager.tsx)) con un botón para suspender/reactivar toda la app, y campos para anotar plan/vencimiento/notas de esa renta.
  - **Para volverte súper admin la primera vez** (no hay UI para esto, a propósito, para no regalar el poder por accidente): en Supabase → Table Editor → tabla `users` → busca tu fila → pon `is_super_admin` en `true`.
  - SQL a correr una vez: [`sql/2026-07-14_super_admin_license_permisos.sql`](sql/2026-07-14_super_admin_license_permisos.sql), y después [`sql/2026-07-14b_license_campos_extra.sql`](sql/2026-07-14b_license_campos_extra.sql) (agrega nombre del cliente, fecha de inicio y mensualidad, y renombra `plan_name` → `client_name`).
  - El panel "Licencia" ([`LicenseManager.tsx`](src/components/admin/LicenseManager.tsx)) se rediseñó con: tarjeta grande de estado (APP ACTIVA/SUSPENDIDA + días restantes calculados con `daysUntil()`), tarjeta de mensualidad, formulario de nombre del cliente/fechas/monto/notas, y 4 botones de "Extensión rápida" (+1 mes, +3 meses, +6 meses, +1 año) que mueven la fecha de vencimiento desde hoy si ya venció, o desde la fecha actual de vencimiento si todavía no vence.
  - Se agregó columna `payment_link` a `app_license` para guardar el link de cobro mensual (ej. un link de pago de Mercado Pago o Stripe) — aparece en la tarjeta de "Mensualidad" con botón de copiar, y es editable en el formulario. El cobro sigue siendo manual: se manda el link cada mes, y al confirmar el pago se usa el botón de "Extensión rápida" correspondiente.
- **Permisos por rol (qué ve Equipo / qué ve Cliente)**: en **Admin → Permisos** ([`RolePermissionsManager.tsx`](src/components/admin/RolePermissionsManager.tsx)), casillas para prender/apagar cada sección del menú lateral de Equipo y de Cliente por separado (ej. ocultar "Rendimiento" o "Hoja de Ruta"). Se guarda en la tabla `role_permissions` (una fila por combinación rol+sección). `TeamDashboard.tsx` y `ClientPortal.tsx` leen esa tabla al cargar y filtran su propio menú (`TEAM_NAV_ITEMS`/`CLIENT_NAV_ITEMS`) según lo que esté permitido — si alguien tenía abierta una sección que le acaban de quitar, se le regresa a "Mis tareas" automáticamente. Los admins (y el súper admin) siempre ven todo, esto no los afecta.
- **Login**: se agregó botón "Iniciar sesión con Google" en [`LoginPage.tsx`](src/components/auth/LoginPage.tsx). Solo deja entrar correos que ya existen en la tabla `users` ([`AuthContext.tsx`](src/contexts/AuthContext.tsx)); si no, se rechaza con mensaje claro.

- **Tareas**: en [`TaskDetailModal.tsx`](src/components/team/TaskDetailModal.tsx) ya no es obligatorio tener un link para "Solicitar revisión".

- **Listas de tareas**: en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) y [`ProjectDetail.tsx`](src/components/admin/ProjectDetail.tsx), la pestaña "Todas" ya no muestra las completadas — solo aparecen en la pestaña "Completada".

- **Notificaciones de chat**: tanto el [chat de equipo](src/components/chat/TeamChat.tsx) como el [chat con clientes](src/components/chat/ClientChatRoom.tsx) ahora notifican a todos los participantes del chat cuando alguien escribe (antes solo notificaba si te @mencionaban).

- **Comentarios en tareas**: el modal de [`TaskDetailModal.tsx`](src/components/team/TaskDetailModal.tsx) ahora muestra los comentarios de la tarea y deja escribir uno nuevo sin salir de ahí. También se renombró la columna "Links" a "Entregables" en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) porque el navegador la traducía mal (Google Translate confundía "Links" con "campo de golf", un significado en inglés de esa palabra).

- **Notificaciones de chat no llegaban**: la tabla `notifications` en Supabase tiene una restricción (`notifications_type_check`) que solo permite ciertos valores en la columna `type`. Se intentó usar `'chat'`, que no estaba permitido (error 400, código Postgres `23514`). Se cambió a `'comment'`, que sí está permitido, en [`TeamChat.tsx`](src/components/chat/TeamChat.tsx) y [`ClientChatRoom.tsx`](src/components/chat/ClientChatRoom.tsx). **Si agregas un nuevo tipo de notificación en el futuro y no llega, revisa primero esa restricción en Supabase** (Table Editor → `notifications` → o con SQL: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'notifications_type_check'`).

- **Borrar mensajes de chat** (estilo WhatsApp/Instagram): se agregó la columna `deleted_for uuid[]` a la tabla `chat_messages` en Supabase. En [`TeamChat.tsx`](src/components/chat/TeamChat.tsx) y [`ClientChatRoom.tsx`](src/components/chat/ClientChatRoom.tsx), cada mensaje tiene un menú (⋮ al pasar el mouse) con "Borrar para mí" (solo se oculta para quien lo borra, guardando su id en `deleted_for`) y "Borrar para todos" (solo en tus propios mensajes; **elimina la fila por completo** de `chat_messages`, así que desaparece para todos al instante).

- **Tiempo real no se actualizaba solo** (había que recargar la página para ver borrados/cambios de otros): se corrió `alter table chat_messages replica identity full;` en Supabase. Sin esto, los eventos de `UPDATE`/`DELETE` no incluían suficiente información de la fila para que el filtro `room_id=eq.X` del canal de tiempo real los detectara — por eso solo los `INSERT` (mensajes nuevos) llegaban en vivo. **Si agregas tiempo real a otra tabla en el futuro y los cambios no llegan a los demás usuarios sin recargar, revisa primero si esa tabla tiene `replica identity full`.**
- **Notificación de chat ahora navega al chat**: al hacer clic en una notificación de mensaje de chat (sin `task_id`), [`NotificationBell.tsx`](src/components/shared/NotificationBell.tsx) revisa el texto del título y dispara un evento `open-chat` con `{ room: 'team' | 'client' }`. [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx), [`AdminDashboard.tsx`](src/components/admin/AdminDashboard.tsx) y [`ClientPortal.tsx`](src/components/client/ClientPortal.tsx) escuchan ese evento y cambian a la pestaña de chat correspondiente (mismo patrón que ya existía para `open-task`).

- **Navegación: menú lateral en vez de pestañas arriba**: se creó [`Sidebar.tsx`](src/components/shared/Sidebar.tsx), un componente compartido que reemplazó la barra de pestañas horizontal en las 3 vistas (`TeamDashboard.tsx`, `AdminDashboard.tsx`, `ClientPortal.tsx`). Cada dashboard sigue dueño de su propio estado de "pestaña activa" — solo cambió cómo se renderiza. `TeamDashboard` ahora acepta un prop `embedded` (usado por `AdminDashboard` en su pestaña "Mis tareas") para mostrar la barra de tabs vieja en vez de un sidebar anidado dentro de otro. También se rediseñaron las tarjetas de stats y los iconos de la tabla de tareas en `TeamDashboard.tsx` para que coincidan con el nuevo estilo visual.

- **Crear embudos (tipos de proyecto) nuevos desde la app**: antes solo existían VSL y Webinar, "quemados" en [`src/data/projectTemplates.ts`](src/data/projectTemplates.ts). Ahora, en el paso 1 de "Nuevo proyecto" ([`CreateProjectModal.tsx`](src/components/admin/CreateProjectModal.tsx)), hay un botón **"Crear embudo nuevo"** que abre [`CreateFunnelTemplateModal.tsx`](src/components/admin/CreateFunnelTemplateModal.tsx): ahí pones nombre, ícono y la lista de tareas (título + departamento + prioridad) del embudo. Se guarda en una tabla nueva de Supabase, **`project_templates`** (id, name, icon, description), y sus tareas en la tabla `template_tasks` que ya existía (la misma que usa el checkbox "Guardar en plantilla" al crear una tarea suelta). El embudo nuevo aparece de inmediato junto a VSL y Webinar para elegirlo en cualquier proyecto futuro.
  - Si alguna vez quieres recrear la base de datos desde cero, no olvides correr: `create table if not exists project_templates (id text primary key, name text not null, icon text not null default '🗂️', description text, created_at timestamptz not null default now());`
- **Comentarios y notificaciones del "encargado" de la tarea**: 3 correcciones relacionadas con el flujo de "Selecciona las tareas" (paso 2 de crear proyecto):
  1. La nota que se escribe con el ícono 💬 al armar la plantilla ya no se guarda como `description` de la tarea — ahora se inserta como un comentario real en `task_comments` (mismo lugar donde viven los comentarios normales de [`TaskDetailModal.tsx`](src/components/team/TaskDetailModal.tsx)), para que aparezca en la sección "Comentarios" de la tarea cuando el equipo la abre. Esto pasa en `CreateProjectModal.tsx` → `handleCreate`, insertando primero las tareas (con `.select('id')` para recuperar sus IDs) y luego los comentarios ligados a esos IDs.
  2. Se corrigió el encabezado de columna "Com." (se veía como una falta de ortografía) → ahora dice "Comentarios" completo, en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx).
  3. `sendComment()` en `TaskDetailModal.tsx` ahora notifica al **creador de la tarea** (`task.created_by` — quien la asignó, ej. Tony) cada vez que alguien más comenta, con `type: 'comment'` y `task_id` (para que el clic en la notificación abra la tarea directo, reusando el mismo patrón de `open-task` que ya existía).
  4. **Bug corregido**: el contador de comentarios en la columna "Comentarios" de la tabla no se actualizaba después de mandar un comentario (se quedaba en 0 hasta cerrar y reabrir la tarea), porque `sendComment()` nunca llamaba a `onUpdate()`. Ya se agregó esa llamada al final de la función.
  5. **Bug corregido — pantalla en blanco al borrar/editar (causa raíz encontrada, no era el código)**: el error real, visto en la consola del navegador, era `Uncaught NotFoundError: Failed to execute 'removeChild' on 'Node'` — esto es un choque conocido entre React y el traductor de Google Chrome: el traductor mete sus propias etiquetas dentro del DOM, y cuando React necesita actualizar esa misma parte de la página (como al borrar un comentario), ambos pelean por el mismo nodo y la app entera se cae en blanco sin aviso. Es la misma causa raíz de otro bug antiguo de esta bitácora ("Links" traducido como "campo de golf") — parchar palabra por palabra nunca iba a arreglarlo del todo. La solución de raíz está en [`index.html`](index.html): se corrigió `lang="en"` → `lang="es"` (el idioma mal declarado era lo que hacía que Chrome ofreciera traducir un sitio que ya está en español) y se agregó `translate="no"` + `<meta name="google" content="notranslate">` + clase `notranslate` en el `<div id="root">`, para que Chrome nunca vuelva a ofrecer traducir esta app.
  6. **La columna "Comentarios" ahora muestra el texto, no solo un número**: en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx), `fetchTasks()` ya no pide `task_comments(count)` sino `task_comments(content, created_at)` — con eso, la tabla muestra el texto del comentario más reciente (truncado, con el texto completo al pasar el cursor) en vez de solo un número. Si hay más de un comentario, se ve una burbuja "+N" al final indicando cuántos más hay; para leerlos todos hay que abrir la tarea.
  7. **Marcar como leída / eliminar notificaciones**: en [`NotificationBell.tsx`](src/components/shared/NotificationBell.tsx), cada notificación en la lista muestra (al pasar el cursor) un ✓ para marcarla como leída sin navegar a la tarea/chat, y una ✕ para eliminarla por completo (`delete` en la tabla `notifications`). Como este componente ya es compartido entre las 3 vistas (admin, equipo y cliente vía `TopBarActions.tsx`), la función queda disponible para todos los roles automáticamente, sin tocar nada más.
  8. **Pestañas "Todas / No leídas" en notificaciones**: al estilo Facebook, arriba de la lista de `NotificationBell.tsx` hay dos botones para filtrar (`filter` state) — "No leídas" muestra el contador entre paréntesis. Es solo un filtro visual del `useState` de notificaciones ya cargadas, no pega otra vez a la base de datos.
  9. **Editar y borrar comentarios**: en `TaskDetailModal.tsx`, cada comentario (bajo hover) muestra íconos de lápiz/basura solo si el usuario actual es el autor del comentario o es admin. Editar deja el texto in-line con Guardar/Cancelar; borrar lo elimina de `task_comments` directo (sin confirmación, ya que es una acción de un solo clic sobre contenido propio).
- **Agregar y quitar personas del equipo desde la app**: antes solo se podía crear/borrar cuentas de equipo a mano en Supabase (ver sección 4.1). Ahora:
  - **Agregar**: en **Admin → Rendimiento**, botón "Agregar integrante" ([`TeamPerformance.tsx`](src/components/admin/TeamPerformance.tsx)) — llenas correo, nombre (opcional), rol (equipo/admin) y departamento, se genera un link de invitación (tabla nueva `team_invitations`) que copias y le mandas a esa persona por WhatsApp/correo — igual que ya funciona la invitación de clientes. Al abrir el link llega a [`TeamRegistrationPage.tsx`](src/components/auth/TeamRegistrationPage.tsx) (nuevo, mismo patrón que `ClientRegistrationPage.tsx`), pone su nombre y contraseña, y su cuenta se crea con el rol/departamento que ya quedó fijado en la invitación. **No hay envío de correo real** — es un link que tú compartes, igual que las invitaciones de cliente.
  - **Quitar**: en **Admin → Capacidad del equipo** ([`TeamCapacity.tsx`](src/components/admin/TeamCapacity.tsx)), botón "Eliminar del equipo" por persona. Si tiene tareas pendientes (no completadas), primero pide elegir a quién reasignárselas antes de continuar; si no tiene pendientes, pide confirmación directa. **No se borra la fila de la base de datos** (eso rompería FKs de tareas/comentarios/chats viejos que ya tiene esa persona) — se le pone `active = false` en la tabla `users`, lo que le revoca el acceso de inmediato (`AuthContext.tsx` la rechaza al iniciar sesión, mismo mecanismo que ya existía para cuentas de Google no registradas) pero conserva su nombre en todo el historial. Las cuentas desactivadas ya no aparecen en ningún selector de "asignar a" (`AdminDashboard.tsx` filtra `teamMembers` con `.eq('active', true)`).
  - **SQL nuevo que hay que correr una sola vez**: ver [`sql/2026-07-13_team_management.sql`](sql/2026-07-13_team_management.sql) — agrega la columna `active` a `users` y crea la tabla `team_invitations` con sus políticas RLS.
  - Reactivar a alguien que se desactivó por error todavía no tiene botón en la app — por ahora hay que poner `active = true` a mano en Supabase Table Editor.
- **Entregable obligatorio de nuevo + subir archivos .html**: se revirtió el cambio anterior de "recordatorio pero no obligatorio" — ahora en [`TaskDetailModal.tsx`](src/components/team/TaskDetailModal.tsx) los botones "Solicitar revisión" (equipo) y "Marcar como completada" (líder/admin) están **deshabilitados** mientras `links.length === 0`, con el mensaje en rojo "Es obligatorio añadir al menos un link o archivo del entregable". Además de pegar un link, ahora hay un botón "Subir archivo .html" que usa el bucket de Storage `chat-files` (el mismo que ya usa el chat para fotos, solo con la carpeta `task-deliverables/{task_id}/...`) — sirve para subir directo archivos `.html` como los que exporta un Artifact de Claude, sin necesitar que estén publicados en una URL primero. El archivo subido se guarda como una fila normal de `task_links` (mismo lugar que los links), con un ícono distinto (`FileCode`) para diferenciarlo visualmente de un link externo.
- **Hoja de Ruta: filtrar por estado con la leyenda**: en [`RoadmapView.tsx`](src/components/roadmap/RoadmapView.tsx) (componente compartido usado en las 3 vistas: `TeamDashboard.tsx`, `AdminDashboard.tsx`, `ClientPortal.tsx`), la leyenda de arriba (Pendiente/En progreso/Completada/Bloqueada/1 cambio/2 cambios) ahora son botones clicables — dar clic en uno filtra la hoja de ruta a solo esas tareas (clic de nuevo para quitar el filtro, o el botón "✕ Quitar filtro"). Se combina con los filtros existentes de cliente y rango de fechas.
- **Editar/eliminar/comentar tareas antes de crear el proyecto**: en el paso 2 ("Selecciona las tareas") de [`CreateProjectModal.tsx`](src/components/admin/CreateProjectModal.tsx), cada tarea de la plantilla tiene un menú ⋮ con "Editar tarea" (cambia el título in-line) y "Eliminar" (la quita de la lista por completo, no solo la desmarca — usa el mismo truco de remapeo de índices que ya existía para el drag&drop, en `deleteTaskRow`). También hay un ícono de comentario 💬 que guarda una nota en `CombinedTask.note`, la cual se manda como `description` de la tarea al crearla.
- **Asignación individual por tarea**: además del selector de persona por grupo (que sigue funcionando igual, con hasta 2 personas vía "+ persona", excepto en el grupo "Cliente" que solo permite una), cada tarea individual tiene su propio mini-selector "👤 Individual..." para asignarla a cualquier persona del equipo. Si alguna tarea del grupo tiene asignación individual, el selector de grupo de esa sección se reemplaza por un aviso "Asignación individual activa" y se bloquea, para no mezclar ambas formas de asignar.
- **Calendario del equipo (admin) → filtrar por cliente y generar PDF**: en [`TeamCalendar.tsx`](src/components/admin/TeamCalendar.tsx), la leyenda de clientes ahora son botones — al hacer clic en uno, las tareas de los demás clientes se atenúan (`opacity-10`) y las personas sin tareas de ese cliente también se atenúan, para encontrar más fácil sus tareas en el calendario. Con un cliente seleccionado aparece un botón **"Generar PDF de [cliente]"**.
  - El PDF tiene un diseño de marca (logo, tarjetas KPI, barra de progreso, carga por responsable, tarjetas de tarea con avatar/prioridad/fecha) — se construyó en [`src/lib/clientReportPdf.ts`](src/lib/clientReportPdf.ts) como una plantilla HTML con estilos en línea, basada en un diseño que el usuario ya tenía hecho en Python/Playwright. **Cómo funciona (importante si hay que tocarlo después):** no se usa un navegador en el servidor (esta app no tiene backend con Chromium) — en vez de eso, se inyecta ese HTML oculto en la página con `html2canvas` (nueva dependencia), se "fotografía" como imagen de alta resolución, y esa imagen se corta en páginas tamaño A4 dentro de un PDF con `jspdf`. Por eso el texto del PDF resultante no es seleccionable/copiable, es una imagen — visualmente idéntico, pero no es PDF "de texto". Si se necesita texto seleccionable de verdad, habría que mover esto a una función serverless con un navegador headless (Puppeteer/Playwright en Vercel), que es mucho más complejo de mantener.
- **Designar administradores**: en **Admin → Capacidad del equipo** ([`TeamCapacity.tsx`](src/components/admin/TeamCapacity.tsx)), cada tarjeta de persona (que no sea ya admin) tiene un botón "Hacer administrador" con una confirmación inline — actualiza `role: 'admin'` en la tabla `users`. Antes esto solo se podía hacer a mano desde el Table Editor de Supabase (ver sección 4.1).

### Rediseño de Carga del equipo

- La navegación y la pantalla antes llamadas **Capacidad del equipo** ahora se llaman **Carga del equipo**.
- Se agregó un resumen semanal con personas disponibles, carga equilibrada, sobrecarga y total de tareas vencidas.
- La vista permite buscar integrantes y filtrar por departamento o estado de carga.
- Las tarjetas ahora muestran foto de perfil, departamento, carga estimada, tareas activas, próximas y vencidas. Las acciones de cuenta se concentran exclusivamente en **Usuarios y permisos**, evitando duplicarlas en esta vista operativa.
- Mientras las tareas no tengan un campo de horas estimadas, el porcentaje es orientativo y se calcula con tareas activas, prioridad, vencimientos y compromisos de los próximos siete días. No se muestran horas inventadas.
- El diseño incluye estilos específicos para temas claro y oscuro y acomodo responsivo para pantallas pequeñas.

### Navegación desde notificaciones de tareas

- Las notificaciones creadas al asignar una tarea guardan el `task_id` correspondiente.
- Al pulsar una notificación de tarea, la aplicación abre **Mis tareas**, limpia los filtros que podrían ocultarla, desplaza la tabla hasta su fila, la resalta como **Tarea asignada** y abre automáticamente su detalle.
- Las notificaciones antiguas que no tienen `task_id` intentan localizar la tarea por el título incluido entre comillas en el mensaje.
- **Ortografía/etiquetas**: se corrigió "F. Entrega" → "Fecha de entrega" en la tabla de tareas de [`ProjectDetail.tsx`](src/components/admin/ProjectDetail.tsx) (la de `TeamDashboard.tsx` ya se había corregido antes).
- **"Mi espacio" (equipo): sidebar oscuro colapsable + gráficas**: se agregó la librería `recharts` para 2 gráficas nuevas (progreso semanal acumulado por día, y dona de tareas por prioridad) y un panel de "Próximas entregas", visibles solo cuando `TeamDashboard` NO está `embedded`. El sidebar de esta vista ahora es oscuro y se puede colapsar (el logo solo se ve expandido) — esto se hizo extendiendo [`Sidebar.tsx`](src/components/shared/Sidebar.tsx) con props opcionales `collapsible`, `brand`, `theme`, `tip` (Admin y Cliente no las usan, siguen igual que antes). Para que el buscador/notificaciones/avatar no salieran duplicados (uno en el `Navbar` global, otro en el nuevo header de "Mi espacio"), se extrajo toda esa lógica a [`TopBarActions.tsx`](src/components/shared/TopBarActions.tsx), reusado por `Navbar.tsx` (admin/cliente) y por `TeamDashboard.tsx` directamente. `App.tsx` ya no renderiza el `<Navbar/>` global cuando `user.role === 'team'`, porque esa vista ahora trae su propio header equivalente.
  - El gráfico de progreso usa el campo `completion_date` de `tasks` (ya se llena solo al autorizar una tarea) agrupado por día de la semana; si algún día parece "vacío", es porque no hay tareas con ese campo lleno todavía, no es un bug.
  - Se omitieron a propósito (igual que la vez pasada): botón "Filtros", toggle de cuadrícula/lista, menú de 3 puntos por tarea, y mini-sparklines en las tarjetas — no tenían una acción definida.
- **Filtro por cliente en la tabla de "Mis tareas"**: el encabezado "Cliente" en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) ahora es un botón con flecha (▾) que despliega la lista de clientes (sacada de las tareas que ya tiene cargadas) + "Todos los clientes". Se combina con los filtros de estatus que ya existían (Todas/Pendiente/En progreso/Completada).
- **Filtro por prioridad en la tabla**: igual que el de "Cliente", el encabezado "Prioridad" en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) ahora despliega Crítica/Alta/Media/Baja + "Todas". Ambos menús (Cliente y Prioridad) usan `position: fixed` con la posición calculada desde `getBoundingClientRect()` del botón — si solo usaran `position: absolute` quedarían atrapados dentro del scroll horizontal de la tabla y se verían cortados/feos (así fue el primer intento, por eso quedó documentado aquí).
- **Animación de fondo en el login**: se agregó [`FloatingLines.tsx`](src/components/auth/FloatingLines.tsx) (líneas animadas con WebGL, usando la librería `three`) como fondo de [`LoginPage.tsx`](src/components/auth/LoginPage.tsx) únicamente — no se usa en ninguna otra pantalla. Usa el prop `linesGradient` (array de colores hex) para pintar las líneas con los colores de la marca. **Nota de rendimiento**: `three` agrega ~600 KB al bundle de JavaScript; como no hay separación de código por ruta en este proyecto, ese peso se descarga incluso después de iniciar sesión. Si en algún momento el sitio se siente lento al cargar, este es el primer lugar a revisar.
- **Nueva pantalla inicial "Mi día" para equipo**: [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) abre ahora en una vista diaria enfocada, separada de la tabla completa de "Mis tareas". Muestra la tarea para continuar, indicadores reales de hoy/en progreso/vencidas/en revisión/completadas esta semana, asuntos que requieren atención, próximas entregas y tres tareas prioritarias. Todos los nombres, clientes, fechas y contadores salen de los datos del usuario; no hay personas ni empresas escritas de forma fija. Cada elemento abre exactamente la tarea correspondiente. Las solicitudes enviadas desde el portal del cliente no aparecen aquí directamente: continúan pasando primero por la autorización del administrador de la organización y solo se muestran al equipo cuando ya existen como tareas asignadas.
- **Mejoras operativas del espacio Team**: la tabla de [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) incluye ahora una columna dinámica "Próxima acción" (agregar fecha, empezar, adjuntar entregable, enviar a revisión o corregir cambios); "Empezar" cambia realmente la tarea a `en_progreso` y el listado se ordena por vencimiento/urgencia. El menú lateral reemplaza el consejo estático por un resumen del día y el botón se renombró a "Solicitar tarea". [`TeamCalendarView.tsx`](src/components/team/TeamCalendarView.tsx) avisa cuántas tareas carecen de fecha y las muestra en una bandeja desde la que se abre su detalle; las tareas del calendario también abren directamente el modal. [`RoadmapView.tsx`](src/components/roadmap/RoadmapView.tsx) oculta completadas inicialmente, ofrece el control para mostrarlas, separa las tareas sin fecha y permite abrirlas. [`TeamChat.tsx`](src/components/chat/TeamChat.tsx) añadió búsqueda y separadores por fecha; [`ClientChatsHub.tsx`](src/components/chat/ClientChatsHub.tsx) añadió búsqueda entre clientes asignados. [`ClientDeliverables.tsx`](src/components/admin/ClientDeliverables.tsx) incorporó búsqueda, filtros por estado, copiar enlace y renombró el panel lateral a "Seguimiento del cliente". Finalmente, el reloj de [`TopBarActions.tsx`](src/components/shared/TopBarActions.tsx) abre un resumen real de la jornada. No se añadieron botones simulados para reacciones, mensajes fijados o versiones de entregables porque esos datos todavía no tienen persistencia en la base.
- **Entregables ajustado al mockup aprobado**: [`ClientDeliverables.tsx`](src/components/admin/ClientDeliverables.tsx) dejó de presentar las tareas como lista de seguimiento y ahora funciona como biblioteca: Cliente → Proyecto → Entregables. Cada enlace o archivo adjunto ocupa una fila propia con nombre, proyecto, versión derivada del orden de archivos de la tarea, responsable, última actualización, estado y acciones de vista previa/copia. Si un dato no existe se muestra "Sin registrar"; no se inventan autores o fechas de carga. El panel lateral conserva las notas existentes pero se presenta como "Seguimiento del cliente".
- **Miniaturas reales en la biblioteca de entregables**: la primera columna de [`ClientDeliverables.tsx`](src/components/admin/ClientDeliverables.tsx) ya no utiliza un ícono genérico. Imágenes y videos muestran su propio contenido; páginas, HTML y PDF se intentan representar como una previsualización reducida; los formatos Office muestran una tarjeta identificable por extensión. Algunos sitios externos pueden impedir su carga dentro de un `iframe` mediante sus políticas de seguridad; en esos casos se conserva la tarjeta con el tipo de enlace y el botón para abrirlo.
- **Estados visuales y comentarios reales en Entregables**: los filtros de [`ClientDeliverables.tsx`](src/components/admin/ClientDeliverables.tsx) siguen ahora el mockup aprobado: Pendientes en naranja, En revisión en morado y Aprobados en verde. El panel "Seguimiento del cliente" dejó de usar notas locales y consulta `task_comments` junto con su autor; muestra únicamente comentarios cuyo autor tiene rol `client`, con tarea, fecha, texto y acceso directo mediante el evento `open-task`. El contador indica comentarios reales disponibles, no comentarios no leídos, porque todavía no existe una tabla o campo de lectura por usuario.
- **Chat del equipo igualado al mockup avanzado**: [`TeamChat.tsx`](src/components/chat/TeamChat.tsx) incorpora presencia en línea con Supabase Presence, avatares de participantes, búsqueda, separadores por fecha, respuestas con vista del mensaje original, reacciones persistentes, un mensaje fijado por sala, creación de tareas desde mensajes y vinculación con tareas activas. Los mensajes vinculados abren la tarea mediante `open-task`; las tareas creadas muestran la marca "Convertido en tarea". La persistencia de respuestas, fijados y reacciones depende de las columnas agregadas por [`sql/2026-08-04_team_chat_features.sql`](sql/2026-08-04_team_chat_features.sql): `reply_to_id`, `is_pinned` y `reactions`. La migración también reafirma `replica identity full` para que los cambios aparezcan en tiempo real.

- **Filtros reales y mensajes privados en el chat del equipo**: [`TeamChat.tsx`](src/components/chat/TeamChat.tsx) ofrece filtros funcionales para Todos, Menciones, Archivos, Tareas y Fijados, combinables con la búsqueda. [`TeamMessagingHub.tsx`](src/components/chat/TeamMessagingHub.tsx) divide la sección en General y Mensajes directos tanto para Team como para Administradores. [`DirectMessages.tsx`](src/components/chat/DirectMessages.tsx) permite elegir un integrante, mantener una conversación privada en tiempo real y enviarle notificaciones. La privacidad se implementa mediante las tablas y políticas RLS de [`sql/2026-08-04_direct_messages.sql`](sql/2026-08-04_direct_messages.sql): solo los dos participantes pueden leer o crear mensajes dentro de su conversación.
# Control administrativo de tareas del equipo (7 de agosto de 2026)

- Se agregÃ³ el apartado administrativo **Tareas del equipo**, separado de Carga del equipo y Mis tareas.
- Permite seleccionar a un integrante o consultar a todo el equipo, buscar tareas y filtrar por estado.
- El administrador puede abrir el detalle, marcar una tarea como completada directamente o eliminarla con confirmaciÃ³n.
- La tabla muestra el comentario mÃ¡s reciente de cada tarea, su autor y la cantidad total; al pulsarlo se abre la conversaciÃ³n completa.
- La vista administrativa **Mis tareas** ahora coincide con el panel del equipo: incluye estadÃ­sticas, progreso, prioridades, prÃ³ximas entregas y tabla, sin repetir calendario, hoja de ruta, chats o entregables dentro de la pÃ¡gina.
- Las acciones sensibles se validan en Supabase mediante las funciones `admin_complete_team_task` y `admin_delete_team_task` del archivo `sql/2026-08-07_admin_team_task_controls.sql`.
- El nuevo apartado cuenta con permiso individual `team_tasks` para administradores delegados; el superadministrador conserva acceso total.
- El historial de **Solicitudes** conserva y muestra las aprobadas, reconoce estados antiguos equivalentes y verifica que Supabase guarde cada aprobaciÃ³n o rechazo antes de mostrarlo como exitoso.
