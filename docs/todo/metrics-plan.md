# Plan de captura de datos para métricas del marketplace

Estado: propuesta de arquitectura y contratos; no implementada. Actualizado: 2026-09-10.

## 1. Alcance

Construir una base de eventos detallados, vinculados y versionados que permita elaborar después métricas, informes y recomendaciones para proveedores, servicios y el marketplace.

El entregable de esta etapa es la captura, persistencia, exportación, documentación y verificación del dato. No incluye dashboards, pantallas de estadísticas, reparto de métricas entre planes ni cambios automáticos del ranking.

Capturar el mismo catálogo permitido para proveedores de todos los planes. El plan comercial del momento es una dimensión histórica; los permisos para consumir métricas se resolverán cuando se construyan esas features.

**Raw significa hechos individuales con contexto suficiente para reprocesarlos.** Se valida y minimiza la entrada antes de persistir. No significa un objeto libre con todo lo que contiene el navegador. No reemplazar los eventos originales por contadores predeterminados: perderíamos la posibilidad de hacer preguntas nuevas.

Principios:

- Guardar la acción, su objeto, su origen y la versión del contexto observado.
- Diferenciar lo solicitado, lo entregado, lo mostrado, lo visto y lo activado.
- Conservar relaciones explícitas; no reconstruirlas a partir de nombres o proximidad temporal.
- Distinguir observaciones del cliente, hechos confirmados por servidor e inferencias posteriores.
- Admitir datos faltantes, duplicados, retrasos y pérdida de captura.
- Mantener evolución de esquema, eliminación, control de acceso y calidad desde el inicio.

## 2. Qué preguntas debe permitir responder

Estas preguntas orientan los datos a capturar; no son pantallas que haya que implementar ahora.

| Destinatario / objetivo | Preguntas futuras | Datos que necesitamos hoy |
| --- | --- | --- |
| Proveedor general | ¿Me encuentran? ¿Desde dónde? ¿Por qué especialidades? ¿Visitan mi perfil y contactan? | Búsqueda, resultado entregado, impresión, posición, vista, contacto, origen |
| Servicio del proveedor | ¿Qué servicio atrae demanda? ¿Cuáles de mis ofertas funcionan mejor? | Servicio concreto, cartas vinculadas, contexto de búsqueda, exposición y contactos directos/asistidos |
| Oferta concreta | ¿Cambió el interés al cambiar precio, modalidad, imágenes o título? | Versiones de oferta y contenido, precio mostrado, exposición y actividad antes/después |
| Cobertura | ¿En qué localidades buscan mi servicio? ¿Hay demanda fuera de mi cobertura? | Ubicación solicitada, especialidad/intención, cobertura histórica y oferta disponible |
| Presentación | ¿Se ven mis precios, reseñas, fotos y contactos? ¿Dónde deja de interactuar la gente? | Exposición de secciones, interacción, tiempo activo, salida/cambio de vista |
| Mercado | ¿Qué combinaciones de servicio, zona y modalidad tienen demanda sin resultados? | Búsquedas aplicadas, interpretación, conteos, fallos, disponibilidad histórica |
| Buscador | ¿Qué filtros llevan a cero resultados? ¿Qué se reformula? ¿Influye la posición? | Cambios aplicados, cadena de búsquedas, ranking versionado, impresiones/clics |
| Adquisición | ¿Qué canales traen sesiones que terminan en contacto? | Origen/campaña permitidos, primera vista, secuencia de eventos y contactos |
| Experiencia | ¿Dónde se abandona? ¿Qué problemas hay en móvil? | Navegación observada, dispositivo general, actividad, latencias y errores tipados |
| Calidad | ¿Cuánto es tráfico propio, repetido, sospechoso o incompleto? | Origen del evento, versión de captura, exclusiones y contadores de entrega |

Los patrones permiten formular hipótesis. Un aumento de contactos después de cambiar el precio no prueba causalidad; registrar experimentos y su asignación si luego se hacen pruebas controladas.

## 3. Identidad de negocio: proveedor, servicio y carta

El código actual distingue:

| Campo analítico | Entidad existente | Significado |
| --- | --- | --- |
| `provider_profile_id` | `profiles.id` | Perfil público del proveedor; en los resultados actuales corresponde a `providerId` |
| `profile_service_id` | `services.id` / `ProfileService.id` | Servicio concreto declarado por ese proveedor |
| `service_card_id` | `service_cards.id` | Oferta/carta de ese servicio |
| `specialty_id` | Especialidad | Clasificación del servicio |
| `service_sector_id` | Rubro | Clasificación de la especialidad |
| `catalog_service_id` | `ServiceSuggestion.id` | Concepto del catálogo; no es `services.id` |
| `location_id` | Ubicación canónica | País, departamento o localidad según el uso del campo |

Relación principal:

`perfil → servicio declarado → carta de servicio`

Relación de clasificación:

`rubro → especialidad → sugerencia de catálogo`

Un servicio declarado tiene una especialidad y un nombre confirmado por el proveedor. **No existe necesariamente una relación persistida entre ese servicio y una sugerencia del catálogo.** Los `serviceIds` de `SearchQueryPlan` son conceptos canónicos de búsqueda: no usarlos como IDs de servicios particulares.

Reglas:

1. Toda interacción con una carta incluye su perfil, servicio, especialidad y rubro, resueltos o comprobados por servidor.
2. Una interacción genérica con el perfil lleva `profile_service_id = null`, salvo que la persona haya seleccionado un servicio concreto. No repartir artificialmente una visita entre todos sus servicios.
3. Si la búsqueda coincide con varios servicios, guardar las coincidencias como una relación de varios elementos con tipo de evidencia. Eso no convierte el contacto genérico posterior en contacto directo para cada servicio.
4. La clasificación semántica futura de un servicio en el catálogo usa `mapping_version`, método y confianza. Conservar la relación observada original.
5. Los IDs no se reciclan. Los slugs y nombres son atributos que cambian, no claves de relación.
6. Como analítica tendrá almacenamiento separado, no habrá FK entre la D1 de negocio y la analítica. Se requiere validación y reconciliación de referencias, con histórico para entidades desactivadas.

## 4. Identificadores para reconstruir recorridos

| Identificador | Vida / función |
| --- | --- |
| `event_id` | Único por hecho; se conserva en reintentos |
| `batch_id` | Intento/lote de transporte; no sustituye la identidad del evento |
| `segment_id` | Bloque cerrado de captura con inicio/fin; conserva identidad al reenviarse |
| `session_id` | Sesión analítica por pestaña; 30 min sin interacción, máximo 24 h |
| `tab_id` | Distingue contextos de pestañas, incluidas pestañas duplicadas |
| `page_view_id` | Una vista pública observada; incluye restauraciones definidas |
| `previous_page_view_id` | Vista anterior conocida, sin inventarla cuando falta |
| `search_id` | Intención de búsqueda aplicada |
| `previous_search_id` | Reformulación conocida de una búsqueda anterior |
| `search_execution_id` | Ejecución concreta en servidor; puede haber varias por intención |
| `result_set_id` | Lista ordenada producida por una ejecución |
| `list_view_id` | Presentación concreta de una lista, también home/categorías |
| `result_item_id` | Ocurrencia de una entidad en esa lista/posición |
| `impression_id` | Exposición que cumple el umbral definido |
| `interaction_id` | Acción que inicia navegación/contacto; deduplica handlers |
| `source_interaction_id` | Vínculo conocido entre acción y vista destino |
| `entity_snapshot_id` | Versión de la entidad mostrada al usuario |

