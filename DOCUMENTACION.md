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
- **Calendario del equipo (admin) → filtrar por cliente y generar PDF**: en [`TeamCalendar.tsx`](src/components/admin/TeamCalendar.tsx), la leyenda de clientes ahora son botones — al hacer clic en uno, las tareas de los demás clientes se atenúan (`opacity-10`) y las personas sin tareas de ese cliente también se atenúan, para encontrar más fácil sus tareas en el calendario. Con un cliente seleccionado aparece un botón **"Generar PDF de [cliente]"**.
  - El PDF tiene un diseño de marca (logo, tarjetas KPI, barra de progreso, carga por responsable, tarjetas de tarea con avatar/prioridad/fecha) — se construyó en [`src/lib/clientReportPdf.ts`](src/lib/clientReportPdf.ts) como una plantilla HTML con estilos en línea, basada en un diseño que el usuario ya tenía hecho en Python/Playwright. **Cómo funciona (importante si hay que tocarlo después):** no se usa un navegador en el servidor (esta app no tiene backend con Chromium) — en vez de eso, se inyecta ese HTML oculto en la página con `html2canvas` (nueva dependencia), se "fotografía" como imagen de alta resolución, y esa imagen se corta en páginas tamaño A4 dentro de un PDF con `jspdf`. Por eso el texto del PDF resultante no es seleccionable/copiable, es una imagen — visualmente idéntico, pero no es PDF "de texto". Si se necesita texto seleccionable de verdad, habría que mover esto a una función serverless con un navegador headless (Puppeteer/Playwright en Vercel), que es mucho más complejo de mantener.
- **Designar administradores**: en **Admin → Capacidad del equipo** ([`TeamCapacity.tsx`](src/components/admin/TeamCapacity.tsx)), cada tarjeta de persona (que no sea ya admin) tiene un botón "Hacer administrador" con una confirmación inline — actualiza `role: 'admin'` en la tabla `users`. Antes esto solo se podía hacer a mano desde el Table Editor de Supabase (ver sección 4.1).
- **Ortografía/etiquetas**: se corrigió "F. Entrega" → "Fecha de entrega" en la tabla de tareas de [`ProjectDetail.tsx`](src/components/admin/ProjectDetail.tsx) (la de `TeamDashboard.tsx` ya se había corregido antes).
- **"Mi espacio" (equipo): sidebar oscuro colapsable + gráficas**: se agregó la librería `recharts` para 2 gráficas nuevas (progreso semanal acumulado por día, y dona de tareas por prioridad) y un panel de "Próximas entregas", visibles solo cuando `TeamDashboard` NO está `embedded`. El sidebar de esta vista ahora es oscuro y se puede colapsar (el logo solo se ve expandido) — esto se hizo extendiendo [`Sidebar.tsx`](src/components/shared/Sidebar.tsx) con props opcionales `collapsible`, `brand`, `theme`, `tip` (Admin y Cliente no las usan, siguen igual que antes). Para que el buscador/notificaciones/avatar no salieran duplicados (uno en el `Navbar` global, otro en el nuevo header de "Mi espacio"), se extrajo toda esa lógica a [`TopBarActions.tsx`](src/components/shared/TopBarActions.tsx), reusado por `Navbar.tsx` (admin/cliente) y por `TeamDashboard.tsx` directamente. `App.tsx` ya no renderiza el `<Navbar/>` global cuando `user.role === 'team'`, porque esa vista ahora trae su propio header equivalente.
  - El gráfico de progreso usa el campo `completion_date` de `tasks` (ya se llena solo al autorizar una tarea) agrupado por día de la semana; si algún día parece "vacío", es porque no hay tareas con ese campo lleno todavía, no es un bug.
  - Se omitieron a propósito (igual que la vez pasada): botón "Filtros", toggle de cuadrícula/lista, menú de 3 puntos por tarea, y mini-sparklines en las tarjetas — no tenían una acción definida.
- **Filtro por cliente en la tabla de "Mis tareas"**: el encabezado "Cliente" en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) ahora es un botón con flecha (▾) que despliega la lista de clientes (sacada de las tareas que ya tiene cargadas) + "Todos los clientes". Se combina con los filtros de estatus que ya existían (Todas/Pendiente/En progreso/Completada).
- **Filtro por prioridad en la tabla**: igual que el de "Cliente", el encabezado "Prioridad" en [`TeamDashboard.tsx`](src/components/team/TeamDashboard.tsx) ahora despliega Crítica/Alta/Media/Baja + "Todas". Ambos menús (Cliente y Prioridad) usan `position: fixed` con la posición calculada desde `getBoundingClientRect()` del botón — si solo usaran `position: absolute` quedarían atrapados dentro del scroll horizontal de la tabla y se verían cortados/feos (así fue el primer intento, por eso quedó documentado aquí).
- **Animación de fondo en el login**: se agregó [`FloatingLines.tsx`](src/components/auth/FloatingLines.tsx) (líneas animadas con WebGL, usando la librería `three`) como fondo de [`LoginPage.tsx`](src/components/auth/LoginPage.tsx) únicamente — no se usa en ninguna otra pantalla. Usa el prop `linesGradient` (array de colores hex) para pintar las líneas con los colores de la marca. **Nota de rendimiento**: `three` agrega ~600 KB al bundle de JavaScript; como no hay separación de código por ruta en este proyecto, ese peso se descarga incluso después de iniciar sesión. Si en algún momento el sitio se siente lento al cargar, este es el primer lugar a revisar.