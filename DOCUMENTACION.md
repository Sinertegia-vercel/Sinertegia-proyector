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