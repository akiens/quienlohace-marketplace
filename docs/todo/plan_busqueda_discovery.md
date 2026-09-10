# Plan de implementación: búsqueda y discovery en QuienLoHace

Fecha: 2026-09-09. Estado: MVP implementado el 2026-09-09.

## Estado de implementación

La aplicación ya incorpora interpretación normalizada contra el catálogo, alias y necesidades editoriales iniciales; recuperación por frases y términos centrales; sugerencias tipográficas; ranking por evidencia antes que reputación; diversidad suave entre cartas sin eliminar propuestas; motivos visibles; modalidad inferida como filtro opcional; filtros conservados; comprobaciones acotadas para ampliar filtros; y discovery relacionado o general cuando el total directo es cero.

La primera vista muestra seis elementos por bloque. Las recomendaciones permanecen fuera del total de coincidencias y respetan el tipo de resultado y los demás filtros explícitos. Se agregaron pruebas de frases largas, oficios, actividad específica, errores y negaciones al check de backend.

Quedan como evoluciones medidas: índice FTS5 y cursores de base cuando volumen/latencia lo requieran, instrumentación persistente después de definir privacidad y retención, evaluación semántica y publicación de necesidades. No se presentan como funciones disponibles.

## 1. Decisión recomendada

El usuario debería poder escribir **qué necesita**, sin conocer la diferencia entre proveedor, servicio declarado y carta de servicio. Por defecto se buscan todas las entidades publicables, pero se presentan en grupos claros y se ordenan por relevancia dentro de cada grupo.

La búsqueda debe resolver tres preguntas diferentes:

1. **¿Quién ofrece esto?** Perfiles que declaran una actividad o especialidad relevante.
2. **¿Qué puedo contratar concretamente?** Cartas que describen una oferta pertinente.
3. **¿Por dónde puedo empezar?** Especialidades, necesidades y alternativas para explorar cuando la intención es amplia o no hay coincidencias.

Equilibrar no significa repartir 50 % de lugares a perfiles y 50 % a cartas. Significa mostrar opciones útiles, impedir que un proveedor monopolice la pantalla y dar visibilidad a proveedores pertinentes aunque no tengan cartas ni reseñas.

Recomendación inicial: **búsqueda textual normalizada + alias + interpretación del catálogo + diversidad por proveedor + discovery editorial**. La búsqueda semántica queda como una evolución que se justifica con consultas reales que el sistema no logra resolver.

## 2. Situación comprobada en el repositorio

| Pieza | Comportamiento actual | Consecuencia |
| --- | --- | --- |
| `profiles` | Representa al profesional o empresa. | Es la entidad que presta y responde por el servicio. |
| `services` | Texto confirmado por el proveedor, asociado a una especialidad. | Sirve como evidencia de lo que ofrece; no necesita una carta. |
| `service_cards` | Oferta independiente ligada al perfil y a una fila concreta de `services`; la especialidad se deriva de ese servicio. | El nombre del servicio vinculado participa de la recuperación textual de la carta. |
| `src/data/services.ts` | Ya normaliza texto y busca nombres, alias, especialidades y rubros para autocompletado. | Hay una base útil para interpretar consultas, aunque no constituye el buscador público de proveedores. |
| `D1ProfileRepository.search` | Usa `LIKE` con la frase en nombre, descripción o servicio activo; ordena por promedio de reseñas y cantidad. | Una buena coincidencia puede perder frente a una mención secundaria con más reputación. |
| `D1ServiceCardRepository.search` | Busca la frase en título, descripción o nombre del proveedor; prioriza título y luego reseñas y orden manual. | El nombre del proveedor puede hacer aparecer todas sus cartas; no hay límite de diversidad por proveedor. |
| `/buscar` | Consulta y cuenta perfiles y cartas por separado. | La orquestación está distribuida entre página y repositorios. |
| `SearchExperience` | Con texto muestra cartas primero; sin texto, perfiles primero. | Ya existe presentación agrupada compatible con BR-031. |

Las búsquedas públicas revisadas no usan los alias del catálogo para resolver texto libre. Tampoco hay allí recuperación por errores tipográficos ni expansión por necesidades. `geo` se serializa, pero las cláusulas SQL revisadas no lo convierten por sí mismo en distancia ni cobertura: no asumir que ya existe búsqueda por cercanía real.

Fuentes locales: [reglas de negocio](../rules/business_rules.md), [reglas técnicas](../rules/technical_rules.md), [catálogo canónico](../data/rubros_especialidades_servicios.md), [página de búsqueda](../../src/app/buscar/page.tsx), [repositorio de perfiles](../../src/infrastructure/d1-profile-repository.ts), [repositorio de cartas](../../src/infrastructure/d1-service-card-repository.ts) y [autocompletado](../../src/data/services.ts).

## 3. Experiencia de usuario

### Sin especificar el tipo de resultado

Mantener un único campo: «¿Qué necesitás resolver?». Dejar «Todos» como estado por defecto; el filtro existente permite restringir a independientes, empresas o cartas.

