-- NO EJECUTAR TODAVÍA — requiere aprobación de Tony y probar la app (equipo, cliente y
-- admin) antes. Antes de correrlo, usa sql/2026-10-23_admin_tareas_00_revision.sql
-- (sección "e") para confirmar la lista COMPLETA de políticas vigentes en public.tasks:
-- este archivo solo toca la política "allow all" y recrea "team_update_tasks"; cualquier
-- otra política de select/insert debe seguir existiendo o quedará gente sin acceso.
--
-- Qué hace: hoy "allow all" probablemente permite cualquier UPDATE a cualquier
-- autenticado (de ahí que el equipo pueda editar fecha/estatus de tareas ajenas sin que
-- nadie lo note). Esto la cierra y la reemplaza por una política de UPDATE que solo deja
-- escribir a administradores activos o a quien tiene la tarea asignada.
--
-- Qué debe seguir existiendo aparte de esto (revísalo con el archivo de revisión):
--   - Una política de SELECT que permita al equipo/admin leer tareas y al cliente leer
--     las de sus proyectos (las de 2026-08-05_multiple_internal_task_approvers.sql y
--     las que ya existan no se tocan aquí).
--   - Una política de INSERT para crear tareas (CreateTaskModal, retrabajo, etc.) — esta
--     migración no la crea ni la toca.
begin;

drop policy if exists "allow all" on public.tasks;

drop policy if exists "team_update_tasks" on public.tasks;
create policy "team_update_tasks"
  on public.tasks for update
  to authenticated
  using (public.is_active_admin() or assigned_to = auth.uid())
  with check (public.is_active_admin() or assigned_to = auth.uid());

commit;