Estos IDs son internos al contrato. No poner identidad analítica persistente en URLs compartibles ni usar una cookie de autenticación como identidad analítica.

Propuesta base: sesión en `sessionStorage` al iniciar una vista pública instrumentada; separación efectiva de pestañas duplicadas, incluso si el navegador copia el almacenamiento inicial. `tab_id` se inicializa para la nueva pestaña y se verifica con coordinación entre pestañas. Rotación por interacción humana; un heartbeat no mantiene viva la sesión.

Una navegación en la misma pestaña puede transportar su contexto pendiente en memoria/almacenamiento de sesión. La vista destino consume el contexto sólo si coincide destino, vigencia y navegación esperada. Para enlaces abiertos en otra pestaña se puede observar la activación, pero el vínculo con la nueva vista puede faltar: guardar `attribution_status = unknown`; nunca correlacionar por IP o fingerprint.

Retorno en días diferentes queda fuera de la identidad base. El contrato admite `visitor_id` nullable para una posible extensión de reconocimiento entre visitas con vencimiento explícito y evaluación de privacidad propia; no se habilita en este alcance. Sin ese módulo se pueden reconstruir recorridos de sesión, no retención individual entre días ni personas únicas entre dispositivos.

## 5. Contrato común de evento

Persistir columnas comunes para buscar/relacionar y propiedades específicas validadas por evento.

| Grupo | Campos |
| --- | --- |
| Identidad/versiones | `event_id`, `event_name`, `schema_version`, `collector_version`, `app_release`, `environment` |
| Tiempo | `occurred_at`, `received_at`, `client_sequence`, `time_quality` |
| Origen del hecho | `source = browser/server`, `observation_kind` |
| Recorrido | IDs de sesión/pestaña/vista/búsqueda/lista/interacción aplicables |
| Objeto | `entity_type`, IDs de perfil/servicio/carta y snapshot aplicables |
| Contexto visual | `page_type`, `surface`, `component_id`, `placement`, `ui_version` |
| Contexto general | dispositivo general, origen, campaña permitida, geografía aproximada |
| Privacidad | `privacy_policy_version`, `capture_policy_version` |
| Calidad | `entity_resolution_status`, tráfico propio/interno/sospechoso, campos omitidos, tasa de muestreo |
| Propiedades | Objeto tipado por `event_name`; no `metadata` arbitraria |

Tiempos UTC ISO 8601. Ordenar dentro de una pestaña con secuencia y reloj monotónico local para duraciones; no asumir orden de recepción ni que relojes de distintos dispositivos son comparables. Un evento de servidor no necesita una secuencia de cliente.

Definir nulos y estados `unknown`, `not_applicable`, `redacted`, `not_collected` de forma distinguible. No interpretar ausencia de datos como cero o rechazo.

El servidor establece las marcas de confianza, recepción y calidad. No acepta como hechos verificados el plan, precio, propietario, conteo de resultados o calificación declarados por el navegador.

Ejemplo abreviado de un **registro persistido**, después de validación y enriquecimiento. Los IDs son simbólicos para facilitar lectura; la implementación usa los formatos del contrato. Los campos de servidor de este ejemplo no se aceptan como evidencia desde el navegador.

```json
{
  "event_id": "E-contact-1",
  "event_name": "contact_clicked",
  "schema_version": 1,
  "occurred_at": "2026-09-10T14:05:00.000Z",
  "received_at": "2026-09-10T14:05:00.250Z",
  "source": "browser",
  "observation_kind": "interaction",
  "session_id": "SESSION-1",
  "tab_id": "TAB-1",
  "page_view_id": "VIEW-card-1",
  "interaction_id": "CLICK-contact-1",
  "source_interaction_id": "CLICK-result-1",
  "search_id": "SEARCH-1",
  "result_set_id": "RESULTS-1",
  "result_item_id": "RESULTS-1-item-4",
  "entity_type": "service_card",
  "provider_profile_id": "PROFILE-2",
  "profile_service_id": "SERVICE-3",
  "service_card_id": "CARD-8",
  "entity_snapshot_id": "CARD-8-version-5",
  "page_type": "service_detail",
  "surface": "service_detail_contact",
  "capture_policy_version": 1,
  "entity_resolution_status": "verified",
  "properties": {
    "channel": "whatsapp",
    "action": "open_contact_link"
  }
}
```

La consulta posterior relaciona este hecho con criterios de `SEARCH-1`, posición y exposición de `RESULTS-1-item-4`, precio/modalidad de `CARD-8-version-5` y servicio/perfil correspondientes. El raw guarda las referencias; no duplica todo ese contenido en cada clic.

## 6. Catálogo de captura

### 6.1 Navegación y actividad

| Evento | Disparador | Propiedades |
| --- | --- | --- |
| `page_view` | Vista pública completada y visible | Tipo de ruta, destino de negocio, vista anterior, origen de navegación |
| `page_activity` | Intervalo acotado de actividad | Milisegundos visibles, milisegundos activos estimados, secuencia |
| `visibility_changed` | Paso visible/oculto | Estado y motivo conocido; nunca suponer cierre |
| `scroll_milestone` | Primera llegada a 25/50/75/90% | Porcentaje, altura del contenido por rango, vista |
| `section_impression` | Sección relevante visible según umbral | Código de sección, entidad, duración umbral |
| `section_action` | Expandir/contraer/seleccionar un bloque | Código de sección y acción |
| `navigation_error` | Error de navegación observable | Código permitido, tipo de destino, sin URL ni stack libres |

Secciones: presentación, servicios, precios, modalidades, cobertura, horarios, medios de pago, galería, reseñas y contactos, cuando existan. No capturar todos los elementos DOM ni cada píxel de scroll.

Tiempo activo: documento visible y actividad humana reciente en los últimos 60 segundos; acumular intervalos con reloj monotónico. La interacción sólo renueva un reloj, sin guardar teclas ni coordenadas del puntero. Pausar en ocultación y reanudar sin sumar ausencia. Documentar que leer sin interactuar puede subestimarse.

No hay un evento confiable de «cerró el navegador». El fin de sesión se infiere por inactividad; una última vista observada no prueba abandono voluntario. Una salida a WhatsApp puede ser el objetivo cumplido.

### 6.2 Búsqueda, filtros y descubrimiento