Mostrar bloques con una primera tanda breve, por ejemplo hasta seis elementos por bloque, y controles para ver más. Es un parámetro inicial de diseño, a validar en móvil. Evita que 48 cartas empujen todos los perfiles muy abajo.

Mantener el orden actual de BR-031: cartas primero con consulta; perfiles primero al explorar. Omitir bloques vacíos. Si hay una coincidencia exacta de nombre de proveedor, destacar dentro de su bloque «Coincide con el nombre que buscaste». Una futura decisión de colocar ese perfil antes de las cartas requeriría actualizar BR-031; no introducirla silenciosamente.

Usar etiquetas comprensibles:

- **Propuestas de servicio:** ofertas concretas, con precio cuando existe.
- **Profesionales y empresas:** proveedores relevantes, mostrando el servicio o especialidad que explica la coincidencia.
- **Explorá estas especialidades:** enlaces de navegación, sin contarlos como proveedores ni ofertas.
- **Opciones relacionadas:** alternativas de menor certeza, con su motivo visible.

Los servicios declarados no necesitan un tercer listado de tarjetas casi duplicadas: se muestran como evidencia dentro del perfil, por ejemplo «Ofrece: reparación de calefones». Los elementos del catálogo son navegación y vocabulario, no oferta disponible.

### Ejemplos de comportamiento esperado

| Consulta | Interpretación | Qué mostrar |
| --- | --- | --- |
| `electricista` | Oficio/especialidad, aunque no sea el título literal de una oferta. | Perfiles con especialidad activa correspondiente y cartas pertinentes de esa especialidad. |
| `instalar aire acondicionado` | Actividad concreta. | Cartas de instalación y perfiles que la declaran; mantenimiento queda como relacionado si no prueba instalación. |
| `Sanitaria López` | Posible nombre comercial. | Coincidencia de perfil; las cartas recuperadas solo por ese nombre se identifican como ofertas de ese proveedor. |
| `pierde agua la canilla` | Problema expresado en lenguaje cotidiano. | Resolver mediante una necesidad editorial hacia reparación de grifería; si solo hay evidencia de especialidad, presentarla como alternativa. |
| `plomreo` | Posible error tipográfico. | Sugerir «¿Quisiste decir plomero?» sin reemplazar el texto silenciosamente. |
| `reforma` | Intención amplia. | Orientación hacia albañilería, pintura y otras especialidades pertinentes, con oferta real cuando exista. |
| `fotografía submarina` sin oferta | Necesidad válida sin oferta comprobable. | Explicar la ausencia y ofrecer explorar fotografía; no afirmar que cualquier fotógrafo hace trabajo submarino. |
| `xyzabc` | No se reconoce intención. | Informar que no hay coincidencias y mostrar acceso general a categorías, identificado como exploración. |
| Vacío | Discovery. | Perfiles, propuestas y categorías con oferta disponible, respetando los filtros elegidos. |

Los términos y relaciones de estos ejemplos son casos a validar contra el catálogo antes de codificarlos.

## 4. Interpretación y recuperación

Flujo propuesto: **consulta y filtros → normalización → interpretación → candidatos elegibles en D1 → relevancia → diversidad → bloques y alternativas**.

### Normalización

- Reutilizar y extraer la normalización existente: minúsculas, diacríticos y espacios. Conservar siempre el texto original para mostrarlo.
- Tokenizar y admitir distinto orden de palabras. En consultas breves, exigir los términos centrales en la recuperación principal. En frases largas, resolver primero los conceptos centrales según la sección siguiente: exigir cada palabra de la oración perdería ofertas pertinentes. No convertir una consulta específica en un OR indiscriminado.
- Tratar palabras funcionales con cuidado: no eliminar negaciones de una frase y transformarla en una intención contraria.
- Normalizar también los documentos indexados; normalizar solo la consulta no arregla las tildes en la base.
- Acotar longitud del texto y expansiones internas, sin recortar los valores de filtros seleccionados que BR-031 permite. Resolver límites de parámetros SQL mediante una estrategia compatible, no descartando filtros.
- Construir consultas parametrizadas y escapar la sintaxis del buscador. En el fallback con `LIKE`, `%` y `_` escritos por el usuario deben ser literales.

### Resolver intención sin inventar oferta

Combinar señales: nombre exacto de perfil, nombres/alias de servicios del catálogo, nombres/alias de especialidades y necesidades editoriales. La interpretación produce candidatos y un nivel de confianza explicable; no asigna especialidades al perfil del proveedor.

Regla esencial: **entender el servicio que se busca no demuestra que todos los proveedores de esa especialidad lo ofrecen**.

Para una actividad específica, un alias canónico puede recuperar servicios declarados que coincidan inequívocamente con ese concepto dentro de su especialidad. Si el texto personalizado no permite establecer esa relación, conservarlo como texto buscable y evitar vincularlo automáticamente por mera proximidad.

