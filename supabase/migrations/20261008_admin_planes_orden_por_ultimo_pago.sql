-- Planes (admin): las listas de Pagos e Impulsos quedan ordenadas por la
-- fecha del ÚLTIMO PAGO (pagado_en). Si todavía está pendiente, usa la fecha
-- de creación/solicitud. Así, un pendiente que se paga días después sube
-- arriba de todo. También se devuelve la fecha de pago para mostrarla.

create or replace function public.admin_listar_compras_campanas()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not es_admin() then
    return jsonb_build_object('error', 'No tenés permisos para realizar esta acción.');
  end if;

  return jsonb_build_object(
    'compras', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'idCompra', cc.id,
        'email', u.email,
        'autor', coalesce(nullif(u.alias, ''), u.nombre),
        'paquete', case
                     when cc.origen = 'individual' then 'individual'
                     when cc.cantidad_total = 3 then 'basic'
                     when cc.cantidad_total = 5 then 'premium'
                     else 'pack'
                   end,
        'estado', case cc.estado
                    when 'pagado' then 'aprobado'
                    when 'rechazado' then 'cancelado'
                    else 'pendiente'
                  end,
        'monto', cc.precio_unitario,
        'moneda', cc.moneda,
        'proveedor', cc.proveedor_pago,
        'cantidadTotal', cc.cantidad_total,
        'cantidadUsada', cc.cantidad_usada,
        'fechaCreacion', cc.creado_en,
        'fechaPago', cc.pagado_en,
        'libros', (
          select coalesce(jsonb_agg(ca.nombre_libro order by ca.creado_en), '[]'::jsonb)
          from campanas ca
          where ca.id_credito_consumido = cc.id
        )
      ) order by coalesce(cc.pagado_en, cc.creado_en) desc), '[]'::jsonb)
      from campana_creditos cc
      join usuarios u on u.id = cc.id_usuario_autor
      where cc.origen in ('individual', 'pack')
    ),
    'creditos', (
      select coalesce(jsonb_agg(x.fila order by x.disponibles desc, x.email), '[]'::jsonb)
      from (
        select
          u.email,
          sum(cc.cantidad_total - cc.cantidad_usada) as disponibles,
          jsonb_build_object(
            'email', u.email,
            'autor', coalesce(nullif(u.alias, ''), u.nombre),
            'disponibles', sum(cc.cantidad_total - cc.cantidad_usada)
          ) as fila
        from campana_creditos cc
        join usuarios u on u.id = cc.id_usuario_autor
        where cc.estado = 'pagado'
          and cc.cantidad_usada < cc.cantidad_total
        group by u.id, u.email, u.alias, u.nombre
      ) x
    )
  );
end;
$function$;

create or replace function public.admin_listar_impulsos()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not es_admin() then
    return jsonb_build_object('error', 'No tenés permisos para realizar esta acción.');
  end if;

  return jsonb_build_object('impulsos', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'idCampana', i.id_campana,
      'plan', i.plan,
      'nombreLibro', c.nombre_libro,
      'cuposDisponibles', c.cupos_disponibles,
      'aliasAutor', u.alias,
      'emailAutor', u.email,
      'moneda', i.moneda,
      'precioLista', i.precio_lista,
      'creditosAplicados', i.creditos_aplicados,
      'montoAPagar', i.monto_a_pagar,
      'estado', i.estado,
      'fechaSolicitud', i.fecha_solicitud,
      'fechaActivacion', i.fecha_activacion,
      'fechaPago', i.pagado_en,
      'fechaFinSlider', i.fecha_fin_slider,
      'proveedorPago', i.proveedor_pago,
      'mensajeIgEnviado', i.mensaje_ig_enviado
    ) order by coalesce(i.pagado_en, i.fecha_solicitud) desc), '[]'::jsonb)
    from impulsos_campana i
    join campanas c on c.id = i.id_campana
    join usuarios u on u.id = i.id_usuario_autor
  ));
end;
$function$;

create or replace function public.admin_listar_suscripciones()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not es_admin() then
    return jsonb_build_object('error', 'No tenés permisos para realizar esta acción.');
  end if;

  return jsonb_build_object('suscripciones', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'email', u.email,
      'plan', s.plan,
      'estado', s.estado,
      'monto', s.monto,
      'moneda', s.moneda,
      'proveedorPago', s.proveedor_pago,
      'fechaCreacion', s.fecha_creacion,
      'fechaProximoPago', s.fecha_proximo_pago,
      'fechaCancelacion', s.fecha_cancelacion,
      'ultimoPago', (
        select jsonb_build_object(
          'monto', pl.monto,
          'estado', pl.estado,
          'fecha', pl.fecha
        )
        from pagos_log pl
        where pl.id_suscripcion = s.id
        order by pl.fecha desc
        limit 1
      )
    ) order by coalesce(
        (select max(pl2.fecha) from pagos_log pl2 where pl2.id_suscripcion = s.id),
        s.fecha_creacion
      ) desc), '[]'::jsonb)
    from suscripciones s
    join usuarios u on u.id = s.id_usuario
  ));
end;
$function$;
