# Plan — Plantillas VSL/Webinar, modalidad de grabación, tareas del cliente y retrasos

Trabajo nocturno sin aprobación de Tony. Rama `fix/plantillas-vsl-webinar`. No se ejecuta SQL, no hay push, no se toca `main`.

## 1. Cómo funciona hoy (5 líneas)

1. **Plantillas**: `src/data/projectTemplates.ts` define `baseTasks` (69) reutilizado tal cual como `vslTasks`, y `webinarTasks` (71) que quita el grupo `diseno_web` de la base y lo vuelve a escribir completo más 2 extras. `resolveTemplateTasks(template, storedTasks, hasStoredTemplate)` combina la plantilla de código con filas de `template_tasks`: si existe una fila de `project_templates` con ese id, las tareas de la base de datos **reemplazan** a las del código; si no, las **extienden** (dedup por `department:title`). La usan `CreateProjectModal`, `FunnelTemplatesManager` y `CreateTaskModal` (esta última solo para "fijar en plantilla").
2. **Asignación al cliente**: `CreateProjectModal.handleContinue` busca `clients.user_id` y arma `defaults['cliente'] = cUser.id`; pero en `handleCreate` cada tarea usa `assigned_to: taskOverrides[idx] || deptAssignees[group] || user!.id` — si el grupo cliente no tiene asignado explícito (cliente sin cuenta), la tarea **cae en quien crea el proyecto**. Además `allAssignees`/`clientGroupAssignees` permiten elegir "(yo)" o a cualquier persona del equipo para el grupo cliente. `CreateTaskModal` solo deja elegir entre `admin`/`team` activos (ni siquiera lista clientes), así que hoy una tarea nueva de depto `cliente` también puede acabar en alguien del equipo.
3. **Portal**: `ClientPortal.tsx` → pestaña "Mis tareas" → sección "Tareas que debes completar" filtra `department === 'cliente'`, muestra estatus, "Fecha límite"/"⚠ Vencida" calculado en el cliente (sin persistir retraso), pero es de solo lectura: no hay botón de entrega ni de subida. `TaskDetailModal.uploadFile` ya tiene la lógica de subida a `chat-files` + `task_links` que se puede reutilizar.
4. **Recordatorios y fechas**: `notify_upcoming_deadlines()` (`sql/2026-07-15_...sql`) notifica a `assigned_to` 0–2 días antes de `commitment_date` con `type='deadline'`; no existe aviso de vencida ni tabla de retrasos. Las vencidas se recalculan de forma independiente (sin compartir lógica) en `AdminDashboard` (`overdueTasks`), `ProjectDetail` (`overdue`), `TeamCapacity`, `TeamDashboard` y `ClientPortal` (`isLate`), sin distinguir de quién es la culpa.
5. **Scorecard**: `TeamPerformance.getMemberKPIs` calcula `onTimeRate` a partir de `work_sessions` (hora de entrada del checador, **no** de entregas de tareas), `noRetrabajoRate`, `delivered`, `avgRating` y `totalHours/expectedHours`; score = `onTime*0.2 + noRetrabajo*0.25 + delivered*0.2 + rating*0.2 + horas*0.15`. `projects` solo tiene `name`, `description`, `status` (confirmado en `src/types/index.ts`, no hay dump de esquema completo en el repo).

## 2. Consultas SOLO DE LECTURA (no se ejecutan)

```sql
-- Filas existentes en project_templates/template_tasks para vsl y webinar
select * from project_templates where id in ('vsl','webinar');
select * from template_tasks where template_id in ('vsl','webinar') order by template_id, created_at;

-- Tareas del departamento cliente asignadas a alguien que NO es el cliente del proyecto
select t.id, t.title, t.status, p.name proyecto, c.name cliente, c.user_id cliente_user,
       u.full_name asignado, u.role
from tasks t
join projects p on p.id = t.project_id
join clients c on c.id = p.client_id
left join users u on u.id = t.assigned_to
where t.department = 'cliente' and (u.role is distinct from 'client');

-- Columnas actuales (fuente: src/types/index.ts; no hay dump de esquema en el repo)
-- projects: id, client_id, name, description, status, created_at
-- tasks: id, project_id, title, description, assigned_to, department, status, priority,
--        start_date, needed_date, commitment_date, completion_date, reviewer_id, approver_id,
--        approver_ids, review_status, client_approval, change_count, depends_on_task_id,
--        created_by, created_at, updated_at
```