No indexar todos los servicios posibles de una especialidad dentro de cada perfil o carta. Eso crearía falsas coincidencias: pertenecer a electricidad no prueba que se instalan paneles solares.

### Recuperación por niveles

1. **Coincidencia directa:** nombre, título, servicio declarado o texto pertinente.
2. **Equivalencia conocida:** alias validado del mismo concepto; puede pertenecer al bloque principal si hay evidencia de oferta.
3. **Coincidencia de especialidad:** principal para consultas de oficio; relacionada para una actividad específica que no está declarada.
4. **Corrección sugerida:** error tipográfico sobre vocabulario conocido, con umbral conservador y sin corregir automáticamente nombres propios.
5. **Discovery:** navegación editorial cuando lo anterior no resuelve la necesidad.

Con pocos resultados, conservar los directos arriba y completar con un bloque relacionado separado. Nunca aumentar el contador de coincidencias directas usando recomendaciones generales.

Si no hay resultados, distinguir entre «no reconocimos la consulta», «reconocimos el servicio pero no hay oferta» y «hay oferta fuera de estos filtros»; la última afirmación requiere una consulta de comprobación. Proponer acciones concretas como quitar el mínimo de estrellas o ampliar zona. Aplicarlas solo cuando el usuario las elija.

### Frases largas y coincidencias no literales

Ejemplo de entrada: «Necesito alguien que venga a casa porque el aire acondicionado prende pero no enfría».

| Fragmento | Interpretación propuesta | Uso |
| --- | --- | --- |
| «Necesito alguien» | Expresión introductoria. | No exigirla para recuperar ofertas. |
| «venga a casa» | Preferencia de atención a domicilio. | Mostrar la modalidad interpretada; no agregar silenciosamente un filtro restrictivo. |
| «aire acondicionado» | Equipo sobre el que se necesita ayuda. | Concepto central que debe conservarse. |
| «prende pero no enfría» | Síntoma compatible con diagnóstico/reparación. | Recuperar esas actividades mediante relaciones editoriales; no diagnosticar una causa técnica. |

Una oferta llamada «Diagnóstico y reparación de aires acondicionados» puede ser pertinente aunque no comparta la frase literal. Una oferta de instalación no debe ganar solo por mencionar el mismo equipo.

Combinar tres mecanismos con responsabilidades distintas:

1. **Texto flexible:** tildes, mayúsculas, orden de palabras y correcciones tipográficas conservadoras sobre vocabulario conocido. Resuelve diferencias de escritura, no entiende por sí solo un síntoma.
2. **Alias y relaciones editoriales:** expresiones cotidianas → actividades o especialidades candidatas. «Canilla que gotea» puede relacionarse con reparación de grifería; «humedad en una pared» admite varias interpretaciones y no debe asignarse automáticamente a una única solución.
3. **Semántica, en la etapa opcional:** comparar representaciones numéricas de significado de la consulta y de las ofertas para recuperar candidatos que no comparten palabras. Validar después elegibilidad y pertinencia; la similitud no prueba una prestación ni un diagnóstico.

Extender `interpretation` con actividad, objeto/equipo, problema, preferencias, exclusiones y ambigüedades. Cada interpretación debe conservar el fragmento original que la respalda y su origen: literal, alias, relación editorial o semántica. La primera implementación puede usar reglas y catálogo; este contrato no exige un LLM.

Conservar negaciones y relaciones: «quiero reparar, no comprar uno nuevo» no debe favorecer venta. Si el sistema no puede resolver una exclusión con suficiente certeza, pedir precisión o presentar alternativas separadas; no borrarla como palabra de relleno. Las preferencias inferidas no sustituyen los filtros explícitos. Ante conflicto, mantener los filtros y ofrecer corregirlos mediante una acción visible.

Si hay ambigüedad, mostrar una pregunta breve junto a opciones útiles: para «arreglar una bomba», proponer agua, piscina o combustible. Al elegir, actualizar la consulta de forma visible y compartible en la URL, conservando los demás filtros. Conservar la posibilidad de reformular libremente.

La recuperación debe mantener el objeto y la actividad/problema centrales, aceptar equivalencias validadas y ponderar contexto secundario. Si hace falta relajar un concepto central, los resultados pasan al bloque de relacionados. No basta con un umbral de cantidad de palabras coincidentes.

### Protocolo cuando no hay coincidencias

Ejecutar una secuencia acotada, reutilizando la interpretación y deteniéndose cuando haya un siguiente paso útil:

