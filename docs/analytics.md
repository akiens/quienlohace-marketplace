# Registro de métricas

Implementación inicial del contrato descrito en `docs/todo/metrics-plan.md`.

## Puesta en marcha

1. Crear la D1 separada: `npx wrangler d1 create quienlohace-analytics` y reemplazar el UUID nulo de `wrangler.jsonc`.
2. Crear el bucket privado: `npx wrangler r2 bucket create quienlohace-analytics-raw`.
3. Crear un secreto aleatorio de al menos 32 bytes (`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`). En desarrollo se guarda como `ANALYTICS_SESSION_SECRET` en `.dev.vars`; en producción se configura con `npx wrangler secret put ANALYTICS_SESSION_SECRET`.
4. Aplicar `npm run analytics:migrate:local` o `npm run analytics:migrate:remote`.
5. Guardar `ANALYTICS_JOB_TOKEN` como secreto y programar un POST periódico a `/api/jobs/analytics-maintenance` con `Authorization: Bearer …`.
6. Revisar y aprobar la base jurídica y el texto público de privacidad antes de habilitar producción. `ANALYTICS_ENABLED=false` apaga la ingesta del backend; `NEXT_PUBLIC_ANALYTICS_ENABLED=false` debe incorporarse al build para apagar también el colector y descartar su cola.

`ANALYTICS_DB` nunca se comparte con la D1 de negocio y `ANALYTICS_RAW` no se sirve desde `/media`.
La configuración incluida mantiene `ANALYTICS_ENABLED=false` hasta que D1, R2, las migraciones y el secreto estén disponibles. Aunque la bandera se active por error, la captura se deshabilita automáticamente si falta `ANALYTICS_DB`.

## Contrato v1

Todos los eventos llevan ID, versión de contrato/colector/políticas, fecha UTC de ocurrencia, secuencia y reloj monotónico, origen, sesión, pestaña y contexto de vista aplicable. Los IDs de entidad se guardan como columnas; `properties_json` sólo contiene el objeto estricto correspondiente al evento.

| Evento | Disparador | Propiedades específicas |
| --- | --- | --- |
| `page_view` | Vista pública visible | tipo de ruta, origen conocido |
| `page_activity` | Cambio de ruta, ocultación o salida | ms visibles/activos, secuencia |
| `visibility_changed` | visible/oculto | estado y causa observable |
| `scroll_milestone` | primera llegada a 25/50/75/90% | porcentaje y rango de altura |
| `search_submitted` | respuesta aplicada visible | filtros completos y motivo |
| `search_filter_applied` | búsqueda resultante de cambiar filtros | campos y estados antes/después |
| `search_results_viewed` | resultado concreto presentado | totales y cantidad presentada |
| `list_viewed` | lista presentada | tipo y cantidad |
| `result_impression` | 50% visible por 1 segundo continuo | posición y tipo |
| `result_clicked` | enlace de perfil/carta | acción, posición, existencia de impresión |
| `contact_clicked` | WhatsApp/teléfono/email | canal, sin URL/teléfono/mensaje |

El schema admite además secciones, galería y resumen de entrega para ampliar las superficies sin cambiar el sobre común. Eventos de servidor de búsqueda se guardan en `analytics_search_executions`, el conjunto ordenado en `analytics_result_sets/items` y sus atributos estructurados en snapshots versionados.

## Privacidad y retención

- No se persisten IP, coordenadas, fingerprint, URLs de contacto, teléfonos, emails, mensajes, teclas, coordenadas del puntero, DOM, textos de perfil ni stacks.
- País/región aproximados sólo se aceptan desde metadata de Cloudflare.
- El endpoint exige una sesión anónima firmada, valida tamaño, cardinalidad, origen, frecuencia, secuencias, ventanas temporales y la relación carta–servicio–perfil contra la base de negocio. El token vive en `sessionStorage`, se verifica en memoria y nunca se persiste en D1 ni R2.
- Una frase con patrón de email, URL, teléfono o documento se elimina completa. Las demás frases viven en `analytics_search_queries`, separadas del evento central, durante siete días.
- Antes de vencer, el job conserva sólo frases con al menos diez sesiones por día en `analytics_daily_query_terms`; los grupos raros desaparecen.
- El job archiva NDJSON gzip en R2 con checksum/manifiesto verificado. Cada línea declara `recordType` e incluye sesiones, segmentos, eventos, ejecuciones, conjuntos, ocurrencias y snapshots relacionados. D1 caliente se purga a los 14 días sólo después de archivar; R2 y sus manifiestos vencen a los 90 días.

## Verificación

```sh
npm run check:analytics
npm run typecheck
npm run lint
```

Consultas rápidas:

```sql
SELECT event_name, COUNT(*) FROM analytics_events GROUP BY event_name;
SELECT capture_status, COUNT(*) FROM analytics_search_queries GROUP BY capture_status;
SELECT status, COUNT(*), SUM(event_count) FROM analytics_archive_manifests GROUP BY status;
SELECT result_set_id, position, result_kind, provider_profile_id, service_card_id
FROM analytics_result_items ORDER BY result_set_id, position;
```

La bandera de apagado, el job y el secreto deben verificarse también en el preview Cloudflare. Un clic de contacto es una intención observada, no una conversación ni una venta.