| Evento | Disparador | Propiedades |
| --- | --- | --- |
| `search_submitted` | Aplicar una intención | Criterios, motivo, búsqueda anterior |
| `search_filter_applied` | Aplicar/quitar/limpiar filtros | Campos cambiados, valores permitidos antes/después, mismo `search_id` del envío |
| `search_executed` | Servidor termina ejecución autorizada | Interpretación permitida, conteos, duración, ranking, estado |
| `search_results_viewed` | Cliente muestra respuesta concreta | Conjunto de resultados, listado, cantidad presentada |
| `search_suggestion_impression` | Sugerencia visible | ID/tipo/posición de sugerencia, contexto |
| `search_suggestion_selected` | Activar sugerencia/corrección | ID/tipo/posición y nueva intención |
| `search_page_changed` | Paginación/cargar más, si existe | Página/cursor opaco interno, tamaño, lista |
| `search_sort_changed` | Cambio de orden, si existe | Orden anterior/nuevo y contexto |
| `search_failed` | Falla observable | Etapa y código permitido, duración |
| `category_selected` | Explorar rubro/especialidad | IDs y superficie origen |
| `location_selected` | Aplicar zona solicitada | IDs permitidos y fuente manual/geolocalización funcional |

`search_filter_applied` explica una intención; no sumar ese evento y `search_submitted` como dos búsquedas. No almacenar cada edición del borrador. Capturar ejecuciones server con vínculo a analítica según la política de captura automática definida; mantener telemetría operativa de fallos separada.

Guardar todos los **criterios aplicados y autorizados** del `SearchFilters` actual:

- `resultKinds`, `locationIds`, `specialtyIds`, `minRating`, `paymentMethods`, `serviceModes`, `useMyLocation`.
- Estado de consulta textual conforme a la sección 10.
- Orden, paginación y tamaño de página si se incorporan; no inventar filtros aún inexistentes.
- Versión del normalizador, interpretación, IDs canónicos reconocidos, modalidad inferida, estado de corrección, versión del catálogo.
- Totales de resultados y proveedores; cantidades por tipo; tiempo de ejecución.
- Qué filtros son explícitos y qué criterios fueron inferidos por el buscador.

`locationIds` indica dónde se solicita el trabajo; puede conservar localidad seleccionada de catálogo bajo la política definida. No equivale al domicilio o la ubicación física del visitante. Geografía de origen y cobertura de oferta se guardan por separado.

No serializar entero `SearchQueryPlan`: contiene `original`, `normalized`, frases y otros derivados del texto que también podrían revelar datos sensibles. Exportar solamente campos permitidos. Registrar categorías sensibles a menor detalle o suprimirlas.

### 6.3 Listados, exposición y selección

| Evento / hecho | Qué representa |
| --- | --- |
| `result_set_created` y sus filas | Lista ordenada que produjo el servidor, con IDs y versiones |
| `list_viewed` | Lista/página efectivamente presentada por el cliente |
| `result_impression` | Resultado con al menos 50% visible durante 1 segundo continuo |
| `result_clicked` | Activación de enlace de resultado, incluso teclado |
| `result_action` | Acción específica de tarjeta: perfil, detalle, contacto o expansión |

Guardar por resultado: `result_item_id`, tipo, IDs de entidad, snapshot, posición absoluta y en página, página, `surface`, versión del ranking, versión UI, tipo de colocación orgánica/promocionada/rotativa y razones de coincidencia estructuradas cuando existan.

El hecho server permite saber qué se ofreció a mostrar; no es una impresión. Tampoco contar precargas, renders ni resultados fuera del área visible como exposición. Guardar cantidad total y el subconjunto entregado; explicitar si se truncó el registro de candidatos. No almacenar todos los candidatos descartados por el motor en el flujo ordinario; un diagnóstico muestreado puede guardar motivos de descarte por código.

Una impresión por `(list_view_id, result_item_id)` en la versión inicial. La misma entidad en otra lista o posición tiene otra ocurrencia. Los clics llevan la ocurrencia exacta y `impression_id` si llegó a existir; un clic muy rápido puede ocurrir antes del segundo exigido para impresión. Ese clic es válido, pero no debe forzarse una impresión falsa.

Deduplicar handlers de enlace/tarjeta mediante `interaction_id`. No emitir dos clics de negocio por propagación del mismo evento.

### 6.4 Perfil, servicio y contenido

Las vistas de detalle son `page_view` con entidad; no sumar otro `profile_view` o `service_view` sobre el mismo hecho.

| Evento | Datos específicos |
| --- | --- |
| `profile_service_selected` | Perfil y servicio concreto seleccionado, especialidad, posición |
| `service_card_selected` | Carta, servicio y perfil; origen perfil/búsqueda/relacionados |
| `provider_profile_selected` | Perfil destino y carta/servicio de origen si corresponde |
| `gallery_opened` | Entidad, versión del conjunto de imágenes |
| `gallery_item_viewed` | ID interno de imagen/versionado, posición; sin URL |
| `reviews_interacted` | Abrir, ordenar o paginar reseñas; sin texto ni identidad de autores |
| `coverage_interacted` | Abrir cobertura, seleccionar ubicación pública permitida |
| `schedule_interacted` | Expandir horarios; ID de versión, sin volcar texto libre |
| `share_initiated` | Entidad y canal permitido |
| `link_copied` | Confirmación de copia del enlace público, sin URL en el payload |

Sólo instrumentar acciones que la UI realmente ofrece. Compartir iniciado no garantiza que el contenido se envió. Si se agregan favoritos o comparador, registrar altas/bajas y entidades, con una finalidad e identidad compatibles.

### 6.5 Contacto

| Evento | Qué sabemos |
| --- | --- |
| `contact_option_impression` | El botón/canal de contacto llegó a verse |
| `contact_clicked` | Se activó WhatsApp/teléfono/email/web/red social |
| `contact_copy_succeeded` | Se copió un dato de contacto mediante control del sitio, si existe |
| `contact_form_started` | Se empezó un formulario futuro; sin contenidos |
| `contact_form_submitted` | Intención de envío |
| `contact_form_accepted` | Backend aceptó la solicitud |
| `contact_delivery_confirmed` | Confirmación real de entrega por el sistema, si existe |
| `contact_form_failed` | Código permitido de fallo, nunca mensaje o valores del formulario |

Todos incluyen entidad y origen exactos, canal, `interaction_id`, snapshot y contexto de lista/búsqueda disponible.

En WhatsApp no guardar URL, teléfono ni mensaje prellenado. Un clic no confirma mensaje, conversación o contratación. Separar estrictamente intenciones browser de hechos server. Los eventos de formulario/entrega son puntos de extensión; no se emiten como si ya existiera ese sistema.

### 6.6 Estado de oferta y cambios de negocio

Capturar desde backend tras confirmar cambios, no leyendo sólo el estado actual meses después:

- Perfil publicado, desactivado, suspendido o reactivado.
- Servicio declarado agregado, editado, activado o desactivado.
- Carta publicada, modificada, retirada o desactivada.
- Cambio de precio, modalidad, duración, cobertura, disponibilidad declarada, medios de pago y contenido público.
- Cambio de plan efectivo, verificación o elegibilidad para colocación.
- Asignación de experimento y exposición a variante, cuando exista.

Guardar `entity_state_changed` con entidad, snapshot anterior/nuevo, campos modificados por código, tiempo efectivo y versión de origen. Sin correo, documentos, razones privadas de moderación ni credenciales.