| Paso | Comprobación | Respuesta visible |
| --- | --- | --- |
| 1. Recuperar diferencias de lenguaje | Normalización, alias y errores probables. | Coincidencias por equivalencia comprobada o «¿Quisiste decir…?» cuando se necesita confirmación. |
| 2. Comprobar restricciones | Consultas de existencia relajando criterios concretos, conservando siempre elegibilidad pública. | «Hay opciones si quitás el mínimo de estrellas», únicamente si se comprobó. |
| 3. Buscar especialidad relacionada | Existe una relación conocida y hay proveedores elegibles con los filtros actuales. | «Profesionales a quienes podés consultar», aclarando que no se encontró el trabajo publicado. |
| 4. Precisar o explorar | La intención es ambigua o desconocida. | Opciones para aclarar la necesidad; categorías generales si no hay interpretación defendible. |
| 5. Capturar demanda, cuando exista el flujo | No hay oferta exacta y la persona quiere publicar su necesidad. | «Publicar lo que necesitás», con un formulario y confirmación propios. |

Los pasos 2 y 3 son comprobaciones diferentes: puede haber oferta exacta fuera de los filtros y especialistas relacionados dentro de ellos. Presentarlas con etiquetas distintas. Si se seleccionó solo cartas, ofrecer cambiar a proveedores como acción; no insertar perfiles contrariando ese filtro.

Acotar las comprobaciones de filtros a unas pocas alternativas útiles y usar consultas de existencia o conteos, sin hidratar resultados completos ni probar todas las combinaciones posibles. No atribuir el vacío a una restricción sin comprobarlo. Si solo se comprobó que quitar ubicación permite resultados, decir «Ver opciones sin el filtro de zona»; no afirmar que son cercanos.

Ejemplo de estado vacío, cuando estén comprobadas las alternativas y habilitado el flujo de solicitudes:

> No encontramos ofertas de restauración de bañeras con estos filtros.
> Podés consultar profesionales de especialidades relacionadas o publicar tu solicitud.
>
> [Ver profesionales relacionados] [Publicar lo que necesito]

Si no hay especialistas pertinentes, omitir esa acción. Mientras no exista el flujo de solicitudes, no mostrar su botón. Las recomendaciones generales nunca se suman al total de coincidencias.

### Estado vacío acompañado de propuestas para explorar

Decisión de producto: cuando no haya coincidencias, evitar una pantalla que termine únicamente en el mensaje de ausencia. Mostrar un bloque de exploración siempre que exista oferta pública elegible o categorías útiles hacia las que navegar.

Texto recomendado:

> No encontramos lo que buscás, pero esto podría interesarte.

Debajo, explicar por qué se muestran esas opciones:

- Si hay relación comprobable con la necesidad: **«Opciones relacionadas»**, con el motivo correspondiente, por ejemplo «Profesionales de climatización».
- Si no se pudo establecer una relación: **«Explorá otros servicios»**, con una aclaración breve: «Estas opciones son para seguir explorando; no coinciden con tu búsqueda».

Seleccionar primero alternativas de la actividad o especialidad interpretada. Si tampoco existen, recuperar una selección general de perfiles o cartas públicos que respeten los filtros explícitos, quitando únicamente la condición textual en esta consulta separada de discovery. Mostrar inicialmente hasta seis opciones, diversificando proveedores y especialidades cuando los filtros lo permitan. Reutilizar el orden de discovery y no presentar esta selección como personalizada ni popular sin datos que lo respalden.

El bloque general no necesita esperar a que se implemente semántica. Mantener el texto buscado, los filtros, el contador de cero coincidencias y las acciones para reformular. Respetar también el tipo de entidad seleccionado: si se pidieron solo cartas, las recomendaciones de resultados deben ser cartas.

Si los filtros excluyen toda la oferta, mostrar categorías como enlaces de navegación y acciones comprobadas para ampliar filtros. No rellenar el bloque con proveedores fuera de cobertura sin advertirlo ni retirar restricciones automáticamente. Si no existe oferta pública en absoluto, ofrecer reformulación y, cuando esté implementada, publicación de la necesidad; no fabricar tarjetas para llenar la pantalla.

Medir impresiones y clics de este bloque como discovery, separados de los resultados de búsqueda. Evaluar si genera contactos útiles, sin considerar que una búsqueda dejó de tener cero coincidencias por mostrar alternativas.

Registrar el motivo del vacío con estados como `unrecognized_query`, `ambiguous_query`, `filtered_out` y `no_confirmed_supply`, además de la acción elegida. «No hay oferta comprobada» describe lo que el sistema pudo verificar, no garantiza que nadie en el marketplace pueda hacer ese trabajo. Revisar muestras para distinguir fallas de interpretación/indexación de demanda sin oferta; las primeras alimentan mejoras del buscador, las segundas orientan la incorporación de proveedores.

## 5. Relevancia y equilibrio

### Orden orgánico

Usar niveles de coincidencia antes que un puntaje global. Una coincidencia específica no debe ser desplazada por una mención débil debido al plan o a reseñas.

Dentro de cada grupo, ordenar por:

1. Nivel de evidencia: exacta, equivalente, textual completa, contexto relacionado.
2. Relevancia textual dentro del nivel: campo coincidente, cobertura de términos y precisión.
3. Calidad secundaria: reputación ajustada por cantidad de opiniones y señales comprobables de confianza.
4. Desempate estable por identificador; en discovery, rotación estable durante una sesión o período.

