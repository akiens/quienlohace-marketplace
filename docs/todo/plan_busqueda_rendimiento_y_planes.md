# Plan de implementación: rendimiento de búsqueda y prioridad por plan

Fecha: 2026-09-11. Estado: implementación principal completada; medición en producción pendiente.

Este plan continúa [el trabajo de relevancia](plan_busqueda_relevancia.md); la definición funcional vigente reside en [BR-031](../rules/business_rules.md#br-031--búsqueda-y-filtros). No se midió producción: los mecanismos descritos se comprobaron en el código y con el seed local, pero su contribución a la latencia real requiere desplegar la instrumentación y recoger una muestra representativa.

## Estado de implementación

Completado el 2026-09-11:

- proyecciones ligeras separadas para candidatos de perfiles y cartas;
- eliminación del límite de 48 candidatos por tipo y conteos sobre el conjunto elegible real;
- prioridad estricta por plan efectivo `Platino → Oro → Cobre`, seguida por evidencia, relevancia, reputación, desempate estable y rondas por proveedor;
- hidratación de sólo 12 entidades por respuesta, sin sincronización de galería en la búsqueda;
- carga adicional que transmite una página y la agrega en el cliente, con posiciones analíticas absolutas;
- cursor opaco que vincula página, filtros y versión del ranking; un conjunto modificado reinicia la búsqueda;
- continuidad del conjunto en analytics, con ejecuciones separadas y entrega acumulada sin duplicar impresiones anteriores;
- tratamiento uniforme de planes vencidos, pruebas finalizadas, cancelaciones, `past_due` y bajas programadas mediante `effectivePlanId`;
- tiempos separados de consulta de candidatos, matching/ranking, hidratación y snapshots en el log `marketplace_search_performance`;
- precálculo del catálogo por ID, lotes de evidencia limitados a 80 perfiles e índices para las tablas raíz de candidatos en la migración `0024`;
- pruebas de ranking comercial y validación mediante `check:backend`, `check:data`, typecheck, lint y build.

FTS5, una proyección textual persistida, materialización temporal de conjuntos y caché compartida quedan condicionados por las mediciones de producción. No se añadieron sin datos porque cambian el modelo de escritura y pueden introducir diferencias de elegibilidad. La implementación actual todavía vuelve a recuperar y ordenar candidatos ligeros en cada página; ya no vuelve a hidratar ni transferir las páginas anteriores.

## 1. Por qué la paginación actual no evita la demora

La paginación recorta la presentación después de recuperar, completar y ordenar candidatos. Con texto, no limita la consulta de candidatos a los 12 resultados visibles. Por ejemplo, si SQL devuelve 2.000 candidatos, el servidor puede completar y evaluar los 2.000 antes de mostrar 12; es un ejemplo explicativo, no una medición del sitio.

Flujo observado: `/buscar` estático → hidratación del cliente → Server Action → interpretación → consultas de perfiles y cartas → carga de relaciones → evaluación textual → ranking completo → recorte acumulativo → snapshots → respuesta → render.

| Evidencia en el repositorio | Consecuencia | Prioridad |
| --- | --- | --- |
| [application/search.ts](../../src/application/search.ts), `candidates`, invoca ambos `searchAll` cuando hay texto. Los repositorios no usan `LIMIT` en esos métodos. | El trabajo crece con todos los candidatos, no con el tamaño de página. Las dos ramas ya arrancan con `Promise.all`. | Alta |
| [d1-profile-repository.ts](../../src/infrastructure/d1-profile-repository.ts), `loadRelations`, consulta propietarios y espera `syncGalleryForUser` en un bucle por propietario, antes de cargar nueve relaciones mediante batch. | Hay trabajo secuencial por candidato aunque las relaciones estén agrupadas. La sincronización puede efectuar escrituras; no es un simple fetch de tarjetas. | Alta |
| Los perfiles se hidratan completos; [d1-service-card-repository.ts](../../src/infrastructure/d1-service-card-repository.ts), `hydrateCards`, carga imágenes de todas las cartas candidatas. | Se cargan horarios, redes, galerías y otros datos antes de saber qué se mostrará. | Alta |
| [search-sql.ts](../../src/infrastructure/search-sql.ts) combina `LOWER`, varios `REPLACE` y `LIKE '%texto%'`; las consultas también amplían candidatos por especialidad. | Trabajo textual repetido y candidatos que luego rechaza el matcher. Un índice común de nombre no resuelve ese patrón. El plan de ejecución real aún no se inspeccionó. | Alta |
| `searchMarketplace` usa `rankedResults.slice(0, page * PAGE_SIZE)`. [search-experience.tsx](../../src/components/search-experience.tsx) vuelve a llamar la acción y reemplaza el resultado. | Página 2 transmite 24 entidades y página 3 transmite 36; cada petición rehace búsqueda y ranking. | Alta |
| Sin texto se recuperan como máximo 48 perfiles y 48 cartas, ordenados antes de combinarlos. | Los totales reflejan ese subconjunto, no necesariamente todo el catálogo. Un futuro ranking por plan no recuperaría un Platino descartado antes por ese límite. | Alta, también de corrección |
| [search-matching.ts](../../src/lib/search-matching.ts) recorre el catálogo para ciertas coincidencias; [search-ranking.ts](../../src/lib/search-ranking.ts) ordena colas y usa `shift`. | CPU adicional conforme crecen los candidatos; medir antes de atribuirle la mayor parte de la latencia. | Media |
| `searchDurationMs` se calcula antes de generar snapshots. El cliente cambia la clave de `MixedResults` con la lista de IDs. | La métrica actual omite parte del trabajo y la transferencia/render; al cargar más se remonta la grilla. | Media |

La persistencia analítica ya se envía a `runInBackground`: no corresponde afirmar que toda escritura analítica se espera. Sí se construyen snapshots e identificadores en la petición. La portada preparada tampoco equivale a un resultado real cacheado: una URL con criterios espera a que el cliente ejecute la acción.

## 2. Aplicación de la nueva regla

BR-031 es la única definición normativa. La implementación debe separar elegibilidad de orden comercial: conservar el matcher estricto y los filtros, y añadir el plan del proveedor al candidato tanto para perfiles como para cartas. `ServiceCard.tier` describe la oferta y **no** debe usarse como plan del proveedor. Hoy la proyección de cartas no incluye `p.plan_id`.

La interpretación adoptada es prioridad estricta entre planes, no un pequeño bonus de puntos. Ejemplo de aceptación, con todas las entidades elegibles y del mismo nivel de evidencia:

| Proveedor | Plan | Entidades en su cola |
| --- | --- | --- |
| A | Platino | carta A1, carta A2, perfil A |
| B | Platino | carta B1, perfil B |
| C | Oro | carta C1, perfil C |
| D | Cobre | carta D1, perfil D |

Si A gana el desempate frente a B, el resultado esperado es `A1, B1, A2, perfil B, perfil A, C1, perfil C, D1, perfil D`. Las rondas evitan monopolio entre proveedores comparables del mismo plan. Agotar un plan puede dejar resultados gratuitos fuera de la primera página; es la consecuencia explícita de la prioridad solicitada. Un perfil Platino elegible por especialidad puede preceder a una carta Cobre explícita; un Platino irrelevante queda excluido.

Resolver el plan efectivo con la misma lógica de vigencia usada por suscripciones. Revisar cancelaciones todavía vigentes, pruebas, `past_due`, vencimientos y bajas programadas según BR-008/009; no inferirlo del precio ni depender de una actualización tardía de la galería. Este cambio corresponde a búsquedas ejecutadas, incluidas las generales sin texto; la selección editorial de portada queda fuera del alcance.

## 3. Etapas propuestas

### Etapa 1 — Medición reproducible

- Instrumentar por separado interpretación, consultas, sincronización de galería, relaciones, matching, ranking, snapshots, tamaño de respuesta y tiempo hasta pintar resultados. Correlacionar con `searchExecutionId`; conservar analítica de negocio separada de estos tiempos.
- Registrar cantidad de candidatos, entidades elegibles, proveedores, consultas, `rows_read`, `rows_written` y duración D1. Cloudflare permite investigar tiempos y volumen de consultas con sus [métricas de D1](https://developers.cloudflare.com/d1/observability/metrics-analytics/).
- Medir en preview de Cloudflare con datos representativos, caché fría/caliente y distintas concurrencias. Separar desarrollo local de producción. Usar búsquedas de oficio, actividad, alias, tildes, nombre, sin resultados, muchos resultados, filtros combinados y búsqueda general; medir página inicial y varias cargas adicionales.
- Guardar p50/p95, volumen y condiciones del ensayo. Ejecutar `EXPLAIN QUERY PLAN` sobre las consultas reales y revisar índices existentes antes de proponer migraciones.

Salida: baseline y prioridades confirmadas. Objetivo inicial propuesto: reducir al menos 50% el p95 de los casos lentos respecto de ese baseline, sin regresiones de elegibilidad. No es una promesa de latencia ya verificada.

### Etapa 2 — Recuperación ligera y ranking verificable

- Crear un contrato de candidato de búsqueda con identidad, proveedor, plan efectivo, evidencia, relevancia, reputación y únicamente campos necesarios para decidir coincidencia. Mantener filtros en el repositorio y una sola implementación de matching; no duplicar reglas en cliente.
- Recuperar esa proyección antes de completar entidades públicas. Cargar únicamente los datos de presentación de las entidades de la página seleccionada, agrupados por IDs y con consultas acotadas a los límites de parámetros D1.
- Retirar la sincronización individual de galería del camino de candidatos. Primero garantizar las transiciones al cambiar planes, el procesamiento de vencimientos y lecturas públicas que no expongan imágenes excedentes. No borrar el control sin reemplazar su garantía de visibilidad.
- Implementar BR-031 en `rankMixedSearchResults` con comparaciones explícitas: plan, evidencia, ronda, orden estable del proveedor y orden estable de entidad. No sumar un bonus que una relevancia alta pueda superar. Usar índices de cola en lugar de extraer repetidamente el primer elemento.
- Precalcular los candidatos del catálogo por consulta cuando el perfilado lo justifique. Evitar una segunda consulta de plan por cada carta.

Salida: primera página con carga de presentación limitada a 12 entidades y ranking probado. Esta etapa reduce hidratación, pero todavía puede evaluar todos los candidatos ligeros: no debe presentarse como paginación completa de base.

### Etapa 3 — Paginación real y recuperación indexada

Diseño objetivo: un conjunto elegible ligero común para perfiles y cartas, orden global de BR-031, selección de página y recién después hidratación. No añadir simplemente `LIMIT 12` a cada consulta actual: perdería coincidencias y proveedores prioritarios antes de mezclar e intercalar.

1. Persistir una proyección de búsqueda normalizada y versionada, con evidencia propia de cada entidad y relaciones de catálogo necesarias. Actualizarla con edición/publicación, cambios de servicios, especialidades, cobertura y estado; resolver plan y vigencia contra datos autoritativos. Preparar backfill, reconciliación y comparación con el matcher actual antes de activarla.
2. Evaluar FTS5 para recuperar candidatos textuales y conservar pruebas de equivalencia para frases, alias, tildes, exclusiones y actividades concretas. FTS no reemplaza automáticamente estas reglas. Para subcadenas, evaluar tokenizer y términos cortos explícitamente. D1 documenta que `LIKE` con `%` inicial no aprovecha un B-tree común y propone evaluar FTS5/trigramas; también recomienda verificar cada índice con `EXPLAIN QUERY PLAN`. [Guía oficial de índices](https://developers.cloudflare.com/d1/best-practices/use-indexes/).
3. Prototipar las rondas en SQL con `ROW_NUMBER()` particionado por plan, evidencia y proveedor, ordenando cartas antes de perfil y luego relevancia, reputación e ID. Calcular por separado la mejor relevancia/reputación de cada proveedor en el grupo. Orden global: plan, evidencia, número de ronda, mejor puntuación del proveedor e ID. SQLite admite [funciones de ventana](https://www.sqlite.org/windowfunctions.html); esto no garantiza evitar un sort de todo el conjunto, por lo que se debe medir en D1.
4. Generar conteos de entidades y proveedores distintos desde el **mismo conjunto elegible**. Los actuales `countForSearch`/`count` cuentan candidatos SQL y pueden diferir del matcher. No sumar proveedores de cartas y perfiles ni presentar el tope 48+48 como total real. Si calcular totales sigue siendo costoso, optimizar o reutilizar el conjunto; cambiar a estimaciones requeriría otra decisión funcional.
5. Entregar sólo las siguientes 12 entidades, con `hasMore`, totales y cursor opaco validado. El cursor vincula filtros normalizados, versión del ranking/datos y posición en el orden. Obtener una entidad adicional puede determinar `hasMore` sin hidratarla. El cliente agrega resultados por identidad estable y conserva posiciones absolutas.
6. Para continuidad estable entre peticiones, materializar temporalmente IDs ordenados y totales por búsqueda si recalcular las ventanas resulta costoso. Acotar tamaño, duración y almacenamiento; medir el costo de escrituras D1 antes de elegir esta opción. Un cursor sobre puntuaciones vivas por sí solo no evita omisiones si cambian planes o relevancia.
7. Revalidar visibilidad antes de entregar una página. Ante cambios de plan, publicación o filtros que invaliden el conjunto, reiniciar explícitamente la búsqueda y su cursor; no mezclar silenciosamente versiones. Definir expiración y recuperación de enlaces `page=N`, recarga y navegación atrás sin volver a transferir todas las páginas anteriores en cada carga adicional.

Salida: sin límite arbitrario de candidatos por tipo, respuestas de tamaño acotado y continuidad del ranking. Aceptar el prototipo SQL sólo si coincide con el ranking de referencia y mejora las mediciones; si persiste matching en aplicación, una materialización ligera es un paso intermedio, no una afirmación de que la consulta inicial ya escala con 12 filas.

### Etapa 4 — Caché y experiencia del cliente

- Mantener inicialmente el transporte por Server Action para aislar las mejoras del backend. Evaluar un Route Handler GET si las mediciones justifican cancelación, inspección HTTP o caché compartida. Cambiar POST por GET no corrige una consulta lenta por sí solo.
- Cachear datos públicos o conjuntos ordenados, nunca respuestas con IDs analíticos de otra ejecución. Incluir filtros canónicos, versión de catálogo, ranking y datos; invalidar con publicaciones, suspensiones y cambios efectivos de plan. TTL por sí solo no satisface retiro inmediato de perfiles suspendidos.
- Revisar compatibilidad de OpenNext/Cloudflare antes de elegir APIs de caché. Se consultaron las guías de la versión instalada de Next en `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` y `01-app/01-getting-started/08-caching.md`; no asumir que una llamada D1 queda cacheada automáticamente.
- Conservar esqueletos, agregar páginas sin remontar la grilla completa y proteger contra respuestas obsoletas. Mantener identidad de la búsqueda y registrar cada página/posición sin volver a contar exposiciones anteriores como nuevas por un remonte.

## 4. Validación y entrega

| Área | Criterio de aceptación |
| --- | --- |
| Prioridad | Platino elegible precede a Oro y Cobre, incluso si hay evidencia de distinto nivel; ninguna prioridad comercial permite un resultado irrelevante. |
| Intercalación | Dos proveedores del mismo plan/nivel alternan hasta agotar sus colas; cartas antes de perfil dentro de su cola; un único proveedor puede repetirse. |
| Identidad | Una entidad aparece una vez; perfil y carta son entidades distintas. Los empates tienen orden reproducible. |
| Planes | Perfiles y cartas heredan el mismo plan efectivo; verificar pruebas, cancelación vigente, vencimiento y baja. |
| Paginación | Al unir páginas se obtiene exactamente el ranking completo del mismo conjunto; probar cortes dentro de rondas y entre planes, última página, cursor inválido/vencido y cambio de filtros. |
| Recuperación | Más de 48 candidatos por tipo; Platino ubicado fuera del antiguo recorte sigue apareciendo; conteos de proveedores deduplicados y cero resultados real. |
| Visibilidad | Desactivar perfil, carta, especialidad o servicio impide exposición; cambiar plan no deja galerías excedentes ni prioridad anterior en caché. |
| Rendimiento | Hidratación sólo de la página; cada carga adicional transmite como máximo 12 entidades nuevas; no hay sincronización de galería por candidato; registrar p50/p95, CPU, consultas, filas leídas/escritas y bytes. |

Ampliar `scripts/check-backend.ts` para fixtures de ranking y equivalencia; usar integración D1 local/preview para SQL, conteos y cambios de estado, y pruebas del navegador para append, URL y analítica. Ejecutar `npm run check:backend`, `npm run typecheck`, `npm run lint` y build/preview pertinentes durante la implementación, no como prueba de rendimiento de este cambio documental.

Entregar en incrementos: medición → proyección ligera y ranking → índice/consulta paginada y contrato cliente → caché opcional. Comparar IDs elegibles con el buscador anterior; las diferencias de orden por BR-031 son esperadas. Activar gradualmente con versión de ranking y mecanismo de vuelta a la ruta anterior; invalidar cursores al cambiar versión y dejar explícito que volver al código anterior también revierte temporalmente la prioridad comercial. No retirar la ruta anterior hasta validar equivalencia, rendimiento y actualización de datos derivados.