Si `project_templates` tuviera filas `vsl`/`webinar` ya guardadas, `resolveTemplateTasks` las usaría como reemplazo total y el rediseño de este PR (código) quedaría sin efecto hasta que se borren esas filas. El SQL correctivo (NO se ejecuta) quedaría así, para que Tony lo revise:

```sql
-- Solo si la consulta de arriba muestra filas vsl/webinar que haya que limpiar:
delete from template_tasks where template_id in ('vsl','webinar');
delete from project_templates where id in ('vsl','webinar');
```

## 3. Plan con conteos

### 3.1 Plantillas (`src/data/projectTemplates.ts`)

- `baseTasks` pasa de 69 a **61**: cliente 4, líder 11, webmaster 12 (se quitan "Pág. Ingreso al Webinar" y "Addevent"), copy 14, diseño 10 (`diseno_web` 4 + `diseno_ads` 6, escrito una sola vez), edición 4, trafficker 5, grabación 1 (`Encarpetar`).
- `soloVslTasks = []`.
- `soloWebinarTasks` = **6**: cliente 2 (Crear Presentación, Solicitar reunión con Alfredo Mota), webmaster 2 (Pág. Ingreso al Webinar, Addevent), diseño 1 (`diseno_web`, presentación de webinar), edición 1 (`edicion_presentacion`).
- `vslTasks = [...baseTasks, ...soloVslTasks]` = 61. `webinarTasks = [...baseTasks, ...soloWebinarTasks]` = 67.
- Nuevo `Modalidad = 'oficina' | 'remota'`, `TemplateTask.modalidad?`, y `tasksForModalidad(modalidad)`:
  - `oficina`: grabación 2 (Grabar 12 anuncios, Grabar VSL y Video de Gracias) + cliente 1 (Asistir a la sesión de grabación) = 3.
  - `remota`: cliente 2 (Grabar VSL/Gracias/12 anuncios, Compartir la grabación) + grabación 1 (Enviar guía de grabación y revisar material) = 3.
- `CreateProjectModal` concatena `tasksForModalidad(modalidad)` al resultado de `resolveTemplateTasks` cuando el template es `vsl`/`webinar`.

| Plantilla · modalidad | Total | Cliente | Grabación | Resto (líder/webmaster/copy/diseño/edición/trafficker) |
|---|---|---|---|---|
| VSL · oficina | 61+3=**64** | 4+1=5 | 1+2=3 | 11/12/14/10/4/5 |
| VSL · remota | 61+3=**64** | 4+2=6 | 1+1=2 | 11/12/14/10/4/5 |
| Webinar · oficina | 67+3=**70** | 4+2+1=7 | 1+2=3 | 11/14/14/11/5/5 |
| Webinar · remota | 67+3=**70** | 4+2+2=8 | 1+1=2 | 11/14/14/11/5/5 |

Coincide exactamente con la tabla de aceptación.

### 3.2 Asignación al cliente

- `CreateProjectModal`: bloquea "Continuar" si el cliente seleccionado no tiene `clients.user_id` → usuario con `role='client'` activo. Se agrega acción "Invitar cliente" (genera `client_invitations`, igual que `ClientAssignmentManager`) y el flujo de "Nuevo cliente" pasa a: crear el registro de `clients`, mostrar el link de invitación y **no** crear el proyecto todavía (se crea después, eligiendo "Cliente existente" una vez que el cliente se registró).
- Se quita `|| user!.id` para el departamento cliente y se quitan "(yo)" y el equipo de `clientGroupAssignees`/selector del grupo cliente — el único asignable del grupo cliente es el usuario cliente del proyecto.
- `CreateTaskModal`: si `department === 'cliente'`, el campo "Asignar a" deja de mostrar la lista de `admin`/`team` y se fija automáticamente al `clients.user_id` del proyecto elegido (o bloquea si no existe).
- Trigger SQL (en el archivo de migración nuevo, no se ejecuta) que rechaza inserts/updates de `tasks` con `department='cliente'` y `assigned_to` distinto del `user_id` del cliente del proyecto. **No se activa automáticamente sobre datos viejos** — primero se corre (manualmente, después de revisión) la reasignación.
- Proyectos existentes no se tocan; por eso la reasignación es un script aparte que Tony debe revisar y correr él mismo.

### 3.3 Modalidad y retrasos