Para reputación se puede evaluar un promedio suavizado `(v × R + m × C) / (v + m)`, donde `R` es promedio, `v` cantidad, `C` media de referencia y `m` fuerza del ajuste. Calibrar `m` con datos. Este valor es interno: no sustituye las estrellas visibles y un perfil sin reseñas continúa mostrando «Sin opiniones».

No usar cantidad de cartas, repetición de palabras ni cambios frecuentes de fecha como ventajas orgánicas. La verificación es una señal limitada de confianza, no evidencia de que se presta una actividad concreta.

### Diversidad

- La vista general conserva todas las cartas recuperadas. Entre propuestas de relevancia cercana, adelanta la del proveedor menos mostrado; si otra carta del mismo proveedor es claramente mejor, conserva su posición.
- La ventana inicial de diversidad es de 8 puntos sobre el puntaje interno compuesto por nivel de evidencia, precisión textual y calidad secundaria. Este valor es calibrable con la referencia de calidad; no se muestra como una puntuación pública.
- «Mostrar más» continúa recorriendo el mismo conjunto reordenado: ninguna carta se elimina por repetirse el proveedor. Cuando se implemente paginación de base, el cursor debe conservar este orden y el historial de apariciones necesario para mantener la misma regla entre páginas.
- Perfiles: una aparición por perfil. Que aparezca también una carta suya en otro bloque es válido porque responde otra pregunta.
- Aplicar el orden base y la diversidad sobre los candidatos antes de paginar. La implementación MVP reordena la tanda recuperada y no elimina filas; al introducir cursores, el orden debe pasar a la capa de persistencia para no variar entre páginas.
- Registrar por separado total de ofertas y proveedores únicos. Ejemplo: «18 propuestas de 7 proveedores».
- Discovery puede reservar una posición rotativa entre candidatos elegibles y pertinentes para proveedores sin exposición. Empezar con una regla estable y medible; no privilegiar usuarios nuevos irrelevantes ni afirmar equidad estadística antes de medirla.

BR-007 contempla posiciones destacadas y rotativas de Platino. Propuesta: conservarlas en un espacio identificado y separarlas del ranking orgánico; antes de implementar ese cambio, reconciliar expresamente la redacción de BR-007. Este plan no cambia derechos comerciales existentes.

## 6. Discovery inicial

Discovery ayuda a elegir cuando todavía no hay una consulta precisa; no necesita personalización individual para aportar valor.

Crear colecciones editoriales pequeñas basadas en necesidades, por ejemplo «Poner a punto la casa» o «Preparar una mudanza», vinculadas a especialidades y conceptos existentes. Cada colección tiene título, explicación, relaciones justificadas y estado de publicación.

Al abrir una colección, consultar oferta real elegible con los filtros vigentes. Ocultar o marcar colecciones sin disponibilidad; un conteo de servicios en el catálogo no es un conteo de proveedores.

En `/buscar` sin texto, mostrar categorías con disponibilidad y bloques de perfiles y cartas diversos. Con ubicación elegida, usar cobertura declarada. Evitar etiquetas como «cerca tuyo» si solo conocemos cobertura nacional/departamental y no distancia física. Mantener TR-019 en el MVP; cualquier cambio de ubicación según modalidad requiere una regla explícita.

No llamar «Más buscados» a una lista editorial ni «Disponible ahora» a un proveedor solo porque tenga un horario escrito. Popularidad, disponibilidad y tiempos de respuesta necesitan datos que los respalden.

## 7. Arquitectura propuesta

### Orquestación y contratos

Crear `src/application/search.ts` como punto de entrada para `/buscar`: coordina interpretación, consultas, conteos y recomendaciones. Mantener los filtros de elegibilidad en SQL, conforme a TR-019; no descargar perfiles completos para filtrarlos en el navegador.

Agregar un puerto de búsqueda en `src/domain/ports.ts` y un adaptador `src/infrastructure/d1-search-repository.ts`. Reutilizar repositorios actuales para detalle y escrituras, evitando dos implementaciones públicas de la misma regla.

Contrato conceptual de respuesta:

| Campo | Contenido |
| --- | --- |
| `query` | Texto original y normalizado. |
| `interpretation` | Intenciones candidatas, confianza y explicación; sin fingir probabilidades calibradas. |
| `profiles` | Resultados, total y cursor propio. |
| `serviceCards` | Representantes, total de ofertas, total de proveedores y cursor propio. |
| `related` | Alternativas con motivo y conteos separados. |
| `discovery` | Colecciones/especialidades y disponibilidad. |
| `suggestedActions` | Cambios de consulta o filtros con URL explícita. |

Cada resultado incluye un `matchReason` basado en evidencia, por ejemplo `declared_service`, `card_title`, `provider_name` o `specialty_related`. Los conteos y listados comparten exactamente las mismas condiciones.

### Índice textual en D1

