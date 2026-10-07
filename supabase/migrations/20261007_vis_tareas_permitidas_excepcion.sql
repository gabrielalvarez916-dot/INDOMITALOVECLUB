-- Excepcion puntual a la regla de "banner repetido" (mismo autor + libro + tipo).
-- Tareas permitidas manualmente: aparecen en Diseñadores aunque exista un pedido anterior.
-- Caso: El Vinculo de las Espinas (roxanna.writes), Resistence 2026-10-07.
create table if not exists public.vis_tareas_permitidas (
  tarea_id text primary key,
  motivo text,
  creado_en timestamptz not null default now()
);
alter table public.vis_tareas_permitidas enable row level security;

insert into public.vis_tareas_permitidas (tarea_id, motivo) values
  ('f0927193-d513-4f79-9a9d-5ba68ac7db0a', 'Excepcion manual: El Vinculo de las Espinas, Resistence 2026-10-07 (banner feed)'),
  ('9173edea-fde1-45d0-b7dc-ed0a8308c7d1', 'Excepcion manual: El Vinculo de las Espinas, Resistence 2026-10-07 (banner reseñadores)')
on conflict (tarea_id) do nothing;

-- _vis_tarea_es_repetida: igual que antes, pero devuelve false si la tarea esta en vis_tareas_permitidas.
create or replace function public._vis_tarea_es_repetida(p_tarea text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when exists (select 1 from vis_tareas_permitidas p where p.tarea_id = p_tarea) then false
    else (
      with x as (
        select t.id, t.tipo_accion, t.fecha_creacion, c.id_usuario_autor autor, lower(btrim(c.nombre_libro)) libro
          from tareas_impulso t
          join impulsos_campana i on i.id = t.id_impulso
          join campanas c on c.id = i.id_campana
         where t.id::text = p_tarea
      )
      select exists (
        select 1
          from x, tareas_impulso t2
          join impulsos_campana i2 on i2.id = t2.id_impulso
          join campanas c2 on c2.id = i2.id_campana
         where t2.tipo_accion = x.tipo_accion
           and t2.id <> x.id
           and c2.id_usuario_autor = x.autor
           and lower(btrim(c2.nombre_libro)) = x.libro
           and (t2.fecha_creacion < x.fecha_creacion or (t2.fecha_creacion = x.fecha_creacion and t2.id < x.id))
      ) or exists (
        select 1
          from x, vis_disenador_asignaciones a
          join tareas_impulso t3 on t3.id::text = a.tarea_id
          join impulsos_campana i3 on i3.id = t3.id_impulso
          join campanas c3 on c3.id = i3.id_campana
         where a.tarea_id <> p_tarea
           and t3.tipo_accion = x.tipo_accion
           and c3.id_usuario_autor = x.autor
           and lower(btrim(c3.nombre_libro)) = x.libro
      )
    )
  end;
$function$;
