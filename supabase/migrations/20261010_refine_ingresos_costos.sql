-- Refine en Ingresos y Costos (control de pagos del admin)
-- 1) Ingresos: los combos pack + Refine dicen "+ Refine" en el detalle (el cobro ya entraba por campana_creditos al precio combo).
-- 2) Costos: nueva categoría 'refine' = lo que se le paga al diseñador por cada revisión de portada / informe editorial ENTREGADO.

create or replace view public.v_ingresos as
 SELECT pl.id::text AS id_origen, pl.fecha, 'suscripcion'::text AS categoria,
    'Suscripción '::text || initcap(COALESCE(s.plan, ''::text)) AS detalle, s.id_usuario,
    CASE WHEN pl.estado = 'completado_manual_admin'::text THEN 'manual'::text
         WHEN pl.paypal_payment_id IS NOT NULL OR s.proveedor_pago = 'paypal'::text THEN 'paypal'::text
         ELSE 'mercadopago'::text END AS proveedor,
    COALESCE(s.moneda, CASE WHEN pl.paypal_payment_id IS NOT NULL THEN 'USD'::text ELSE 'ARS'::text END) AS moneda,
    pl.monto AS bruto
   FROM pagos_log pl LEFT JOIN suscripciones s ON s.id = pl.id_suscripcion
  WHERE (pl.estado = ANY (ARRAY['approved'::text, 'completed'::text, 'completado_manual_admin'::text])) AND pl.monto > 0::numeric
UNION ALL
 SELECT cc.id::text AS id_origen, cc.pagado_en AS fecha, 'campana'::text AS categoria,
    (CASE WHEN cc.origen = 'pack'::text THEN ((('Pack '::text ||
            CASE COALESCE(cc.regalo_plan, ''::text) WHEN 'complete'::text THEN 'Premium'::text WHEN 'impulso'::text THEN 'Basic'::text ELSE ''::text END)
            || ' ('::text) || cc.cantidad_total) || ' campañas)'::text
          ELSE 'Campaña individual'::text END)
      || CASE WHEN cc.incluye_refine THEN ' + Refine'::text ELSE ''::text END AS detalle,
    cc.id_usuario_autor AS id_usuario,
    CASE WHEN cc.google_play_order_id IS NOT NULL THEN 'google_play'::text
         WHEN cc.proveedor_pago = ANY (ARRAY['paypal'::text, 'mercadopago'::text]) THEN cc.proveedor_pago
         WHEN cc.paypal_order_id IS NOT NULL THEN 'paypal'::text
         ELSE 'mercadopago'::text END AS proveedor,
    cc.moneda, cc.precio_unitario AS bruto
   FROM campana_creditos cc
  WHERE cc.estado = 'pagado'::text AND cc.precio_unitario > 0::numeric AND cc.pagado_en IS NOT NULL
UNION ALL
 SELECT ic.id::text AS id_origen, COALESCE(ic.pagado_en, ic.fecha_activacion, ic.creado_en) AS fecha, 'impulso'::text AS categoria,
    CASE WHEN ic.plan = 'impulso'::text THEN 'Impulso'::text ELSE 'Impulso '::text || initcap(COALESCE(ic.plan, ''::text)) END
      || COALESCE(' · '::text || c.nombre_libro, ''::text) AS detalle,
    ic.id_usuario_autor AS id_usuario,
    CASE WHEN ic.google_play_order_id IS NOT NULL THEN 'google_play'::text
         WHEN ic.proveedor_pago = ANY (ARRAY['paypal'::text, 'mercadopago'::text]) THEN ic.proveedor_pago
         WHEN ic.paypal_order_id IS NOT NULL THEN 'paypal'::text
         WHEN ic.mp_preference_id IS NOT NULL THEN 'mercadopago'::text
         WHEN ic.moneda = 'USD'::text THEN 'paypal'::text
         ELSE 'mercadopago'::text END AS proveedor,
    ic.moneda, ic.monto_a_pagar AS bruto
   FROM impulsos_campana ic LEFT JOIN campanas c ON c.id = ic.id_campana
  WHERE ic.estado = 'pagado'::text AND ic.monto_a_pagar > 0::numeric