Esto alimenta el análisis de oferta y permite reconocer que la caída de visitas coincidió con una despublicación. Es telemetría de negocio con política propia; no exige rastrear los formularios privados del dashboard. El historial de auditoría regulado por TR-038 sigue siendo independiente.

Para garantizar coherencia, una futura integración de cambios confirmados usa una outbox en la base de negocio dentro de la misma transacción y un despachador idempotente. No afirmar que una escritura de negocio y otra en D1 analítica son atómicas entre bases.

### 6.7 Rendimiento y calidad técnica

Eventos permitidos: `performance_sample`, `client_error`, `analytics_delivery_summary`.

Guardar tiempos de búsqueda/navegación, familias de error, versión del código y rangos generales de dispositivo/red cuando estén disponibles. Errores y rutas se codifican con listas permitidas; no enviar stacks ni mensajes libres que puedan contener datos.

Captura de exposición, búsquedas y contactos al 100% de las sesiones habilitadas como objetivo. Rendimiento y señales secundarias pueden muestrearse de manera determinista por sesión; registrar `sample_rate` y versión. No mezclar una muestra con denominadores sin muestreo.

## 7. Atribución explícita

Conservar las referencias originales para poder aplicar distintos modelos después. La política calculada vive separada con `attribution_model_version`.

Ejemplo:

1. Búsqueda Q1: «instalar aire acondicionado», zona seleccionada.
2. Lista R1 incluye carta C8, servicio S3, perfil P2 en posición 4.
3. La ocurrencia I4 obtiene impresión E1.
4. Clic K1 en I4 abre la carta.
5. Vista V2 apunta a K1 y al snapshot de C8.
6. Clic K2 en WhatsApp desde V2.

K2 tiene atribución directa a C8/S3/P2 y contexto conocido Q1/R1/I4. Esa relación no depende de adivinar qué proveedor era dueño de la carta al consultar.

Si desde V2 se abre el perfil y luego se usa su botón genérico, el nuevo contacto tiene:

- Objeto directo: P2.
- Servicio/carta directos: null.
- Referencias de asistencia: V2/K1/C8/S3 cuando el recorrido sea conocido.

No contar como contactos directos de S3 todos los contactos de P2, ni adjudicar un contacto a cada oferta vista en la sesión. Guardar la cadena y permitir informes futuros de primer contacto, último contacto o asistencia con definiciones explícitas.

Campos de evaluación posterior: `attribution_status`, `method`, `window`, `confidence`. Base recomendada para informes de sesión: mismo recorrido observado, límite de sesión y sin cruces entre pestañas no demostrables.

## 8. Snapshots: conservar qué oferta vio la persona

Sólo guardar IDs perdería contexto cuando cambian precios, clasificación o disponibilidad. Crear dimensiones históricas versionadas:

| Snapshot | Atributos permitidos |
| --- | --- |
| Perfil | Tipo, plan efectivo, estado público, verificación pública, calificación/conteo, especialidades, servicios activos, cobertura, modalidades, canales habilitados |
| Servicio declarado | Perfil, especialidad/rubro, versión de nombre público, estado activo, mapeo canónico si existe |
| Carta | Servicio/perfil, tipo de precio, importes en centésimos y moneda, modalidad, duración, gama, medios de pago, publicación, versión de contenido/galería |
| Taxonomía/ubicación | Versión y relaciones canónicas de clasificación |
| Presentación de resultado | Datos realmente mostrados, posición, badges, variante UI y razones de coincidencia permitidas |

Título, descripción y horarios pueden contener texto personal aunque sean públicos. El almacén analítico guarda versión y atributos estructurados; si se necesita comparar contenidos exactos, mantener historial editorial con acceso y retención propios, referenciado por esa versión. No copiar teléfonos/direcciones/textos completos a cada evento.

Generar `snapshot_id` desde la versión validada del objeto y los campos permitidos; reutilizarlo mientras no cambien. El resultado enviado al cliente transporta una referencia verificable a esa versión. Al ingerir un evento tardío no sustituirla por los datos actuales.

Servidor resuelve precio/plan/clasificación desde snapshot histórico, no desde claims arbitrarios. Usar referencia firmada o registro de presentación según la implementación; nunca crear identificadores personales compartidos dentro de caché pública. El snapshot de contenido puede compartirse, la identidad de sesión no.

No borrar en cascada toda la historia analítica ante una desactivación comercial normal. Usar estado histórico/tombstone. Una eliminación de datos personales sí se propaga según política a eventos, snapshots y archivos. Distinguir estado comercial de derecho de eliminación.

## 9. Esquema lógico de persistencia

Propuesta de tablas; las migraciones concretas se diseñan durante implementación.

| Tabla | Granularidad / relaciones |
| --- | --- |
| `analytics_events` | Una fila por evento; PK `event_id`, columnas comunes y JSON tipado |
| `analytics_sessions` | Sesión, vigencia, versión de política de captura y credencial de borrado protegida |
| `analytics_searches` | Una intención aplicada con criterios permitidos |
| `analytics_search_executions` | Ejecución, versión del motor, estado, conteos y tiempos |
| `analytics_result_sets` | Lista producida y su contexto |
| `analytics_result_items` | Una ocurrencia ordenada de entidad; FK a lista y snapshot |
| `analytics_entity_snapshots` | Versión permitida de perfil/servicio/carta |
| `analytics_event_entities` | Relaciones adicionales: objeto directo, contexto, asistencia, coincidencia; sin duplicar conteo |
| `analytics_archive_manifests` | Archivos, intervalos de ingesta, cantidad, checksum, esquema y estado |
| `analytics_job_runs` | Avance, reintentos y corte de procesamiento |
| `analytics_deletion_requests` | Alcance, estado y propagación de borrados, con mínimo dato necesario |

Las tablas de búsqueda/lista/snapshot son hechos y dimensiones auxiliares de los eventos, no contadores finales. Guardar atomícamente dentro de D1 las filas de un mismo lote cuando corresponda. Un evento puede llegar antes que su referencia: conservarlo como pendiente de resolución o aceptar el contexto validado autocontenido; reconciliar con plazo y marcar huérfanos, sin fabricar vínculos.

Índices iniciales: recepción; sesión/vista/secuencia; perfil/fecha; servicio/fecha; carta/fecha; búsqueda; lista/posición. Campos frecuentes como IDs no deben quedar únicamente dentro del JSON. Evitar indexar cada propiedad.

Versionar catálogo de eventos, propiedades, snapshots y definiciones. Cambios incompatibles crean una nueva versión; los lectores adaptan versiones antiguas sin reescribir el hecho original. Enriquecimientos y clasificaciones posteriores se guardan aparte con versión.

El patrón ordinario es append-only, con excepciones explícitas de privacidad, corrección de datos inválidos y retención. Las proyecciones/contadores futuros son reconstruibles mientras exista el raw; tras su vencimiento no prometer nuevas métricas históricas imposibles de calcular.

## 10. Captura completa con límites de privacidad

### Identidad, controles y geografía

