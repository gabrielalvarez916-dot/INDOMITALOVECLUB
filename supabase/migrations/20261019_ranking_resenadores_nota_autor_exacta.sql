-- Ranking mensual de reseñadores: la calificación del autor usa la nota EXACTA
-- (promedio de las 7 preguntas, resenas.puntuacion_autor_exacta).
--
-- Cambios respecto de la versión anterior:
--  1. Calificación del autor: (nota - 3) x 20, de -40 (nota 1) a +40 (nota 5), con decimales.
--     Las reseñas viejas sin nota exacta usan la puntuación entera, como siempre.
--  2. Se quitan los +10 por cada "SÍ" (criterio_*): la web nunca los guardó y las
--     preguntas nuevas ya no son SÍ/NO.
--  3. Desempate: puntaje total, reseñas a tiempo, mejor nota promedio del autor, fecha de registro.
--  4. La columna criterios_si_total se mantiene (siempre 0) para no romper consumidores.
--
-- Aplicada en el proyecto "Indómita Love Club 2.0" (zthimkucjtuffzcmdbtf) el 2026-10-19.

CREATE OR REPLACE FUNCTION public.calcular_ranking_resenadores(p_mes text)
 RETURNS TABLE(id_usuario uuid, alias text, puntaje_cumplimiento numeric, resenas_a_tiempo integer, resenas_tarde integer, incumplidas integer, anuladas integer, criterios_si_total integer, puntaje_gamificacion numeric, puntaje_total numeric, posicion bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with eventos as (
    select
      p.id_usuario_resenador as id_usuario,
      p.id as id_postulacion,
      (r.id is not null) as tiene_resena,
      r.fecha_entrega,
      case when r.id is not null and r.fecha_entrega <= p.fecha_limite_entrega then true else false end as a_tiempo,
      coalesce(p.incumplida, false) as incumplida,
      coalesce(p.anulada_sin_avance, false) as anulada_sin_avance,
      p.estado,
      r.puntuacion_autor,
      -- Nota exacta (promedio de las 7 preguntas del autor). Las reseñas
      -- anteriores no la tienen: se usa la puntuación entera como siempre.
      coalesce(r.puntuacion_autor_exacta, r.puntuacion_autor::numeric) as nota_autor,
      to_char(coalesce(r.fecha_entrega, p.fecha_incumplida, p.fecha_anulacion_sin_avance, p.fecha_abandono), 'YYYY-MM') as mes_cierre
    from public.postulaciones p
    left join public.resenas r on r.id_postulacion = p.id
    where
      r.id is not null
      or coalesce(p.incumplida, false)
      or coalesce(p.anulada_sin_avance, false)
      or p.estado = 'abandonada'
  ),
  -- Primera reseña ENTREGADA del mes por cada reseñador (para el bono x2 de
  -- Reseñadores Premium). Solo cuenta entre las que sí tienen reseña.
  primera_resena_mes as (
    select
      id_usuario,
      id_postulacion,
      row_number() over (partition by id_usuario order by fecha_entrega asc, id_postulacion asc) as rn
    from eventos
    where tiene_resena and mes_cierre = p_mes
  ),
  -- Reseñadoras que pagaron el pozo de Reseñadores Premium este mes.
  premium_pagante as (
    select id_usuario
    from public.resenadores_premium
    where "mes_año" <= p_mes and pagado = true group by id_usuario
  ),
  puntaje_por_postulacion as (
    select
      e.id_usuario,
      case
        when e.tiene_resena and e.a_tiempo then
          case when pr.rn = 1 and pp.id_usuario is not null then 200 else 100 end
        when e.tiene_resena and not e.a_tiempo then
          case when pr.rn = 1 and pp.id_usuario is not null then 80 else 40 end
        when e.incumplida then -100
        when e.anulada_sin_avance then -40
        when e.estado = 'abandonada' then -40
        else 0
      end as pts_cumplimiento,
      case when e.tiene_resena and e.a_tiempo then 1 else 0 end as es_a_tiempo,
      case when e.tiene_resena and not e.a_tiempo then 1 else 0 end as es_tarde,
      case when not e.tiene_resena and e.incumplida then 1 else 0 end as es_incumplida,
      case when not e.tiene_resena and not e.incumplida and (e.anulada_sin_avance or e.estado = 'abandonada') then 1 else 0 end as es_anulada,
      -- Calificación del autor: (nota - 3) x 20, de -40 (nota 1) a +40 (nota 5), con decimales.
      case when e.tiene_resena and e.nota_autor is not null then (e.nota_autor - 3) * 20 else 0 end as pts_calificacion,
      case when e.tiene_resena then e.nota_autor else null end as nota_autor
    from eventos e
    left join primera_resena_mes pr on pr.id_postulacion = e.id_postulacion and pr.rn = 1
    left join premium_pagante pp on pp.id_usuario = e.id_usuario
    where e.mes_cierre = p_mes
  ),
  agregado_cumplimiento as (
    select
      id_usuario,
      sum(pts_cumplimiento + pts_calificacion) as puntaje_cumplimiento,
      sum(es_a_tiempo)::int as resenas_a_tiempo,
      sum(es_tarde)::int as resenas_tarde,
      sum(es_incumplida)::int as incumplidas,
      sum(es_anulada)::int as anuladas,
      avg(nota_autor) as nota_promedio
    from puntaje_por_postulacion
    group by id_usuario
  ),
  secretos as (
    select
      pl.id_usuario,
      least(
        coalesce(sum(pl.puntos_otorgados) filter (where pl.tipo_accion = 'evento_secreto_encontrado'), 0),
        50
      )
      + coalesce(sum(pl.puntos_otorgados) filter (where pl.tipo_accion = 'correccion_limite_secretos'), 0) as pts_secretos
    from public.puntos_log pl
    join public.usuarios u on u.id = pl.id_usuario and u.rol = 'reseñador'
    where pl."mes_año" = p_mes
      and pl.tipo_accion in ('evento_secreto_encontrado', 'correccion_limite_secretos')
    group by pl.id_usuario
  ),
  otros_eventos as (
    select
      pl.id_usuario,
      sum(pl.puntos_otorgados) as pts_otros
    from public.puntos_log pl
    join public.usuarios u on u.id = pl.id_usuario and u.rol = 'reseñador'
    where pl."mes_año" = p_mes
      and pl.tipo_accion in ('evento_reto_completado', 'evento_completado', 'reconexion', 'regalo_admin')
    group by pl.id_usuario
  ),
  gamificacion as (
    select
      coalesce(s.id_usuario, o.id_usuario) as id_usuario,
      coalesce(s.pts_secretos, 0) + coalesce(o.pts_otros, 0) as puntaje_gamificacion
    from secretos s
    full outer join otros_eventos o on o.id_usuario = s.id_usuario
  ),
  combinado as (
    select
      coalesce(ac.id_usuario, g.id_usuario) as id_usuario,
      coalesce(ac.puntaje_cumplimiento, 0) as puntaje_cumplimiento,
      coalesce(ac.resenas_a_tiempo, 0) as resenas_a_tiempo,
      coalesce(ac.resenas_tarde, 0) as resenas_tarde,
      coalesce(ac.incumplidas, 0) as incumplidas,
      coalesce(ac.anuladas, 0) as anuladas,
      ac.nota_promedio,
      coalesce(g.puntaje_gamificacion, 0) as puntaje_gamificacion,
      coalesce(ac.puntaje_cumplimiento, 0) + coalesce(g.puntaje_gamificacion, 0) as puntaje_total
    from agregado_cumplimiento ac
    full outer join gamificacion g on g.id_usuario = ac.id_usuario
  )
  select
    c.id_usuario,
    u.alias,
    c.puntaje_cumplimiento,
    c.resenas_a_tiempo,
    c.resenas_tarde,
    c.incumplidas,
    c.anuladas,
    -- Obsoleto: antes contaba los "SÍ" del autor. Se mantiene la columna (siempre 0)
    -- para no romper a quien consuma esta función.
    0 as criterios_si_total,
    c.puntaje_gamificacion,
    c.puntaje_total,
    row_number() over (
      order by c.puntaje_total desc, c.resenas_a_tiempo desc, c.nota_promedio desc nulls last, u.fecha_registro asc
    ) as posicion
  from combinado c
  join public.usuarios u on u.id = c.id_usuario
  where u.rol = 'reseñador'
  order by posicion;
$function$;
