-- ============================================================
-- Liquidaciones de diseñadores (admin > Visuales > Diseñadores)
-- · Cada diseñador tiene un período de pago (semanal / quincenal / mensual) y un mail de PayPal.
-- · Las liquidaciones juntan los banners ENTREGADOS de un período ya cerrado (zona horaria Argentina).
-- · Cada banner entregado se liquida una sola vez (asignaciones.liquidacion_id).
-- · Se marca si fue pagada o no, con referencia de PayPal opcional.
-- ============================================================

alter table public.vis_disenadores
  add column if not exists periodo_pago text,
  add column if not exists email_paypal text;

alter table public.vis_disenadores drop constraint if exists vis_disenadores_periodo_pago_chk;
alter table public.vis_disenadores
  add constraint vis_disenadores_periodo_pago_chk
  check (periodo_pago is null or periodo_pago in ('semanal','quincenal','mensual'));

create table if not exists public.vis_disenador_liquidaciones (
  id                    uuid primary key default gen_random_uuid(),
  disenador_id          uuid not null references public.vis_disenadores(id) on delete cascade,
  periodo_tipo          text not null check (periodo_tipo in ('semanal','quincenal','mensual')),
  desde                 date not null,
  hasta                 date not null,
  cantidad_feed         integer not null default 0,
  cantidad_resenadores  integer not null default 0,
  total_usd             numeric(10,2) not null,
  email_paypal          text,
  estado                text not null default 'pendiente' check (estado in ('pendiente','pagada')),
  pagada_en             timestamptz,
  referencia_paypal     text,
  creado_en             timestamptz not null default now()
);
create index if not exists vis_dis_liq_disenador_idx on public.vis_disenador_liquidaciones (disenador_id);
create index if not exists vis_dis_liq_estado_idx on public.vis_disenador_liquidaciones (estado, hasta desc);
alter table public.vis_disenador_liquidaciones enable row level security;

alter table public.vis_disenador_asignaciones
  add column if not exists liquidacion_id uuid references public.vis_disenador_liquidaciones(id) on delete set null;
create index if not exists vis_dis_asig_liq_idx on public.vis_disenador_asignaciones (liquidacion_id);

-- ------------------------------------------------------------
-- Período de pago + mail de PayPal de un diseñador
-- ------------------------------------------------------------
create or replace function public.admin_vis_disenador_pago_config(p_id uuid, p_periodo text, p_email_paypal text)
returns json language plpgsql security definer set search_path = public as $$
declare v_periodo text := nullif(trim(coalesce(p_periodo, '')), '');
        v_mail text := nullif(trim(coalesce(p_email_paypal, '')), '');
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  if v_periodo is not null and v_periodo not in ('semanal','quincenal','mensual') then
    return json_build_object('error', 'Período inválido.');
  end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return json_build_object('error', 'El mail de PayPal no parece válido.');
  end if;
  update vis_disenadores set periodo_pago = v_periodo, email_paypal = v_mail where id = p_id;
  if not found then return json_build_object('error', 'Diseñador no encontrado.'); end if;
  -- Las liquidaciones todavía sin pagar toman el mail corregido
  update vis_disenador_liquidaciones set email_paypal = v_mail where disenador_id = p_id and estado = 'pendiente';
  return json_build_object('ok', true);
end $$;