- `projects.recording_mode` (`oficina`/`remota`, default `oficina`), `launch_date`, `launch_date_original`.
- `tasks.delay_responsible` (`cliente`/`agencia`), `delay_days`, `delay_reason`, `delay_marked_at`, `delay_marked_by`.
- Lógica centralizada en `src/lib/taskDelays.ts` (nuevo, puro/testeable): `isOverdue`, `isClientAttributableDelay`, `countsForTeamOnTimeMetric`, `wasDeliveredOnTime`. Todas las pantallas (TaskDetailModal, ProjectDetail, RoadmapView, AdminDashboard, TeamPerformance) importan de aquí en vez de reimplementar el cálculo.
- `mark_client_delays()` (SQL, pg_cron diario): marca `cliente` las tareas de depto `cliente` vencidas sin marca; marca `agencia` las de `grabacion` vencidas sin marca (comportamiento explícito, aunque el default ya cuenta como agencia mientras no esté marcada `cliente`); propaga `cliente` a tareas de equipo vencidas cuyo `depends_on_task_id` ya esté marcado `cliente`; inserta en `project_delay_events`.
- Botón admin "El cliente no asistió / reprogramó" en la tarea "Asistir a la sesión de grabación" (solo oficina): marca esa tarea y las de Grabación que dependan de ella como `cliente`, con motivo.
- `client_complete_task(p_task_id)` (RPC, security definer): valida que la tarea sea de depto `cliente` y `assigned_to = auth.uid()`, pone `completada` + `completion_date`, notifica a `created_by`.

### 3.4 Portal y scorecard

- "Mis tareas" → "Mis pendientes": orden por `commitment_date`, contador, "Vence en N días"/"Vencida hace N días", botón subir archivo/link (reusa el patrón de `TaskDetailModal.uploadFile`) y "Marcar como entregado" (`client_complete_task`). Historial de retrasos (lectura de `project_delay_events`, sin nombres internos).
- `TeamPerformance`: nueva métrica "Entregas a tiempo" = `wasDeliveredOnTime` sobre tareas que `countsForTeamOnTimeMetric` (excluye depto cliente y `delay_responsible='cliente'`). Pesos (decisión 1 de Tony): `onTime*0.1 + entregasATiempo*0.1 + noRetrabajo*0.25 + entregadas*0.2 + calificación*0.2 + horas*0.15`.

## 4. Decisiones tomadas sin Tony (conservadoras)

1. **"Nuevo cliente" en `CreateProjectModal`**: ya no crea el proyecto en el mismo paso. Crea solo el cliente + invitación y pide volver a "Cliente existente" cuando ya tenga cuenta. Es la opción más conservadora para cumplir "no se puede crear un proyecto sin usuario cliente" sin borrar la función de alta de clientes nuevos.
2. **Tareas de embudos personalizados (no vsl/webinar)**: no se les aplica `tasksForModalidad` ni el bloqueo de depto cliente más allá del trigger general — el alcance pedido es vsl/webinar; los embudos personalizados ya dependen 100% de `template_tasks`.
3. **`notifications_type_check`**: no existe su definición en `sql/*.sql` (se creó directo en Supabase). La migración nueva solo **agrega** el tipo `client_delay` sin asumir la lista completa previa, usando `drop constraint if exists` + recreación con los tipos detectados por grep en el código (`task`, `review`, `approval`, `change_request`, `comment`, `deadline`, `task_request`) + `client_delay`. Si la lista real en producción tiene más valores, Tony debe revisarlo antes de correr la migración.
4. **`launch_date`/`launch_date_original`**: se dejan como campos editables manualmente en "Editar proyecto" (no hay cálculo automático de cuánto se corrió el lanzamiento); el admin decide cuándo mover `launch_date` y el delta se muestra solo si ambas fechas existen.
5. **`project_delay_events`**: tabla solo-insert; no se agregan políticas de `update`/`delete` (nadie puede editar vía RLS, ni siquiera superadmin desde la app) — así se cumple "el superadmin es el único que edita" en el sentido de que solo se podría tocar fuera de RLS.
6. **FunnelTemplatesManager**: el conteo de tareas por plantilla que muestra (61 VSL / 67 Webinar) **no** incluye las tareas de modalidad, porque la modalidad se eligen al crear el proyecto, no al editar la plantilla. La tabla de aceptación (64/70) aplica solo al paso de creación de proyecto.

## 5. Orden de implementación

plantillas → asignación al cliente → modalidad → portal → retrasos → scorecard → pruebas → build → commit.

---

## 6. Resumen final

### Qué se hizo