Decisión de producto: captura automática al iniciar una vista pública instrumentada, sin banners, preguntas por métrica ni flujo de consentimiento dentro de la aplicación. La instrumentación funciona en segundo plano y no bloquea búsqueda ni contacto. No registrar un consentimiento ficticio ni un campo que afirme que la persona aceptó. Mantener información sobre el tratamiento en la política de privacidad y controles técnicos de minimización, conservación y borrado.

El artículo 9 de la Ley 18.331 establece consentimiento informado como regla y enumera excepciones; documentar la base aplicable, finalidades y tratamiento antes de producción. Identificadores aleatorios son seudónimos, no garantía de anonimato. [Fuente: IMPO](https://www.impo.com.uy/bases/leyes/18331-2008/9).

Registrar origen aproximado desde metadatos confiables del edge: país/departamento, disponible o desconocido; no IP persistida, coordenadas ni fingerprint. Verificar acceso en el runtime OpenNext y evitar confiar en cabeceras que pueda inventar el cliente. [Fuente: Cloudflare Request](https://developers.cloudflare.com/workers/runtime-apis/request/).

El permiso funcional «usar mi ubicación» no autoriza reutilizar coordenadas para analítica. Capturar el resultado administrativo permitido de la búsqueda, sin reutilizar precisión GPS.

Se pueden guardar categoría de dispositivo, familia y versión mayor de navegador/SO, idioma principal y rango de viewport, sólo si justifican análisis de experiencia. No conservar combinaciones de características de alta entropía para reconocer personas.

Origen: clasificación directa/interna/buscador/social/campaña/otro y dominio de referencia permitido, sin ruta ni parámetros. Campañas sólo mediante códigos conocidos, no cualquier texto de UTM.

### Texto de búsqueda

**Requisito central desde la primera implementación:** registrar cada búsqueda aplicada, incluyendo su frase consultada y todos sus filtros autorizados. La clasificación en catálogo por sí sola es insuficiente: deben poder descubrirse términos nuevos, expresiones frecuentes y demanda que todavía no tiene representación en la taxonomía. La captura de términos forma parte del alcance inicial, con almacenamiento restringido y sanitización; no queda como feature opcional futura.

Una búsqueda conserva `search_id`, `previous_search_id` cuando corresponda, sesión/vista, fecha, motivo y snapshot completo de filtros aplicados. Se relaciona con sus ejecuciones, conteo de resultados, impresiones y clics. Cada envío explícito cuenta como una nueva intención, incluso si repite los mismos términos/filtros; los reintentos de transporte conservan el ID y no generan otra búsqueda.

Campos textuales propuestos: `query_sanitized` (frase enviada después de remover datos personales detectables), `query_normalized` (normalización conservadora para agrupar variantes), `query_tokens` (términos derivados de la frase sanitizada), `normalizer_version` y `query_capture_status` (`captured`, `redacted`, `omitted`, `empty`). Todos los derivados heredan las mismas restricciones de acceso y retención que la frase. No guardar sólo tokens: el orden y las frases completas permiten distinguir intenciones diferentes.

Normalizar espacios y mayúsculas, conservando una versión sanitizada anterior a esa normalización. No eliminar negaciones, números relevantes del servicio ni fusionar sinónimos irreversiblemente; las agrupaciones semánticas son derivaciones versionadas. Si se omite el texto por riesgo, conservar el evento de búsqueda, filtros permitidos y motivo de omisión, sin inventar términos.

Organización de acceso:

1. **Dataset central:** conceptos canónicos permitidos, filtros, intención, longitud por rango, estado de reconocimiento/corrección. Sin texto libre ni derivados que permitan reconstruirlo.
2. **Dataset restringido de consultas, parte de la captura inicial:** frase sanitizada, normalización y términos, largo acotado, retención inicial de 7 días y acceso sólo de analistas autorizados. Documentar finalidad y base de tratamiento aplicable, filtros de datos sensibles y proceso de revisión. Mantenerlo fuera del archivo raw de largo plazo.

Para la segunda vía, eliminar emails, teléfonos, documentos, URLs y direcciones detectables; suprimir toda la consulta si se detecta información sensible o no se puede reducir el riesgo suficientemente. No guardar copia previa a sanitización ni logs de rechazo con el texto. Un filtro automático no garantiza detectar todos los datos personales; tratar lo retenido como potencialmente personal.

El módulo puede correlacionarse temporalmente con `search_id` para investigar resultados; esa relación es restringida y se elimina con el texto. Registrar sólo códigos de redacción/omisión. No dar estas consultas a proveedores ni sustituirlas por hashes reversibles por diccionario. Aprendizajes curados, como un sinónimo nuevo del catálogo, se conservan sin sesión.

Para conservar tendencias después de esos 7 días, ejecutar desde el inicio una proyección diaria de términos y frases no sensibles suficientemente frecuentes, con conteo de búsquedas y búsquedas sin resultados. Umbral inicial: al menos 10 sesiones distintas por grupo; el umbral no sustituye la revisión de contenido. Guardar versiones y cortes de cálculo para evitar duplicados. Conservar hasta 13 meses sin sesión ni IDs que reconstruyan recorridos. Los cruces con filtros requieren el mismo control por cada grupo y no deben permitir inferir combinaciones raras. Si la proyección falla, alertar antes del vencimiento; no conservar indefinidamente el texto para compensar el fallo.

Esta proyección preserva frecuencias de vocabulario para futuros análisis; no es un dashboard ni sustituye el raw reciente. Se acepta perder términos raros no curados y consultas omitidas tras su vencimiento. Permite analizar frases completas más usadas, términos frecuentes, filtros y combinaciones comunes, reformulaciones recientes y búsquedas sin oferta.

Del mismo modo, cada navegación pública completada conserva su propio `page_view`, aunque ocurra dentro del mismo segmento de 60 segundos. Navegación y búsqueda no se reducen a un único resumen por segmento; éste es sólo el contenedor de envío. No registrar solicitudes automáticas de precarga ni cada tecla como navegación/búsqueda humana.

### Retención propuesta para este alcance ampliado

Estos plazos son decisiones iniciales de producto/privacidad a validar, no exigencias legales universales.

| Dataset | Plazo propuesto | Qué permite |
| --- | --- | --- |
| Raw vinculado a sesión y recorrido | 90 días desde recepción, en total entre D1 y archivo | Reprocesar embudos y recorridos recientes |
| Consultas restringidas | 7 días | Investigar vocabulario/fallos con controles |
| Hechos históricos de entidad sin recorrido | Hasta 13 meses, sólo tras transformación aprobada | Analizar exposición/interés por oferta, versión y estacionalidad |
| Agregados futuros suficientemente agrupados | Hasta 13 meses inicialmente | Tendencias después del vencimiento del raw |

Los hechos históricos de entidad quitan sesión, visita, interacción, IDs de búsqueda/lista compartidos, origen detallado y otros enlaces que reconstruyan recorridos; reducen tiempo y geografía. Esto no basta para declarar anonimato automáticamente: evaluar combinaciones raras y, si persiste riesgo, conservar únicamente agregados. Ya no permiten reconstruir embudos individuales; el manifiesto documenta campos eliminados.

Snapshots necesarios para interpretar el histórico duran lo mismo que los hechos dependientes, sujetos a borrado y minimización.

Desactivación técnica mediante bandera: detener colector, borrar lotes pendientes e identidad local. Borrado histórico: credencial separada del ID analítico, verificada por servidor; procesar eventos, archivos y proyecciones según alcance. No prolongar identidad del navegador sólo para conservar un historial. Definir acceso y borrado de sesiones ya vencidas sin prometer poder identificar a una persona cuya relación se eliminó.

## 11. Arquitectura recomendada para el proyecto

Stack observado: Next.js App Router, React, Zod y OpenNext en Workers; D1 de negocio y R2 para imágenes.

`Browser → colector → POST /api/analytics/events → D1 analítica → exportador → R2 privado`

`Backend de negocio → outbox → despachador → misma ingesta interna / repositorio analítico`

`Herramientas futuras → raw autorizado / snapshots / proyecciones derivadas`

### Ingesta inicial

D1 separada con binding `ANALYTICS_DB` y migraciones propias. Endpoint fino, contrato Zod estricto por evento, tamaños y cardinalidades máximos, SQL parametrizado, límite de frecuencia, verificación de origen y autenticidad del contexto server.

No confiar en `is_bot`, `is_self`, plan, precio o propietario enviados por el cliente. Autenticación puede usarse transitoriamente para identificar visitas propias sin persistir el ID de cuenta del visitante. Las señales operativas de abuso tienen finalidad/retención separadas.

Validar body antes de persistir. Retornar IDs aceptados/duplicados en envío normal y errores codificados para datos inválidos. Conflicto del mismo `event_id` con contenido distinto se rechaza y se registra como anomalía; no sobrescribir. Responder éxito sólo tras commit.

Eventos de cliente siguen siendo observaciones manipulables; comprobación de origen y referencias firmadas no prueban que una persona miró una tarjeta.

### Archivo raw

Crear bucket privado `ANALYTICS_RAW`, separado de medios públicos. Exportar periódicamente por fecha/hora de **recepción**, tipo y versión, en lotes NDJSON comprimidos como formato inicial portable. Considerar Parquet cuando existan herramientas y volúmenes que lo justifiquen. R2 almacena objetos; las consultas requieren un lector/motor que se implementará después.

Cada archivo tiene ID estable, corte de ingesta, cantidad de eventos, checksum y versión. Confirmar manifiesto después de verificar exportación; purgar la copia caliente sólo tras ese control. Un reinicio no omite ni duplica lógicamente eventos: consumidores deduplican por `event_id` y siguen manifiestos, no leen objetos parciales.

Objetivo inicial: 14 días consultables en D1 y hasta 90 días totales de raw vinculado entre D1/R2. La transformación de histórico y exportación deben estar funcionando antes de borrar la única copia. Los 14 días son un objetivo de almacenamiento caliente, no permiso para perder datos si falla el exportador.

TTL por fecha original, no por última reescritura: una compactación no renueva retención. R2 permite reglas de ciclo de vida, pero la expiración no es una barrera exacta de lectura; además aplicar exclusión por fecha y tareas de purga verificadas. [Fuente: R2 lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

Borrado de una sesión en archivos compartidos requiere reescribir las particiones afectadas, sustituir manifiestos y eliminar objetos anteriores. Mantener índice mínimo de sesión a particiones hasta su vencimiento. Tombstones bloquean lectura/reingesta inmediatamente mientras se completa borrado físico; no equivalen por sí solos a eliminar datos. Restauraciones deben reaplicar borrados y retención.

### Escalado

Comenzar con persistencia directa por lotes en D1 para evitar complejidad antes de conocer el tráfico. Si el piloto muestra presión sostenida o ráfagas, introducir Cloudflare Queues entre ingesta y almacenamiento, consumidor Worker separado y cola de fallos.

Queues puede entregar duplicados y no garantiza orden: conservar IDs y procesamiento idempotente. Con cola, responder aceptación sólo tras encolado durable, distinguiéndolo de persistencia final. [Fuente: Queues](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).

No escribir una promesa de transacción D1+R2+Queues: usar estados, manifiestos y reconciliación. La tarea programada se configura realmente, siguiendo el patrón del proyecto de rutas protegidas; crear una ruta no programa su ejecución.

## 12. Transporte y comportamiento del navegador

### 12.1 Bloques de navegación con inicio y fin

La unidad de transporte será un **segmento de captura**, que agrupa eventos ocurridos durante un intervalo. Registrar el inicio localmente cuando la primera vista pública esté visible y la captura esté habilitada. No es necesario hacer una solicitud separada para anunciar ese inicio: viaja con el segmento cuando se envía.

Cada segmento contiene `segment_id`, `session_id`, `tab_id`, `segment_sequence`, `started_at`, `ended_at`, `last_activity_at`, `close_reason`, versión de contrato y arreglo `events`. Los eventos conservan sus propios IDs, tiempos, vistas y entidades. El arreglo es acotado; al persistir se puede descomponer en filas raw, conservando `segment_id` y una cabecera en `analytics_segments`.

**Cerrar un segmento no termina la sesión ni la visita.** Un visitante puede generar varios segmentos dentro de una misma vista y una misma sesión. `ended_at` representa el corte de captura observado, no prueba que cerró el navegador. Los límites de sesión por inactividad de la sección 4 se mantienen independientes.

### 12.2 Cuándo cerrar y enviar

Valor inicial propuesto: **60 segundos desde el primer evento pendiente**, configurable después del piloto. Reemplaza el envío cada 10 segundos y el umbral de 20 eventos de la propuesta anterior.

| Condición | Acción | `close_reason` |
| --- | --- | --- |
| Cumple 60 segundos con datos pendientes | Cerrar, encolar envío y permitir otro segmento en la misma sesión | `interval` |
| Próximo evento superaría 20 KiB serializados | Cerrar antes de agregarlo; el evento comienza el siguiente segmento | `size_limit` |
| Documento pasa a oculto | Cerrar y hacer intento de envío final; suspender temporizador | `hidden` |
| `pagehide` sin cierre ya procesado | Cerrar como respaldo | `pagehide` |
| Expira la sesión por inactividad | Cerrar lo pendiente; nuevo ID de sesión al reanudar interacción | `session_timeout` |

No crear ni enviar segmentos vacíos. Al cumplir intervalo se prepara el siguiente bloque, pero sólo se materializa con otro evento. Mientras la pestaña esté oculta no generar actividad ni solicitudes periódicas de captura. Los temporizadores pueden retrasarse: usar tiempos reales y no asumir intervalos exactos.

Un cambio de ruta interno de Next.js cierra la vista anterior y abre la nueva en los eventos, pero puede seguir dentro del mismo segmento sin una nueva solicitud. Una navegación que abandona el documento se maneja mediante ocultación/pagehide. Deduplicar ambos avisos de cierre.

Al volver a visible se abre un nuevo segmento cuando haya un evento; conservar la sesión si no expiró y la vista si sólo se ocultó. Una restauración bfcache crea nueva vista con referencia a la anterior. Evitar duplicados por Strict Mode/remontajes.

Ejemplo: bloque 1 de 12:00 a 12:01 (`interval`); bloque 2 de 12:01 a 12:02 (`interval`); bloque 3 hasta 12:02:18 (`hidden`). Los tres pueden pertenecer a la misma sesión. Si regresa a las 12:03, continúa en un cuarto bloque; el bloque oculto no representa un cierre definitivo.

### 12.3 Enviar sin bloquear la experiencia

Durante el uso normal, enviar segmentos mediante `fetch` asíncrono. La persona continúa navegando sin esperar; el colector sí procesa la confirmación para retirar datos y decidir reintentos. Esto no añade otra solicitud: aprovecha la respuesta HTTP del mismo envío.

En ocultación/salida, intentar `sendBeacon`; `pagehide` es respaldo. No depender de `beforeunload`. Beacon no permite comprobar la respuesta del servidor: un `true` sólo confirma encolado del navegador, no persistencia. Si no encola, intentar `fetch keepalive` dentro del presupuesto disponible; ambos pueden fallar. [Fuente: MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon).

La mayoría de los clics viaja dentro del segmento, sin solicitud individual. Un contacto que abre otra app y oculta la página provoca el vaciado por `hidden`. Si abre otra pestaña y el documento continúa visible, se envía por el intervalo normal. No retrasar el enlace ni agregar un envío inmediato por cada contacto; esa excepción sólo se reconsideraría si el piloto demuestra una pérdida relevante.

Conservar segmentos pendientes en memoria hasta confirmación cuando la página siga viva. Un envío Beacon sin confirmación puede reenviarse al regresar, usando los mismos IDs. Ingesta deduplica por `segment_id` y `event_id`; una cabecera repetida con contenido distinto se rechaza. Permitir que eventos de servidor no tengan segmento browser.

Una sola solicitud normal en curso; nuevos segmentos esperan en cola. Reintentar fallos transitorios con espera exponencial, variación aleatoria y máximo de 3 intentos; respetar 429 y no reintentar inválidos. Evitar reenviar simultáneamente el mismo segmento desde timer y ocultación. Los lotes finales deben respetar presupuesto total de bytes disponible; no asumir que pueden enviarse todos los pendientes al salir.

Máximo inicial 200 eventos / 256 KiB pendientes, cualquiera que ocurra primero. Si una propiedad individual excede límites se rechaza/omite conforme al contrato, sin fragmentar un evento de forma ambigua. Ante saturación descartar primero segmentos de menor prioridad y registrar cantidades; un segmento ya cerrado conserva su contenido e IDs. Sin cola persistente offline inicialmente: considerar una extensión con TTL corto y borrado al desactivar la captura sólo si la pérdida medida lo justifica.

### 12.4 Límite de confiabilidad y volumen esperado

Matar el proceso, apagar el dispositivo o perder conexión puede impedir el último envío. Si no se transmite el primer segmento, el servidor puede no enterarse de esa visita. Con intervalo de 60 segundos, en operación normal se reduce a aproximadamente el último minuto el período pendiente por temporizador; no es un límite garantizado ante fallos, saturación o suspensión.

El servidor conserva `last_received_at` y puede inferir expiración por inactividad, pero no inventa un evento browser de cierre ni un tiempo exacto de salida. Distinguir siempre fin observado del segmento y fin inferido de sesión.

Objetivo orientativo: una solicitud por minuto de actividad capturada en primer plano, más envíos por ocultación y tamaño. Puede haber menos si no hay eventos, o más con muchos resultados/cambios de pestaña. Medir solicitudes por sesión y bytes, sin prometer una frecuencia fija máxima.

Aplicar la misma política de campos y exclusiones en browser y servidor. Desactivar la captura mediante la bandera detiene listeners y descarta lo pendiente; el backend también debe respetar la desactivación. No contar SSR o prefetch como visitas humanas.

### 12.5 Presupuesto de rendimiento del navegador

La captura automática debe tener costo pequeño y acotado aunque se navegue mucho. Requisitos de implementación:

- Inicializar el colector después de la primera renderización visible, sin bloquear hidratación ni la interacción. Usar el mecanismo de scheduling disponible con fallback; no depender indefinidamente de que el navegador esté ocioso. Reconocer que pueden faltar interacciones anteriores a su inicialización.
- Evitar SDKs grandes, grabación de sesiones, captura de DOM, polling y listeners por cada tarjeta. Preferir manejadores explícitos de acciones y un IntersectionObserver compartido para exposiciones.
- Los eventos se acumulan en un módulo fuera del estado de React: registrar un clic no provoca renders. No crear una petición ni escritura de almacenamiento por interacción.
- Usar un único temporizador de envío por pestaña. Medir actividad mediante marcas de tiempo y avisos de interacción limitados en frecuencia, sin intervalos por elemento ni muestreo continuo del puntero.
- Scroll con listener pasivo y frecuencia acotada; calcular únicamente hitos, sin lecturas/escrituras de layout intercaladas. Dejar de observar elementos cuando ya registraron su exposición si no necesitan otra medición.
- No serializar el arreglo completo después de cada evento para estimar tamaño: medir el evento una vez, mantener contabilidad acumulada y verificar bytes exactos al cerrar el lote. Evitar compresión en el browser; comprimir en el exportador.
- Mantener la cola dentro de los límites de memoria indicados. Evitar almacenamiento persistente de eventos en la versión inicial; sessionStorage sólo para identidad/contexto mínimo.
- Agrupar señales secundarias de actividad en intervalos; conservar clics/búsquedas como eventos individuales. Al ocultarse el documento detener timers y trabajo de exposición.
- Liberar observers, listeners y referencias al cambiar de vista; comprobar que no se multiplican tras navegar repetidamente.

Objetivos iniciales de aceptación, a medir y ajustar: incremento de JavaScript del colector de hasta 15 KiB gzip como referencia; sin nuevas long tasks atribuibles a analítica; handlers habituales con p95 inferior a 2 ms en el dispositivo de referencia; cola máxima de 256 KiB según contabilidad de payload (no equivale al consumo total de heap JavaScript). Medir también heap total, CPU, fluidez y bytes/solicitudes de red en un móvil representativo.

Comparar captura activada/desactivada sobre el mismo recorrido con varios listados y 20 cambios de ruta. Verificar que no crecen listeners, timers ni referencias a tarjetas desmontadas. Si la captura excede el presupuesto, reducir señales secundarias o su frecuencia antes de aumentar trabajo en el browser. Estos son objetivos a verificar, no resultados ya medidos.

Revisadas guías locales instaladas de Next.js para Route Handlers e instrumentación cliente. Usar componentes cliente de alcance público y manejadores de interacción explícitos; no un listener global que capture todo clic y texto del documento.

## 13. Calidad, cobertura y criterios de análisis

Guardar códigos de calidad: evento tardío, reloj corregido, referencia pendiente/inválida, entorno de prueba, tráfico interno, propio, sospechoso, pérdida reportada y versión de política.

Aceptar atraso máximo inicial de 48 horas para browser; usar la fecha de recepción para exportación y conservar ocurrencia validada. Eventos de negocio/outbox tienen política propia para no perder una actualización confirmada si el despachador demora.

La aplicación debe registrar cobertura de instrumentación por versión y superficie: «no instrumentado» no es «cero clics». Métricas de salud: aceptados/rechazados/duplicados, referencias pendientes, retraso de recepción/exportación, lotes fallidos, backlog de outbox y última purga correcta. Nunca afirmar una tasa exacta de pérdida del browser: los eventos que nunca salieron pueden ser inobservables.

Conservar eventos permitidos de repetición y banderas, en lugar de borrar silenciosamente repeticiones útiles. Los futuros análisis excluyen fraude/tráfico propio por reglas versionadas.

Definiciones para evitar errores futuros:

- Solicitudes al servidor, resultados entregados e impresiones son denominadores diferentes.
- CTR puede calcularse por ocurrencias con al menos un clic / ocurrencias con impresión, indicando clics sin impresión vinculable aparte.
- Contactos directos por carta y contactos asistidos de perfil son medidas diferentes.
- No sumar únicos diarios para obtener únicos mensuales.
- No sumar el mismo contacto por cada servicio clasificado.
- Comparar posiciones, superficies y períodos equivalentes; promover una oferta altera su exposición.
- No llamar «clientes» a sesiones o «ventas» a clics.
- Las sesiones observadas representan la captura habilitada y recibida, con sesgos por bloqueadores, cobertura de instrumentación y pérdida de eventos.
- Los desgloses futuros al proveedor serán agregados y con protección de grupos pequeños; el raw queda restringido.

## 14. Orden de implementación y entregables

1. **Diccionario de datos.** Definir eventos, campos, nulabilidad, relaciones, disparadores, versiones y exclusiones. Formalizar privacidad y relación con BR/TR. Inventariar controles reales.
2. **Identidad y snapshots.** Resolver perfil → servicio → carta; añadir versionado permitido y referencias verificables de presentación. Resultado: un cambio de precio no modifica contexto histórico.
3. **Base e ingesta.** D1 analítica, migraciones, contratos Zod, deduplicación, límites y bandera de apagado. Fixtures y consultas de verificación.
4. **Búsquedas/listas.** Capturar filtros, ejecuciones, listas ordenadas, impresiones y selección, con correlación robusta ante búsquedas simultáneas y respuestas descartadas.
5. **Recorridos/contacto/contenido.** Vistas, actividad, secciones, galería, servicios, contactos y vínculos directos/asistidos. Recorrer todas las superficies, no sólo página de búsqueda.
6. **Cambios de oferta.** Snapshots históricos y outbox para cambios confirmados; sin datos privados de formularios.
7. **Archivo y privacidad operativa.** Exportador/manifiestos, lectura de muestra, purga, borrado, transformaciones de histórico, control de acceso y monitoreo. Antes de capturar en producción.
8. **Piloto y validación.** Activar gradualmente, verificar consistencia, pérdida observada, costo y payloads. Corregir capturas ausentes.
9. **Contrato de consumo.** Documentar cómo leer y relacionar raw, ejecutar consultas de ejemplo y reconstruir una sesión/embudo conocido. Sin dashboards.
10. **Extensiones condicionadas.** Identidad entre visitas, cola durable y futuros controles de producto, sólo cuando sus condiciones estén resueltas. La captura restringida de términos y su proyección diaria ya pertenecen al alcance inicial de búsquedas y mantenimiento.

No condicionar el comienzo de captura a definir qué gráfica tendrá cada plan.

Puntos de integración:

- `src/lib/analytics/`: contrato compartido, sanitización, cola y transporte.
- `src/components/analytics/`: activación automática, vista, actividad e impresiones.
- `src/application/search.ts`: contexto server, ejecución y lista versionada.
- `SearchPanel`/`SearchExperience`: intención aplicada y respuesta mostrada.
- `ProfileCard`/`ServiceOfferCard`: ocurrencia, exposición, selección y contacto.
- Perfil público, detalle de carta y galería pública: vistas y acciones específicas.
- `src/app/api/analytics/events/route.ts`: ingesta.
- Puerto en `src/domain/ports.ts`, aplicación y repositorio analítico en sus capas existentes.
- `src/infrastructure/cloudflare.ts`: único acceso a bindings.
- Migraciones analíticas separadas; outbox en migración de negocio cuando corresponda.
- Rutas de jobs protegidas y configuración de invocación periódica, exportación y eliminación.

## 15. Verificación antes de habilitar

| Prueba | Resultado esperado |
| --- | --- |
| Misma acción reenviada varias veces | Un evento lógico, sin duplicar filas auxiliares |
| Carta C cambia de precio después de impresión | El evento conserva precio/snapshot observado |
| Contacto genérico tras ver dos servicios | Un contacto de perfil con asistencias conocidas; sin dos conversiones directas |
| Búsquedas A/B simultáneas; sólo B se muestra | Ejecuciones separadas y exposición atribuida exclusivamente a B |
| Resultado precargado/no visible | No registra impresión |
| Clic antes del umbral de impresión | Clic válido con impresión ausente |
| Desactivación de captura mediante bandera | Se detienen listeners y envíos; se descarta lo pendiente |
| Pestañas duplicadas y apertura en nueva pestaña | Sesiones separadas; sin atribución inventada |
| Móvil oculta la app y vuelve | Tiempo oculto excluido, sin doble vista por simple ocultación |
| Endpoint caído | Búsqueda/WhatsApp funcionan; reintentos acotados |
| Evento con perfil ajeno a la carta | Rechazo de relación falsa |
| JSON con teléfono/email/URL o campos libres | Rechazo o sanitización según contrato, sin datos en logs |
| Exportación interrumpida/repetida | Manifiestos consistentes y todos los eventos únicos recuperables |
| Borrado y restauración de archivo | Datos eliminados no reaparecen |
| Servicio desactivado | Historia comercial preservada según política; estado actual correcto |
| Consulta de fixture | Reconstruye búsqueda → exposición → carta → contacto y sus snapshots |

Completar lint/typecheck/checks relevantes y preview Cloudflare para el runtime al implementar. Para este plan documental no corresponde ejecutar pruebas de aplicación.

Dimensionar antes del piloto: sesiones diarias × eventos medios + filas de resultados + snapshots/cambios. Ejemplo ilustrativo, no medición: 10.000 sesiones × 80 eventos × 800 bytes ≈ 640 MB/día sólo en eventos sin comprimir; 90 días ≈ 57,6 GB, más resultados/índices. La exposición puede dominar el volumen. Medir tamaño real, lecturas/escrituras y costo; comparar con los [límites de D1](https://developers.cloudflare.com/d1/platform/limits/).

La fase se considera completa cuando el dato puede capturarse, relacionarse, exportarse, leerse y borrarse de manera verificable, y las limitaciones de cada campo están documentadas. Las features de análisis se construyen después sobre esta base.
