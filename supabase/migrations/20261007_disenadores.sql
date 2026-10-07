-- ============================================================
-- Diseñadores (admin > Visuales > Diseñadores)
-- Diseñadores sin cuenta + asignación de tareas de banner pendientes
-- Pago: banner feed = USD 2 · banner reseñador (cuadrado) = USD 1
-- El monto se guarda al asignar, así un cambio de tarifa no altera el historial.
-- ============================================================

create table if not exists public.vis_disenadores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text,
  email       text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists public.vis_disenador_asignaciones (
  id            uuid primary key default gen_random_uuid(),
  disenador_id  uuid not null references public.vis_disenadores(id) on delete cascade,
  tarea_id      text not null,               -- id de la tarea de impulso (admin_listar_tareas_impulso)
  tipo          text not null check (tipo in ('banner','banner_cuadrado')),
  plan          text,
  nombre_libro  text,
  monto_usd     numeric(8,2) not null,
  asignado_en   timestamptz not null default now(),
  entregado     boolean not null default false,
  entregado_en  timestamptz
);

create unique index if not exists vis_dis_asig_tarea_uidx on public.vis_disenador_asignaciones (tarea_id);
create index if not exists vis_dis_asig_disenador_idx on public.vis_disenador_asignaciones (disenador_id);

-- Solo se accede a través de las funciones admin (security definer)
alter table public.vis_disenadores enable row level security;
alter table public.vis_disenador_asignaciones enable row level security;

-- ------------------------------------------------------------
-- Listado con totales
-- ------------------------------------------------------------
create or replace function public.admin_vis_disenadores_listar()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  return json_build_object('disenadores', coalesce((
    select json_agg(d order by d.nombre) from (
      select di.id, di.nombre, di.telefono, di.email, di.activo,
        count(a.id) filter (where not a.entregado)                    as pendientes,
        count(a.id) filter (where a.entregado)                        as entregados,
        coalesce(sum(a.monto_usd) filter (where a.entregado), 0)      as ganado_usd,
        coalesce(sum(a.monto_usd) filter (where not a.entregado), 0)  as por_ganar_usd
      from vis_disenadores di
      left join vis_disenador_asignaciones a on a.disenador_id = di.id
      where di.activo
      group by di.id
    ) d
  ), '[]'::json));
end $$;

-- ------------------------------------------------------------
-- Crear / editar / archivar
-- ------------------------------------------------------------
create or replace function public.admin_vis_disenador_crear(p_nombre text, p_telefono text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  if coalesce(trim(p_nombre), '') = '' then return json_build_object('error', 'Falta el nombre.'); end if;
  insert into vis_disenadores (nombre, telefono, email)
  values (trim(p_nombre), nullif(trim(p_telefono), ''), nullif(trim(p_email), ''))
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.admin_vis_disenador_editar(p_id uuid, p_nombre text, p_telefono text, p_email text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  if coalesce(trim(p_nombre), '') = '' then return json_build_object('error', 'Falta el nombre.'); end if;
  update vis_disenadores
     set nombre = trim(p_nombre), telefono = nullif(trim(p_telefono), ''), email = nullif(trim(p_email), '')
   where id = p_id;
  return json_build_object('ok', true);
end $$;

-- Archivar (no borra: se conserva el historial de ganancias)
create or replace function public.admin_vis_disenador_archivar(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  update vis_disenadores set activo = false where id = p_id;
  return json_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- Asignaciones de un diseñador
-- ------------------------------------------------------------
create or replace function public.admin_vis_disenador_asignaciones(p_disenador_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  return json_build_object('asignaciones', coalesce((
    select json_agg(row_to_json(a) order by a.entregado, a.asignado_en desc)
    from (
      select id, tarea_id, tipo, plan, nombre_libro, monto_usd, asignado_en, entregado, entregado_en
      from vis_disenador_asignaciones where disenador_id = p_disenador_id
    ) a
  ), '[]'::json));
end $$;

-- IDs de tareas ya asignadas (para no ofrecerlas de nuevo)
create or replace function public.admin_vis_disenador_tareas_asignadas()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  return json_build_object('tareas', coalesce((
    select json_agg(json_build_object('tarea_id', a.tarea_id, 'disenador', d.nombre))
    from vis_disenador_asignaciones a join vis_disenadores d on d.id = a.disenador_id
  ), '[]'::json));
end $$;

-- p_tareas: [{"tarea_id":"...","tipo":"banner"|"banner_cuadrado","plan":"...","nombre_libro":"..."}]
create or replace function public.admin_vis_disenador_asignar(p_disenador_id uuid, p_tareas jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare t jsonb; v_monto numeric; v_tipo text; v_n int := 0;
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  if not exists (select 1 from vis_disenadores where id = p_disenador_id and activo) then
    return json_build_object('error', 'Diseñador no encontrado.');
  end if;
  for t in select * from jsonb_array_elements(p_tareas) loop
    v_tipo := t->>'tipo';
    if v_tipo = 'banner' then v_monto := 2;
    elsif v_tipo = 'banner_cuadrado' then v_monto := 1;
    else continue; end if;
    insert into vis_disenador_asignaciones (disenador_id, tarea_id, tipo, plan, nombre_libro, monto_usd)
    values (p_disenador_id, t->>'tarea_id', v_tipo, t->>'plan', t->>'nombre_libro', v_monto)
    on conflict (tarea_id) do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;
  return json_build_object('ok', true, 'asignadas', v_n);
end $$;

create or replace function public.admin_vis_disenador_desasignar(p_asignacion_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  delete from vis_disenador_asignaciones where id = p_asignacion_id and not entregado;
  if not found then return json_build_object('error', 'No se puede quitar: ya está entregado.'); end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.admin_vis_disenador_marcar_entrega(p_asignacion_id uuid, p_entregado boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  update vis_disenador_asignaciones
     set entregado = p_entregado,
         entregado_en = case when p_entregado then now() else null end
   where id = p_asignacion_id;
  return json_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- Entregas para el Excel (se agrupa por día / semana en el navegador)
-- ------------------------------------------------------------
create or replace function public.admin_vis_disenadores_entregas()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  return json_build_object('entregas', coalesce((
    select json_agg(row_to_json(e) order by e.entregado_en)
    from (
      select d.nombre as disenador, a.tipo, a.plan, a.nombre_libro, a.monto_usd, a.entregado_en
      from vis_disenador_asignaciones a join vis_disenadores d on d.id = a.disenador_id
      where a.entregado and a.entregado_en is not null
    ) e
  ), '[]'::json));
end $$;

grant execute on function
  public.admin_vis_disenadores_listar(),
  public.admin_vis_disenador_crear(text, text, text),
  public.admin_vis_disenador_editar(uuid, text, text, text),
  public.admin_vis_disenador_archivar(uuid),
  public.admin_vis_disenador_asignaciones(uuid),
  public.admin_vis_disenador_tareas_asignadas(),
  public.admin_vis_disenador_asignar(uuid, jsonb),
  public.admin_vis_disenador_desasignar(uuid),
  public.admin_vis_disenador_marcar_entrega(uuid, boolean),
  public.admin_vis_disenadores_entregas()
to authenticated;