Proponer una tabla derivada `search_documents` y un índice FTS5. D1 documenta soporte de FTS5; validar las operaciones y migraciones concretas en el entorno local y de preview del proyecto antes de adoptar la solución. [Documentación oficial de D1](https://developers.cloudflare.com/d1/sql-api/sql-statements/).

`search_documents` tendría: identificador estable, tipo (`profile` o `service_card`), entidad original, perfil propietario, campos textuales separados y versión de indexación/catálogo. Mantener columnas distintas para nombre/título, servicios declarados, descripción y contexto; no concatenar todo con el mismo peso.

Los alias se incorporan solamente cuando hay una asociación comprobable con el concepto ofrecido. Rubros y especialidades son contexto separado. La búsqueda sobre vocabulario del catálogo puede ejecutarse sobre sus datos generados, pero la selección de oferta pública sigue en D1.

El índice recupera candidatos; las tablas originales deciden elegibilidad actual: perfil activo, especialidad activa, servicio activo, carta activa y publicada, filtros y condiciones de publicación aplicables. Una copia desactualizada del índice nunca debe reexponer contenido retirado.

Definir desde el inicio la sincronización:

- Alta/edición de perfil o carta: regenerar los documentos afectados al confirmar la escritura.
- Cambios de servicios o especialidades: regenerar documento de perfil y cartas afectadas.
- Bajas, suspensión, downgrade y borrado: retirar documentos o actualizar su contenido, conservando además el control público en la consulta.
- Cambio de nombre del proveedor: actualizar también sus documentos de cartas.
- Cambio de catálogo/alias: reindexación versionada e idempotente.
- Reconstrucción completa y comprobación de divergencias: script administrativo repetible.

Preferir consistencia en el mismo lote de escritura donde sea viable y comprobada; si se utiliza una cola, persistir el trabajo pendiente junto a la mutación y definir reintentos. El control público evita filtraciones por obsolescencia, pero no evita omisiones: medir también altas/ediciones que no llegan al índice.

No agregar una FK obligatoria desde los servicios libres al catálogo de sugerencias: contradiría TR-022. Tampoco hacer depender el MVP de vincular cada carta a un servicio declarado.

### Paginación y costo

Paginación independiente por bloque, orden total estable y cursor validado que incluya identidad de consulta/filtros y versión relevante. Los cambios de filtros reinician cursores. Documentar que modificaciones concurrentes de la oferta pueden cambiar resultados; si luego se exige una navegación inmutable, hará falta un snapshot.

En cartas, seleccionar primero el mejor resultado por perfil y luego ordenar/paginar representantes. Verificar índices y planes de ejecución; evitar cargar imágenes y relaciones hasta tener los IDs de la página. La documentación de D1 recomienda inspeccionar consultas con `EXPLAIN QUERY PLAN`. [Guía oficial de índices](https://developers.cloudflare.com/d1/best-practices/use-indexes/).

## 8. Etapas de implementación

### Etapa 0 — Especificación y referencia de calidad

- [ ] Crear un conjunto de 40–60 consultas: nombres, oficios, actividades, alias uruguayos, errores, necesidades, consultas sin oferta y filtros combinados.
- [ ] Incluir frases largas, negaciones, síntomas ambiguos y conflictos entre preferencias escritas y filtros explícitos.
- [ ] Definir resultados esperados, resultados inadmisibles y motivo de coincidencia, con fixtures de oferta conocida.
- [ ] Medir comportamiento actual: relevancia de primeros resultados, cero resultados, duplicación por proveedor y latencia.
- [ ] Documentar precisiones de BR-031, BR-007 y TR-019 necesarias para ranking, conteos, diversidad y alternativas.

Entrega: criterios verificables y decisiones de producto versionadas. No bloquear correcciones compatibles esperando decisiones de monetización futuras.

### Etapa 1 — MVP de búsqueda pertinente

- [ ] Extraer normalización y resolver nombres/alias del catálogo sin duplicar la lógica del autocompletado.
- [ ] Implementar interpretación básica de frases largas, conservando conceptos centrales, preferencias, negaciones y fragmentos de evidencia.
- [ ] Implementar `application/search`, puerto, adaptador e índice derivado con backfill y sincronización.
- [ ] Aplicar recuperación por términos y equivalencias, con elegibilidad pública en SQL.
- [ ] Priorizar relevancia antes que reputación e incorporar razones de coincidencia.
- [x] Limitar la primera tanda de cada bloque y aplicar diversidad suave sin eliminar cartas del mismo proveedor.
- [ ] Mantener URLs/filtros actuales; añadir parámetros de paginación con valores validados.
- [ ] Actualizar comentarios obsoletos que todavía dicen que las cartas no existen.

Entrega: una búsqueda por oficio/alias encuentra oferta pertinente aunque la frase exacta no aparezca; un proveedor sin cartas sigue siendo encontrable.

### Etapa 2 — Cero resultados y discovery

- [ ] Crear una fuente editorial versionada de necesidades y colecciones, usando IDs existentes y validando referencias.
- [ ] Incorporar sugerencias tipográficas conservadoras.
- [ ] Separar coincidencias, relacionados y exploración; añadir acciones explícitas para ampliar filtros.
- [ ] Implementar el protocolo de cero coincidencias: comprobaciones acotadas de restricciones, aclaraciones de intención y clasificación del motivo del vacío.
- [ ] Mostrar categorías y colecciones con oferta real en búsquedas vacías.
- [ ] Acompañar cero coincidencias con «No encontramos lo que buscás, pero esto podría interesarte», propuestas relacionadas o exploración general elegible, según la regla de estado vacío acompañado.
- [ ] Añadir motivos visibles y estados vacíos específicos.

Entrega: el buscador ofrece un siguiente paso útil sin atribuir servicios inexistentes.

### Etapa 3 — Medición y ajustes

- [ ] Registrar `search_submitted`, `result_impression`, `result_clicked`, `contact_clicked`, `query_reformulated` y `suggestion_clicked`.
- [ ] Asociar versión de ranking, bloque, posición, tipo, entidad y proveedor; deduplicar impresiones al repetir renderizados.
- [ ] Medir clic a contacto por búsqueda, relevancia evaluada, reformulación, cero resultados, latencia p50/p95 y concentración de exposición por proveedor entre candidatos elegibles.
- [ ] Distinguir clic de contacto de contratación real: todavía no prueba una venta ni satisfacción.
- [ ] Separar vacíos por consulta incomprendida, ambigüedad, filtros y falta de oferta comprobada; medir recuperación por sugerencia, reformulación o ampliación de filtros.
- [ ] Minimizar datos personales en consultas registradas, definir retención y restringir acceso; no guardar indiscriminadamente frases con teléfonos o direcciones.
- [ ] Ajustar ranking y rotación con evidencia. Usar comparación offline si el tráfico aún no permite un experimento confiable.

Entrega: decisiones de ranking fundamentadas y detección de demanda sin oferta.

### Etapa 4 — Semántica, solo si aporta

Evaluar embeddings si una fracción relevante de consultas útiles sigue sin resolverse con vocabulario y necesidades editoriales. Comparar sobre el mismo conjunto de evaluación y medir costo y latencia antes de elegir infraestructura.

Combinar candidatos textuales y semánticos conservando coincidencias exactas, filtros, diversidad y evidencia. La similitud semántica sirve para descubrir relaciones, no para afirmar que un proveedor ofrece un servicio no declarado. Mantener fallback textual y posibilidad de desactivar esta etapa.

### Evolución posterior al MVP — Publicar una necesidad

Esta evolución puede realizarse independientemente de la etapa semántica. Crear solicitudes de demanda permite que proveedores compatibles encuentren trabajos buscados aunque todavía no tengan una carta para ellos. Requiere un flujo propio, no guardar y publicar automáticamente la consulta del buscador.

- [ ] Diseñar «Publicar lo que necesitás», precargando la frase como borrador editable, con descripción, zona y modalidad; permitir una categoría pendiente de precisar.
- [ ] Definir autoría y acceso, visibilidad de datos de contacto, moderación y límites contra spam, estados de publicación, cierre y vencimiento.
- [ ] Crear persistencia independiente para solicitudes y respuestas/interés de proveedores, con permisos para editar y cerrar la propia solicitud.
- [ ] Mostrar una revisión antes de publicar y confirmar que la solicitud es pública según la visibilidad elegida.
- [ ] Permitir a proveedores elegibles explorar solicitudes compatibles por especialidad y cobertura, sin afirmar que estén obligados o disponibles para responder.
- [ ] Definir cómo responde el proveedor y cómo la persona ve esas respuestas. Las notificaciones requieren preferencias explícitas; publicar no equivale a autorizar envíos masivos.
- [ ] Medir solicitudes publicadas, proporción con respuesta pertinente, tiempo hasta primera respuesta y cierre informado; no prometer contratación ni respuesta garantizada.

Entrega: una salida real para demanda sin oferta publicada. Antes de construirla, documentar su modelo, reglas y contratos en un plan específico. No es un requisito para lanzar las mejoras de búsqueda ni debe representarse como una funcionalidad existente.

## 9. Archivos a intervenir

| Archivo o área | Trabajo previsto |
| --- | --- |
| `src/application/search.ts` (nuevo) | Orquestación única. |
| `src/domain/ports.ts` y tipos de búsqueda | Contratos, razones, bloques y cursores. |
| `src/infrastructure/d1-search-repository.ts` (nuevo) | Recuperación, ranking, diversidad y conteos en SQL. |
| `src/infrastructure/d1-profile-repository.ts` y `d1-service-card-repository.ts` | Integrar sincronización del índice y retirar gradualmente búsqueda duplicada. |
| Flujos de publicación y cambios de plan | Propagar cambios de elegibilidad e indexación. |
| `src/data/services.ts`, `src/data/taxonomy.ts` | Reutilizar normalización y vocabulario, preservando contratos actuales. |
| Fuente editorial de discovery y generador (nuevos) | Necesidades, alias de intención y colecciones validadas. |
| `src/app/buscar/page.tsx` | Consumir el servicio de aplicación. |
| `src/components/search-experience.tsx` y grids | Bloques breves, razones, relacionados y paginación. |
| `src/lib/query.ts` | URLs de cursores y acciones sugeridas; preservar filtros existentes. |
| `migrations/` | Tablas/índices derivados; elegir el siguiente número libre al implementar. |
| `scripts/` | Reindexación, auditoría y evaluación de consultas. |
| `docs/rules/` | Formalizar decisiones adoptadas antes de cambiar comportamientos regulados allí. |

Antes de escribir código de Next.js, leer las guías pertinentes de `node_modules/next/dist/docs/`, según `AGENTS.md`.

## 10. Validación y despliegue

### Casos de aceptación imprescindibles

- Un perfil sin cartas aparece por su servicio declarado.
- Un oficio encuentra su especialidad aunque el proveedor no haya escrito ese oficio en su descripción.
- Una búsqueda concreta no retorna como coincidencia directa cualquier carta de su especialidad.
- Mayúsculas, tildes y orden de palabras no producen diferencias injustificadas.
- Un alias se relaciona con una oferta comprobable y no con todo el catálogo de una especialidad.
- Las cartas de un proveedor no se eliminan del listado. Entre coincidencias cercanas se alternan proveedores; una segunda carta claramente más relevante permanece antes que una alternativa débil.
- Todos los filtros se respetan también en relacionados y discovery; una ampliación requiere acción explícita.
- Un usuario que pide únicamente cartas no recibe perfiles como resultados; los accesos para cambiar el tipo se presentan como acciones.
- Conteos y cursores siguen siendo correctos con varios servicios coincidentes por perfil, empates y proveedores con muchas cartas.
- Despublicar una carta, suspender un perfil o desactivar una especialidad elimina su exposición aun si el índice está atrasado.
- Cambios de nombre, catálogo, servicios y plan actualizan el índice; el backfill puede repetirse sin duplicar documentos.
- Un proveedor sin reseñas puede aparecer por relevancia; con un mínimo explícito de estrellas se respeta su exclusión vigente.
- Una consulta desconocida no muestra recomendaciones generales como si fueran coincidencias.
- Con cero coincidencias y oferta elegible, aparece el bloque de propuestas para explorar; el contador permanece en cero y se distingue si las propuestas son relacionadas o generales.
- Si no existe oferta elegible para recomendar, aparecen acciones de navegación o ampliación explícita en lugar de tarjetas inventadas o incompatibles con los filtros.
- «Necesito alguien que venga a casa porque el aire acondicionado prende pero no enfría» recupera diagnóstico/reparación pertinente sin exigir toda la oración ni inferir una causa del fallo.
- «Quiero reparar, no comprar uno nuevo» conserva la exclusión de venta; si no puede interpretarla, ofrece aclaración.
- «Arreglar una bomba» ofrece interpretaciones sin elegir una arbitrariamente; seleccionar una conserva filtros y actualiza la URL.
- Una preferencia inferida de modalidad no reemplaza un filtro explícito contradictorio sin intervención del usuario.
- Las acciones para quitar filtros se sustentan en consultas de comprobación y no muestran contenido no publicable.
- Los motivos de cero coincidencias permiten distinguir problemas de interpretación de falta de oferta comprobada.
- El botón para publicar una necesidad no aparece antes de que exista un flujo funcional; la búsqueda nunca publica una solicitud por sí sola.

Ejecutar pruebas unitarias de interpretación/ranking y pruebas de integración con D1 para recuperación, elegibilidad, sincronización y paginación. Complementar con revisión de móvil, teclado, URL compartida y navegación atrás. Ejecutar `npm run lint`, `npm run typecheck`, `npm run check:data` y los checks de backend pertinentes según el cambio.

Desplegar con migración aditiva, backfill verificado y una bandera que permita volver al buscador anterior. Probar primero en local/preview y comparar resultados con la referencia de etapa 0. No quitar las consultas anteriores hasta validar calidad, frescura del índice y latencia con un presupuesto establecido a partir de las mediciones iniciales.

## 11. Alcance inicial recomendado

Implementar etapas 0 y 1 como primera entrega, seguida de etapa 2. Instrumentar la medición básica desde esa primera entrega, aunque los ajustes de etapa 3 vengan después.

El MVP incluye tratamiento básico de frases largas y los primeros cuatro pasos del protocolo de cero coincidencias. La publicación de necesidades es una evolución posterior; la semántica se evalúa por separado cuando la medición demuestre su utilidad.

El resultado buscado es concreto: alguien escribe lo que necesita, encuentra proveedores y propuestas pertinentes, entiende por qué aparecen y recibe un camino útil cuando no hay oferta exacta. El proveedor puede ser descubierto por lo que realmente declara ofrecer, sin depender de publicar muchas cartas.