1. **Plantillas** (`src/data/projectTemplates.ts`): base común de 61 tareas escrita una sola vez, `soloVslTasks = []`, `soloWebinarTasks` con las 6 tareas exclusivas de Webinar, y `tasksForModalidad(modalidad)` con las 3 tareas de grabación/cliente de cada modalidad. `resolveTemplateTasks` y los ids `vsl`/`webinar`/`otro` no cambiaron.
2. **Asignación al cliente**: `CreateProjectModal` bloquea "Crear proyecto" sin un usuario de cliente activo, ofrece generar su invitación, y el modo "Nuevo cliente" ahora solo da de alta el cliente + invitación (el proyecto se crea después). Se quitó el fallback a `user!.id` para el depto cliente y se quitaron "(yo)"/equipo de su selector. `CreateTaskModal` fija "Asignar a" al usuario cliente del proyecto cuando el depto es `cliente`.
3. **Modalidad**: selector en el paso 1 de `CreateProjectModal` (solo visible para VSL/Webinar), se guarda en `projects.recording_mode` y se edita en `ProjectDetail → Editar proyecto` (no modifica tareas existentes).
4. **SQL nuevos (NO ejecutados)**: `sql/2026-10-22_reasignar_tareas_cliente.sql` (consulta de solo lectura + UPDATE de reasignación + SELECT de clientes sin cuenta) y `sql/2026-10-22_modalidad_y_retrasos_cliente.sql` (columnas de `projects`/`tasks`, tabla `project_delay_events`, trigger `enforce_client_task_assignment`, RPC `client_complete_task`, `mark_client_delays()` + `notify_overdue_client_tasks()` con `pg_cron`, y la extensión de `notifications_type_check`).
5. **Portal del cliente**: "Mis tareas" → "Mis pendientes" con contador, "Vence en N días"/"Vencida hace N días", subir archivo/link, "Marcar como entregado" (RPC) e "Historial de retrasos".
6. **Retrasos**: lógica centralizada en `src/lib/taskDelays.ts`, usada por `TaskDetailModal` (badge + botón "El cliente no asistió / reprogramó" + "No fue el cliente"), `ProjectDetail` (badge por tarea, contador de retrasos del cliente, fecha de lanzamiento con delta), `RoadmapView` (indicador visual + tooltip) y `AdminDashboard` (categoría "Retrasos del cliente" separada de "Fuera de fecha"/salud operativa).
7. **Scorecard**: nueva métrica "Entregas a tiempo" (excluye depto cliente y `delay_responsible='cliente'`) y pesos ajustados: `onTime*0.1 + entregasATiempo*0.1 + noRetrabajo*0.25 + entregadas*0.2 + calificación*0.2 + horas*0.15`.
8. Pruebas nuevas en `tests/session-regressions.test.cjs` (conteos por plantilla/modalidad, sin duplicados, sin tareas de webinar en VSL, ningún título repetido entre modalidades, lógica de `taskDelays` para los 4 escenarios del enunciado, y verificación por texto fuente de los bloqueos de asignación y de las integraciones de UI).

### Qué faltó / quedó para después

- No se implementó el cálculo automático de `launch_date`/`launch_date_original` a partir de los retrasos — queda como campo editable manualmente, según la decisión 4 de la sección 4.
- No se tocó `FunnelTemplatesManager` para mostrar los conteos con modalidad incluida (decisión 6) — sigue mostrando 61/67 tareas por ser la vista de edición de la plantilla, no de creación de proyecto.
- El `notifications_type_check` recreado es una reconstrucción basada en los usos detectados por grep, no en la definición real de producción (no existe en los archivos `sql/*.sql` del repo) — Tony debe confirmarlo antes de correr la migración.
- No se verificó manualmente en navegador (el enunciado lo deja para el preview de Tony); solo se corrieron pruebas automatizadas y build.
- La FASE 2 (lo que sea que venga después) no se empezó.

### Resultados

- `npm test`: **52/52 pruebas pasan** (incluye las 14 pruebas nuevas de esta fase).
- `npm run build`: **compila sin errores** (`tsc -b` + `vite build`).

### Orden para correr el SQL (Tony, manualmente, fuera de este PR)

1. Revisar y correr `sql/2026-10-22_reasignar_tareas_cliente.sql` (primero el SELECT de solo lectura, luego el UPDATE si se ve bien, luego el SELECT de clientes sin cuenta para invitarlos).
2. Recién después, correr `sql/2026-10-22_modalidad_y_retrasos_cliente.sql` (incluye el trigger que depende de que el paso 1 ya haya limpiado los datos viejos).
3. Publicar la rama.