-- ------------------------------------------------------------
-- Listado de diseñadores (ahora con período, PayPal y montos de pago)
-- ------------------------------------------------------------
create or replace function public.admin_vis_disenadores_listar()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error','No autorizado'); end if;
  return json_build_object('disenadores', coalesce((
    select json_agg(d order by d.nombre) from (
      select di.id, di.nombre, di.telefono, di.email, di.activo, di.periodo_pago, di.email_paypal,
        count(a.id) filter (where not a.entregado) as pendientes,
        count(a.id) filter (where a.entregado) as entregados,
        coalesce(sum(a.monto_usd) filter (where a.entregado),0) as ganado_usd,
        coalesce(sum(a.monto_usd) filter (where not a.entregado),0) as por_ganar_usd,
        coalesce(sum(a.monto_usd) filter (where a.entregado and a.liquidacion_id is null),0) as sin_liquidar_usd,
        coalesce((select sum(q.total_usd) from vis_disenador_liquidaciones q
                  where q.disenador_id = di.id and q.estado = 'pendiente'), 0) as liquidado_sin_pagar_usd,
        coalesce((select sum(q.total_usd) from vis_disenador_liquidaciones q
                  where q.disenador_id = di.id and q.estado = 'pagada'), 0) as pagado_usd
      from vis_disenadores di
      left join vis_disenador_asignaciones a on a.disenador_id = di.id
      where di.activo
      group by di.id
    ) d
  ), '[]'::json));
end $$;

-- ------------------------------------------------------------
-- Generar liquidaciones: banners entregados de períodos YA CERRADOS, sin liquidar todavía
--   semanal   = lunes a domingo
--   quincenal = del 1 al 15 y del 16 a fin de mes
--   mensual   = mes calendario
-- ------------------------------------------------------------
create or replace function public.admin_vis_liquidaciones_generar()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  g record; v_id uuid; v_creadas int := 0; v_sin_periodo int := 0;
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  perform pg_advisory_xact_lock(hashtext('vis_liquidaciones_generar'));

  select count(distinct d.id) into v_sin_periodo
  from vis_disenadores d
  join vis_disenador_asignaciones a on a.disenador_id = d.id
  where d.activo and d.periodo_pago is null and a.entregado and a.liquidacion_id is null;

  for g in
    with base as (
      select a.id as asig_id, a.disenador_id, d.periodo_pago, d.email_paypal, a.tipo, a.monto_usd,
             (a.entregado_en at time zone 'America/Argentina/Buenos_Aires')::date as dia
      from vis_disenador_asignaciones a
      join vis_disenadores d on d.id = a.disenador_id
      where a.entregado and a.entregado_en is not null and a.liquidacion_id is null
        and d.activo and d.periodo_pago is not null
    ), rango as (
      select b.*,
        case b.periodo_pago
          when 'semanal'   then date_trunc('week', b.dia)::date
          when 'quincenal' then case when extract(day from b.dia) <= 15
                                     then date_trunc('month', b.dia)::date
                                     else date_trunc('month', b.dia)::date + 15 end
          else date_trunc('month', b.dia)::date
        end as desde,
        case b.periodo_pago
          when 'semanal'   then date_trunc('week', b.dia)::date + 6
          when 'quincenal' then case when extract(day from b.dia) <= 15
                                     then date_trunc('month', b.dia)::date + 14
                                     else (date_trunc('month', b.dia) + interval '1 month - 1 day')::date end
          else (date_trunc('month', b.dia) + interval '1 month - 1 day')::date
        end as hasta
      from base b
    )
    select disenador_id, periodo_pago, email_paypal, desde, hasta,
           array_agg(asig_id) as ids,
           count(*) filter (where tipo = 'banner') as feed,
           count(*) filter (where tipo = 'banner_cuadrado') as cuad,
           sum(monto_usd) as total
    from rango
    where hasta < v_hoy
    group by disenador_id, periodo_pago, email_paypal, desde, hasta
  loop
    insert into vis_disenador_liquidaciones
      (disenador_id, periodo_tipo, desde, hasta, cantidad_feed, cantidad_resenadores, total_usd, email_paypal)
    values (g.disenador_id, g.periodo_pago, g.desde, g.hasta, g.feed, g.cuad, g.total, g.email_paypal)
    returning id into v_id;
    update vis_disenador_asignaciones set liquidacion_id = v_id where id = any(g.ids);
    v_creadas := v_creadas + 1;
  end loop;

  return json_build_object('ok', true, 'creadas', v_creadas, 'disenadores_sin_periodo', v_sin_periodo);
