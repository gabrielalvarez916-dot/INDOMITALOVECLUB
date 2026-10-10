-- ============================================================
-- Refine para autores: evaluación profesional del libro
-- Plan nuevo "refine" (USD 15 solo, o en combo con pack individual 18 / basic 24 / premium 32).
-- Al activarse genera 2 encargos en Pendientes: "revision_portada" e "informe_editorial",
-- ambos asignables a un diseñador (admin > Visuales > Diseñadores).
-- ============================================================

-- 1) Permitir el plan nuevo y los tipos de encargo nuevos
alter table public.impulsos_campana drop constraint impulsos_campana_plan_check;
alter table public.impulsos_campana add constraint impulsos_campana_plan_check
  check (plan = any (array['impulso','select','resistence','complete','refine']));

alter table public.tareas_impulso drop constraint tareas_impulso_tipo_accion_check;
alter table public.tareas_impulso add constraint tareas_impulso_tipo_accion_check
  check (tipo_accion = any (array['banner','banner_cuadrado','historia_instagram','revision_portada','informe_editorial']));

alter table public.vis_disenador_asignaciones drop constraint vis_disenador_asignaciones_tipo_check;
alter table public.vis_disenador_asignaciones add constraint vis_disenador_asignaciones_tipo_check
  check (tipo = any (array['banner','banner_cuadrado','revision_portada','informe_editorial']));

-- 2) Combo con packs: el pack puede venir con un Refine incluido (se usa en la primera campaña del pack)
alter table public.campana_creditos
  add column if not exists incluye_refine boolean not null default false,
  add column if not exists refine_reclamado boolean not null default false;

-- 3) Precios (USD) editables desde la tabla de configuración
insert into public.configuracion (clave, valor)
select v.clave, v.valor
from (values
  ('REFINE_PRECIO_USD', '15'),
  ('REFINE_COMBO_INDIVIDUAL_USD', '18'),
  ('REFINE_COMBO_BASIC_USD', '24'),
  ('REFINE_COMBO_PREMIUM_USD', '32')
) as v(clave, valor)
where not exists (select 1 from public.configuracion c where c.clave = v.clave);

-- 4) Activación de Refine: marca el plan como pagado y crea los 2 encargos pendientes
create or replace function public.refine_activar(p_id_impulso uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_impulso record;
  v_restante numeric;
  v_credito record;
  v_tomar numeric;
begin
  select * into v_impulso from impulsos_campana where id = p_id_impulso for update;
  if not found then
    return jsonb_build_object('error', 'Impulso no encontrado.');
  end if;
  if v_impulso.plan <> 'refine' then
    return jsonb_build_object('error', 'Este impulso no es un Refine.');
  end if;
  if v_impulso.estado <> 'pendiente' then
    return jsonb_build_object('error', 'Este impulso ya fue procesado (estado: ' || v_impulso.estado || ').');
  end if;

  update impulsos_campana
     set estado = 'pagado', fecha_activacion = now()
   where id = p_id_impulso;

  -- Si se aplicaron créditos del autor al precio, se descuentan (mismo criterio FIFO que los demás planes)
  if coalesce(v_impulso.creditos_aplicados, 0) > 0 then
    v_restante := v_impulso.creditos_aplicados::numeric;
    for v_credito in
      select * from creditos_autor
       where id_usuario_autor = v_impulso.id_usuario_autor
         and estado = 'vigente'
         and (monto - monto_usado) > 0
       order by fecha_otorgado asc
       for update
    loop
      exit when v_restante <= 0;
      v_tomar := least(v_restante, v_credito.monto - v_credito.monto_usado);
      update creditos_autor
         set monto_usado = monto_usado + v_tomar,
             estado = case when (monto_usado + v_tomar) >= monto then 'usado' else 'vigente' end
       where id = v_credito.id;
      v_restante := v_restante - v_tomar;
    end loop;
  end if;

  -- Los 2 encargos que aparecen en Pendientes (solo una vez por Refine)
  if not exists (select 1 from tareas_impulso where id_impulso = p_id_impulso) then
    insert into tareas_impulso (id_impulso, tipo_accion) values
      (p_id_impulso, 'revision_portada'),
      (p_id_impulso, 'informe_editorial');
  end if;

  return jsonb_build_object('ok', true, 'plan', 'refine', 'notificados', 0);
end;
$function$;

revoke all on function public.refine_activar(uuid) from public, anon, authenticated;

-- 5) Combo: al crear la primera campaña con un pack que incluye Refine, se genera y activa solo
create or replace function public.trg_refine_pack_al_crear_campana()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_credito record;
  v_id uuid;
begin
  if new.id_credito_consumido is null then
    return new;
  end if;

  begin
    select id, incluye_refine, refine_reclamado
      into v_credito
    from campana_creditos
    where id = new.id_credito_consumido
    for update;

    if found and coalesce(v_credito.incluye_refine, false) and not coalesce(v_credito.refine_reclamado, false) then
      update campana_creditos set refine_reclamado = true where id = v_credito.id;

      insert into impulsos_campana (
        id_campana, id_usuario_autor, moneda, precio_lista,
        creditos_aplicados, monto_a_pagar, estado, plan
      ) values (
        new.id, new.id_usuario_autor, 'ARS', 0, 0, 0, 'pendiente', 'refine'
      )
      returning id into v_id;

      perform refine_activar(v_id);
    end if;
  exception when others then
    -- Nunca bloquear la creación de la campaña: el Refine queda sin reclamar
    raise warning 'trg_refine_pack_al_crear_campana falló para campaña %: %', new.id, sqlerrm;
  end;

  return new;
end;
$function$;

revoke all on function public.trg_refine_pack_al_crear_campana() from public, anon, authenticated;

drop trigger if exists trg_refine_pack_al_crear_campana on public.campanas;
create trigger trg_refine_pack_al_crear_campana
  after insert on public.campanas
  for each row execute function public.trg_refine_pack_al_crear_campana();

-- 6) Ajustes mínimos a las funciones existentes (se parchea el texto actual de cada una).
--    Resumen de lo que cambia:
--    - admin_activar_impulso / activar_impulso_por_webhook: si el plan es 'refine' llaman a refine_activar
--    - _vis_tarea_es_repetida: los encargos de Refine nunca se consideran repetidos
--    - admin_vis_tareas_disponibles: ofrece también revision_portada e informe_editorial (plan refine)
--    - admin_asignar_tarea_disenador: acepta los 2 tipos nuevos
--    - admin_vis_disenador_asignar: monto desde Configuración (DISENADOR_PAGO_REVISION_PORTADA_USD /
--      DISENADOR_PAGO_INFORME_EDITORIAL_USD); si no están definidos, avisa y no asigna
--    (El SQL exacto de los parches se aplicó directo en Supabase con la migración "refine_autores".)