UNION ALL
 SELECT rp.id::text AS id_origen, COALESCE(rp.fecha_pago, rp.creado_en) AS fecha, 'resenador_premium'::text AS categoria,
    'Reseñador Premium '::text || rp."mes_año" AS detalle, rp.id_usuario,
    CASE WHEN rp.google_play_order_id IS NOT NULL THEN 'google_play'::text
         WHEN rp.proveedor_pago = ANY (ARRAY['paypal'::text, 'mercadopago'::text]) THEN rp.proveedor_pago
         WHEN rp.paypal_order_id IS NOT NULL THEN 'paypal'::text
         WHEN COALESCE(rp.moneda, 'USD'::text) = 'USD'::text THEN 'paypal'::text
         ELSE 'mercadopago'::text END AS proveedor,
    COALESCE(rp.moneda, 'USD'::text) AS moneda, rp.monto AS bruto
   FROM resenadores_premium rp
  WHERE rp.pagado AND rp.monto > 0::numeric;

create or replace view public.v_costos as
 SELECT cb.id::text AS id_origen, cb.fecha,
    CASE cb.ubicacion WHEN 'feed'::text THEN 'banner_feed'::text ELSE 'banner_resenador'::text END AS categoria,
    CASE cb.ubicacion WHEN 'feed'::text THEN 'Banner del feed'::text ELSE 'Banner del panel reseñador'::text END
      || COALESCE(' · '::text || c.nombre_libro, ''::text) AS detalle,
    cb.monto_usd
   FROM costos_banner cb LEFT JOIN campanas c ON c.id = cb.id_campana
UNION ALL
 SELECT vv.id::text AS id_origen, vv.creado_en AS fecha, 'vendedor'::text AS categoria,
    (('Comisión vendedor · '::text || COALESCE(vv.producto, ''::text)) || ' · '::text)
      || COALESCE(NULLIF(TRIM(BOTH FROM (COALESCE(u.nombre, ''::text) || ' '::text) || COALESCE(u.apellido, ''::text)), ''::text), u.alias, v.codigo, '—'::text) AS detalle,
    n.usd_por_venta AS monto_usd
   FROM vendedor_ventas vv
     JOIN ( SELECT vendedor_ventas.id_vendedor, vendedor_ventas.mes, count(*)::integer AS cant
              FROM vendedor_ventas WHERE vendedor_ventas.anulada_en IS NULL
             GROUP BY vendedor_ventas.id_vendedor, vendedor_ventas.mes) t ON t.id_vendedor = vv.id_vendedor AND t.mes = vv.mes
     JOIN vendedores_niveles n ON t.cant >= n.desde_ventas AND (n.hasta_ventas IS NULL OR t.cant <= n.hasta_ventas)
     LEFT JOIN usuarios u ON u.id = vv.id_vendedor
     LEFT JOIN vendedores v ON v.id_usuario = vv.id_vendedor
  WHERE vv.anulada_en IS NULL
UNION ALL
 SELECT (cf.id::text || '-'::text) || to_char(m.mes, 'YYYY-MM'::text) AS id_origen,
    ((m.mes + '12:00:00'::interval) AT TIME ZONE 'America/Argentina/Buenos_Aires'::text) AS fecha,
    'gasto_fijo'::text AS categoria, cf.nombre || ' · mensual'::text AS detalle, cf.monto_usd
   FROM costos_fijos cf
     CROSS JOIN LATERAL generate_series(to_date(cf.desde_mes || '-01'::text, 'YYYY-MM-DD'::text)::timestamp without time zone,
        LEAST(COALESCE(to_date(cf.hasta_mes || '-01'::text, 'YYYY-MM-DD'::text), date_trunc('month'::text, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text))::date),
              date_trunc('month'::text, (now() AT TIME ZONE 'America/Argentina/Buenos_Aires'::text))::date)::timestamp without time zone, '1 mon'::interval) m(mes)
UNION ALL
 SELECT a.id::text AS id_origen, a.entregado_en AS fecha, 'refine'::text AS categoria,
    'Refine · '::text || CASE a.tipo WHEN 'revision_portada'::text THEN 'Revisión de portada'::text ELSE 'Informe editorial'::text END
      || COALESCE(' · '::text || a.nombre_libro, ''::text) AS detalle,
    a.monto_usd
   FROM vis_disenador_asignaciones a
  WHERE a.entregado AND a.tipo = ANY (ARRAY['revision_portada'::text, 'informe_editorial'::text]);