end $$;

-- ------------------------------------------------------------
-- Listado de liquidaciones (p_estado: null = todas, 'pendiente', 'pagada')
-- ------------------------------------------------------------
create or replace function public.admin_vis_liquidaciones_listar(p_estado text default null)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  return json_build_object('liquidaciones', coalesce((
    select json_agg(row_to_json(l) order by (l.estado = 'pagada'), l.hasta desc, l.disenador) from (
      select q.id, q.disenador_id, d.nombre as disenador, q.periodo_tipo, q.desde, q.hasta,
             q.cantidad_feed, q.cantidad_resenadores, q.total_usd, q.email_paypal,
             q.estado, q.pagada_en, q.referencia_paypal, q.creado_en
      from vis_disenador_liquidaciones q
      join vis_disenadores d on d.id = q.disenador_id
      where p_estado is null or q.estado = p_estado
    ) l
  ), '[]'::json));
end $$;

-- Marcar pagada / volver a pendiente
create or replace function public.admin_vis_liquidacion_marcar(p_id uuid, p_pagada boolean, p_referencia text default null)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  update vis_disenador_liquidaciones
     set estado = case when p_pagada then 'pagada' else 'pendiente' end,
         pagada_en = case when p_pagada then now() else null end,
         referencia_paypal = case when p_pagada then nullif(trim(coalesce(p_referencia, '')), '') else null end
   where id = p_id;
  if not found then return json_build_object('error', 'Liquidación no encontrada.'); end if;
  return json_build_object('ok', true);
end $$;

-- Eliminar una liquidación NO pagada (los banners vuelven a quedar sin liquidar)
create or replace function public.admin_vis_liquidacion_eliminar(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  if exists (select 1 from vis_disenador_liquidaciones where id = p_id and estado = 'pagada') then
    return json_build_object('error', 'Está pagada: primero volvela a pendiente.');
  end if;
  delete from vis_disenador_liquidaciones where id = p_id;  -- las asignaciones quedan con liquidacion_id = null
  if not found then return json_build_object('error', 'Liquidación no encontrada.'); end if;
  return json_build_object('ok', true);
end $$;

-- Un banner que ya está en una liquidación no se puede desmarcar como entregado
create or replace function public.admin_vis_disenador_marcar_entrega(p_asignacion_id uuid, p_entregado boolean)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then return json_build_object('error', 'No autorizado'); end if;
  if not p_entregado and exists (
    select 1 from vis_disenador_asignaciones where id = p_asignacion_id and liquidacion_id is not null
  ) then
    return json_build_object('error', 'Este banner ya está en una liquidación. Eliminá la liquidación (si no está pagada) para poder cambiarlo.');
  end if;
  update vis_disenador_asignaciones
     set entregado = p_entregado,
         entregado_en = case when p_entregado then now() else null end
   where id = p_asignacion_id;
  return json_build_object('ok', true);
end $$;

-- Permisos: solo usuarios logueados (y dentro de cada función se chequea es_admin())
revoke execute on function
  public.admin_vis_disenador_pago_config(uuid, text, text),
  public.admin_vis_liquidaciones_generar(),
  public.admin_vis_liquidaciones_listar(text),
  public.admin_vis_liquidacion_marcar(uuid, boolean, text),
  public.admin_vis_liquidacion_eliminar(uuid)
from public, anon;

grant execute on function
  public.admin_vis_disenador_pago_config(uuid, text, text),
  public.admin_vis_disenadores_listar(),
  public.admin_vis_liquidaciones_generar(),
  public.admin_vis_liquidaciones_listar(text),
  public.admin_vis_liquidacion_marcar(uuid, boolean, text),
  public.admin_vis_liquidacion_eliminar(uuid),
  public.admin_vis_disenador_marcar_entrega(uuid, boolean)
to authenticated;
