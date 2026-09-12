# Plan de implementación: búsqueda pertinente y resultados mezclados

Fecha: 2026-09-10. Estado: comportamiento principal implementado el 2026-09-10.

Actualización 2026-09-11: las decisiones de orden de este documento quedan sustituidas por BR-031 y el [plan de rendimiento y prioridad por plan](plan_busqueda_rendimiento_y_planes.md). La prioridad comercial aún está pendiente de implementación; la descripción siguiente conserva el contexto de la versión anterior.

Este plan sustituye las decisiones sobre recuperación, orden, diversidad y presentación de [plan_busqueda_discovery.md](plan_busqueda_discovery.md). El documento anterior queda como antecedente del primer buscador.

## Estado de implementación

El buscador ya interpreta oficios y actividades por separado, exige evidencia propia a cada resultado, prioriza coincidencias directas, mezcla perfiles y cartas en una sola lista y aplica rondas por proveedor dentro de cada nivel de evidencia. El catálogo canónico admite alias de especialidad y continúa generándose desde Markdown. Los estados vacíos ya no se rellenan con oferta general.

Para el volumen actual, las asociaciones entre el texto confirmado y el catálogo se calculan de forma determinista durante la búsqueda usando `SERVICE_INDEX`; no se añadió una tabla derivada ni un segundo JSON. Las consultas con texto recuperan todos los candidatos compatibles de D1 antes de decidir elegibilidad y orden; la interfaz muestra tandas de 12 sobre ese conjunto. Un índice persistente, cursores de base y medición de latencia quedan como evolución condicionada por volumen real.

## 1. Comportamiento acordado

Una búsqueda debe mostrar únicamente oferta pertinente, en una sola lista que mezcle cartas de servicio y perfiles. Primero se determina quién realmente coincide; después se ordena y se distribuye la exposición.

Interpretación de «servicios primero» según el ejemplo solicitado y las aclaraciones posteriores: **dentro de cada proveedor y entre resultados de relevancia comparable, mostrar sus cartas coincidentes antes de su perfil**. No significa colocar todas las cartas del sitio antes de todos los perfiles. Un proveedor sin cartas puede aparecer temprano si tiene evidencia pertinente en sus servicios declarados o especialidades activas. La evidencia directa tiene prioridad sobre la diversidad, como se precisa en la sección 5.

Reglas propuestas:

1. Una coincidencia exige evidencia identificable; popularidad y reseñas nunca habilitan un resultado irrelevante.
2. Resolver servicios concretos y sus equivalencias; usar especialidades directamente relacionadas para búsquedas generales de oficio.
3. No ampliar automáticamente al rubro padre ni a especialidades vecinas.
4. Ofrecer una primera aparición por proveedor antes de repetir proveedores dentro de cada nivel de evidencia.
5. Dentro del proveedor y del mismo nivel, ordenar primero sus cartas pertinentes por relevancia y después su perfil, si también es elegible.
6. Conservar todas las entidades pertinentes, sin duplicar la misma entidad. Perfil y carta del mismo proveedor son entidades distintas.
7. Mostrar una sola lista, un contador de resultados y un control de paginación. No crear secciones por tipo.

La versión inicial proponía rondas estrictas sobre todos los resultados. Las aclaraciones posteriores priorizan coincidencias directas: las rondas se aplicarán dentro de niveles comparables, sin adelantar una coincidencia solo de especialidad a una oferta explícita para dar variedad. Tampoco se garantiza que cada proveedor cambie de posición entre búsquedas: evitar monopolio y rotar ganadores son problemas diferentes.

## 2. Diagnóstico del código actual

Hallazgos de lectura del repositorio; el caso reportado no se reprodujo contra datos de producción, por lo que aún no se atribuye a una única causa.

| Pieza actual | Hallazgo | Cambio necesario |
| --- | --- | --- |
| `src/lib/search-intent.ts` | Ya normaliza e interpreta alias, pero combina raíces, puntajes y expansiones. Parte de la detección de oficio depende de la consulta completa o su longitud. | Reconocer conceptos dentro de frases y distinguir oficio de actividad concreta. |
| `src/data/search-discovery.ts` | Tiene alias de oficio y necesidades editoriales. | Convertirlos en relaciones explícitas, contextualizadas y comprobables. |
| `src/infrastructure/search-sql.ts` | Usa alternativas con `LIKE '%...%'` y términos repartidos entre campos. Recorta frases y términos antes de consultar. | Evitar subcadenas y pérdida de restricciones esenciales; compartir el criterio de elegibilidad con conteos y motivos. |
| `d1-profile-repository.ts` | Busca en nombre, descripción y servicios concatenados; la especialidad se añade con `OR`. | Impedir que menciones incidentales o palabras repartidas entre servicios distintos prueben una oferta. |
| `d1-service-card-repository.ts` | El nombre del proveedor participa en la recuperación de cartas. | Una búsqueda de oficio no debe recuperar cartas ajenas a ese oficio por el nombre del proveedor. |
| `src/application/search.ts` | Recupera hasta 48 candidatos por tipo y los reordena después. Los motivos tienen un fallback a especialidad. | Ordenar sobre el conjunto elegible antes de limitar; devolver evidencia real y una lista unificada. |
| `src/lib/search-ranking.ts` | Diversifica suavemente solo cartas con puntajes cercanos. | Aplicar rondas por proveedor sobre cartas y perfiles juntos. |
| `src/components/search-experience.tsx` | Renderiza secciones distintas y muestra exploración cuando el total es cero. | Una lista mixta; evitar rellenarla con proveedores ajenos a la consulta. |
| `docs/rules/business_rules.md`, BR-031 | Exige grupos separados y diversidad suave. | Sustituir estas cláusulas como parte de la implementación solicitada. |

También hay una diferencia entre normalizar la consulta en TypeScript y buscar sobre texto original en SQL. La nueva recuperación debe comparar representaciones normalizadas de ambos lados.

El catálogo ya incluye `dentista` y `odontólogo` como alias de consulta odontológica. No hace falta construir otro catálogo desde cero. Falta controlar cómo se usan esas equivalencias para admitir resultados.

## 3. Coincidencia por conceptos, no igualdad de la frase completa

La idea de exact match es adecuada para reconocer vocabulario. Comparar literalmente «Necesito un dentista» con el título de una carta perdería resultados correctos. La propuesta combina normalización, equivalencias editoriales y evidencia de oferta.

### Vocabulario y relaciones

Mantener la jerarquía existente: rubro → especialidad → servicio canónico. Añadir alias tipados que apunten al concepto correcto, sin copiar todos los alias a todas las ofertas del rubro.

| Expresión | Destino conceptual | Alcance |
| --- | --- | --- |
| dentista, odontólogo, odontóloga, odontología | Especialidad `salud-odontologia` | Búsqueda general del oficio. |
| implantes dentales | Servicio canónico de implantes dentales | Exige evidencia del servicio específico. |
| plomero, fontanero, plomería, fontanería | Especialidad de plomería y sanitaria | Oficio general. |
| instalación de caños | Servicio concreto de instalación de tuberías, a validar en el catálogo | No equivale a cualquier trabajo de plomería. |
| fuga de agua, caño que pierde | Servicio de detección/reparación de fugas, a validar | Relación editorial de problema con solución. |
| caños | Expresión ambigua | Usar contexto o pedir precisión; no imponer un oficio universalmente. |
| sanitario, sanitaria | Expresiones dependientes del contexto | Evitar confundir instalaciones sanitarias con atención de salud. |

Cada entrada debe incluir término normalizado, tipo de destino, ID del destino y, cuando corresponda, contexto requerido o excluido. Validar referencias, duplicados y colisiones. Un alias con varios destinos no debe elegir el primero silenciosamente.

Editar la fuente canónica en `docs/data/rubros_especialidades_servicios.md` y adaptar `scripts/generate-services.ts` y sus validadores si se amplía el formato. El JSON generado no será una segunda fuente editable. Las necesidades editoriales pueden seguir en `src/data/search-discovery.ts`, con validación contra el catálogo.

### Interpretación de consultas

1. Conservar el texto original; normalizar mayúsculas, tildes, puntuación y espacios para comparar.
2. Reconocer alias completos con límites de palabra, priorizando expresiones específicas y más largas.
3. Quitar expresiones introductorias como «necesito un» solo para interpretar la intención. Conservar negaciones y calificadores que cambian lo solicitado.
4. Producir una intención explícita: oficio/especialidad, servicio específico, nombre de proveedor, ambigua o desconocida.
5. Devolver conceptos, restricciones esenciales, confianza y motivo de interpretación. Un concepto general no debe borrar «infantil», «urgente» o «implantes».
6. Errores tipográficos: sugerir una corrección conservadora sobre vocabulario conocido; no ampliar silenciosamente por similitud.

Ejemplos: «Necesito un dentista» y «dentista» deben resolver el mismo oficio. «Dentista para niños» debe conservar la especialización infantil. «No enfría el aire» expresa una avería; no se debe tratar como exclusión de refrigeración. Consultas ambiguas o con varias necesidades no resueltas muestran opciones para precisar antes de mezclar oficios sin explicación.

### Qué significa exact match en este buscador

Comparar contra la expresión útil normalizada, conservando sus restricciones: en «necesito un plomero», la expresión útil es «plomero». No exigir que el proveedor haya escrito «necesito un».

| Coincidencia | Consulta y oferta | Tratamiento |
| --- | --- | --- |
| Igualdad exacta normalizada | `plomero` → `Plomero` | Máxima preferencia textual, con especialidad y contexto compatibles. |
| Palabra o frase completa dentro del nombre | `plomero` → `Plomero a domicilio` | Evidencia directa fuerte; no exigir igualdad de todo el título. |
| Alias equivalente validado | `plomero` → `Servicio de fontanería` | Evidencia conceptual fuerte del mismo oficio. |
| Solo especialidad | `plomero` → perfil que declara plomería | Respaldo pertinente para oficio general, de menor prioridad. |
| Mención incidental | `plomero` → `Cursos para ser plomero` | No demuestra que se ofrezca plomería; excluir de esta intención. |

La palabra completa evita coincidencias por fragmentos, pero no resuelve el sentido por sí sola. «Plomero a domicilio» en plomería es una coincidencia clara; un curso o una venta de herramientas no lo es. Ni siquiera un título idéntico permite saltarse estado público, contexto, filtros o restricciones de la consulta.

### Estrategia concreta de archivos y generación

Habrá tres piezas distintas: vocabulario editorial común, índice generado de interpretación y oferta de proveedores en D1. Los conceptos describen qué significa una búsqueda; las asociaciones con D1 prueban quién lo ofrece.

| Pieza | Fuente o destino propuesto | Responsabilidad |
| --- | --- | --- |
| Rubros, especialidades, servicios y alias equivalentes | `docs/data/rubros_especialidades_servicios.md` | Fuente editorial única para estos conceptos. Ampliar su formato para alias de especialidad. |
| Problemas cotidianos y reglas de contexto | `src/data/search-discovery.ts` | Reglas editoriales que referencian IDs del catálogo, sin redefinir sus nombres ni copiar sus alias. |
| Generador | `scripts/generate-services.ts` | Leer, normalizar, validar y generar artefactos deterministas. |
| Catálogo de aplicación | `src/data/taxonomy.json` | Mantener el contrato que consume la aplicación; ampliar tipos donde corresponda. |
| Índice de interpretación | `SERVICE_INDEX` en `src/data/services.ts` | Proyección en memoria del catálogo generado, con términos normalizados y destinos tipados. |
| Oferta y asociaciones | Tablas de D1 | Servicios declarados, cartas, perfiles y vínculos derivados con conceptos. |

No editar a mano los JSON generados. Los nuevos alias de especialidad se declaran en la fuente editorial; el mapa heredado `OCCUPATION_SPECIALTIES` queda como compatibilidad para oficios todavía no migrados y debe reducirse a medida que se revise el catálogo. La generación debe ser repetible y fallar si hay referencias inválidas. El índice interno se usa en el servidor y no se envía completo al navegador.

El archivo editorial puede dividirse por rubro si se vuelve difícil de mantener. En ese caso, el generador leerá esas partes como una sola fuente lógica; no se mantendrán simultáneamente copias editables del catálogo completo y sus partes.

### Formato de los conceptos

Ejemplo ilustrativo de la estructura generada, no un reemplazo literal del esquema actual. Los IDs de este ejemplo existen en el catálogo; conservar los IDs existentes al implementar:

```json
{
  "specialties": [
    {
      "id": "hogar-y-mantenimiento-plomeria-y-sanitaria",
      "name": "Plomería y sanitaria",
      "aliases": ["plomero", "fontanero", "fontanería"]
    }
  ],
  "services": [
    {
      "id": "salud-odontologia-implantes-dentales",
      "specialtyId": "salud-odontologia",
      "name": "Implantes dentales",
      "aliases": ["implante dental"]
    }
  ]
}
```

El ejemplo es un extracto: las especialidades referenciadas deben estar presentes en el catálogo completo. El generador convierte también el nombre canónico en una forma reconocible. No hace falta enumerar variantes de mayúsculas, tildes o puntuación. Sí deben declararse sinónimos y variantes lingüísticas que la normalización no resuelve.

Un alias de oficio apunta a una especialidad; un alias de actividad apunta a un servicio. Una frase como «caño que pierde» es una necesidad asociada editorialmente a una solución, no necesariamente un sinónimo literal de su nombre. Un rubro sirve para navegación y consultas amplias explícitas, no para expandir automáticamente una consulta específica.

### Índice de términos generado

Representación conceptual del índice de interpretación. La implementación actual construye esta relación mediante `SERVICE_INDEX` en vez de persistir otro JSON:

```json
{
  "schemaVersion": 1,
  "vocabularyVersion": "huella-del-contenido-editorial",
  "terms": {
    "plomero": [
      {
        "targetType": "specialty",
        "targetId": "hogar-y-mantenimiento-plomeria-y-sanitaria",
        "relation": "equivalent"
      }
    ],
    "implante dental": [
      {
        "targetType": "service",
        "targetId": "salud-odontologia-implantes-dentales",
        "relation": "equivalent"
      }
    ]
  }
}
```

Cada término apunta a una lista para poder representar ambigüedad. Las entradas contextuales añaden condiciones de aplicación y exclusión. El intérprete debe evaluarlas, no unir todos los destinos con un `OR` indiscriminado. Las coincidencias de varias palabras se reconocen antes de las generales: «dentista para niños» no debe quedar reducido a «dentista».

El generador validará IDs existentes, tipo de destino, pertenencia de servicios a especialidades, alias vacíos o duplicados tras normalización, colisiones entre destinos y reglas contradictorias. Las colisiones intencionales deben declararse como ambiguas o resolverse con contexto. Evitar expansión transitiva de alias: el alias lleva a su destino explícito, no a todos los conceptos conectados indirectamente.

### Cómo se crea y mantiene el vocabulario

1. Reutilizar los nombres y alias actuales; revisar odontología y plomería como primeros casos completos.
2. Añadir sinónimos frecuentes, variantes locales y expresiones claras de necesidades. No intentar enumerar todas las oraciones posibles.
3. Acompañar cada nueva relación con un ejemplo positivo y, si puede confundirse, uno negativo.
4. Ejecutar generación y `check:data`; revisar el diff generado y las pruebas de interpretación antes de publicar.
5. Ampliar el vocabulario con consultas fallidas revisadas. No convertir automáticamente cualquier texto escrito por usuarios o proveedores en un alias global.

El tamaño del JSON no es el problema principal: importan su consistencia y la precisión de las relaciones. Generar el índice una vez por versión y reutilizarlo en el servidor evita reconstruirlo en cada búsqueda. La oferta se consulta en D1 mediante asociaciones e índices de base; no se incorpora dentro del JSON ni se carga toda en memoria por petición.

## 4. Evidencia y elegibilidad

Separar una decisión binaria —puede aparecer— del puntaje —en qué orden aparece—.

| Intención | Carta de servicio elegible | Perfil elegible |
| --- | --- | --- |
| Oficio general, por ejemplo dentista | Carta cuyo servicio vinculado pertenece a odontología activa, o tiene una equivalencia de servicio validada para ese oficio. | Perfil con especialidad activa de odontología o servicio activo inequívocamente relacionado, con su especialidad activa. |
| Servicio concreto, por ejemplo implantes | El servicio vinculado o la oferta concreta demuestra implantes mediante concepto validado o evidencia textual específica y contextual. | Declara ese servicio activo o tiene una carta pública que lo demuestra. La especialidad general por sí sola no alcanza. |
| Nombre de proveedor | Solo cartas del proveedor identificado que cumplan cualquier restricción adicional. | Coincidencia de nombre completa o suficientemente específica, en una ruta de búsqueda de nombres separada del oficio. |
| Texto sin concepto canónico | Coincidencia de términos esenciales en una misma oferta, respetando contexto y exclusiones. | Coincidencia en un mismo servicio declarado o carta pública; una mención genérica en la biografía no basta. |

En el MVP, la biografía del perfil puede mejorar el orden de un candidato ya elegible; no admite por sí sola un proveedor en búsquedas de oficio o actividad. Ejemplo negativo: «limpieza de consultorios de dentistas» no demuestra que se ofrezca odontología.

Una carta se evalúa por su propio servicio y contenido. Que un proveedor haga odontología y además venda otro servicio no vuelve odontológicas todas sus cartas. Tampoco deben coincidir «reparación» de un servicio y «caños» de otro como si fueran una oferta conjunta.

Mantener elegibilidad pública, estado del proveedor, publicación de cartas, servicios y especialidades activos, límites de plan y filtros existentes. Un resultado debe cumplir filtros y pertinencia conjuntamente. Los conteos deben usar exactamente esos mismos predicados.

### Vincular catálogo y datos existentes

`services.id` identifica un servicio declarado por un proveedor; no es el ID del servicio canónico. Las cartas ya apuntan al servicio declarado mediante `service_id`. Según `src/data/services.ts` y TR-022, el texto confirmado por el proveedor se conserva independientemente del catálogo.

Propuesta: añadir una relación derivada de búsqueda entre servicio declarado y concepto canónico, con versión del vocabulario y origen de la asociación. No reemplazar IDs ni reescribir el texto del proveedor.

- Asociar automáticamente solo nombres o alias inequívocos dentro de la especialidad correspondiente.
- Dejar sin asociación los textos ambiguos y conservar su búsqueda textual contextual.
- Permitir más de un concepto únicamente si la oferta realmente declara varios; pertenecer a una especialidad no basta.
- Recalcular asociaciones cuando cambie el servicio o el vocabulario y retirar las que ya no tengan evidencia.
- Auditar cobertura antes de activar reglas estrictas para evitar ocultar masivamente oferta legítima sin mapear.

### Asociación al crear o editar servicios

Si el proveedor elige una sugerencia, el formulario puede enviar el ID canónico junto con el texto confirmado. El servidor valida que exista, corresponda a la especialidad y siga siendo compatible con el texto: elegir una sugerencia y después cambiar el texto por otra actividad no debe conservar una asociación falsa. El ID se guarda como evidencia auxiliar; el texto confirmado sigue siendo el dato principal según TR-022.

Si escribe texto libre, resolver nombres o alias inequívocos dentro de su especialidad. Para un servicio genérico como «Plomero a domicilio», basta reconocer el oficio en la especialidad declarada: no asignarlo a reparación de fugas ni a todos los servicios de plomería. Para «Trabajos generales», conservar el texto sin inventar un concepto específico.

Si el volumen futuro exige materializar estas relaciones, usar `service_concept_matches`, con `declared_service_id`, `canonical_service_id`, `source`, `matched_text`, `vocabulary_version` y `updated_at`. En el MVP la relación se deriva al buscar y no modifica la base. La pertenencia a especialidad ya existente cubre el oficio general; no hace falta inventar un servicio canónico «plomero» para cada proveedor.

Al editar una oferta, actualizar texto normalizado y asociaciones conjuntamente. Al borrar un servicio, retirar sus asociaciones. Las cartas heredan la asociación de su servicio vinculado, pero su propio contenido y restricciones también se validan. Si contradicen el servicio asociado, excluir esa evidencia y señalar la inconsistencia para corregirla.

Para datos existentes, ejecutar una carga inicial repetible que informe asociados inequívocos, ambiguos y sin coincidencia. No modificar textos ni asignar por proximidad. Para cambios de vocabulario, generar la nueva versión, recalcular asociaciones y activar índice y asociaciones de forma coordinada; evitar mezclar versiones parciales. Mantener comprobaciones públicas en las consultas aunque el índice esté actualizado.

### Ejemplo de extremo a extremo

Para `Necesito un plomero`, reconocer `plomero` dentro de la frase y resolver la especialidad de plomería. Recuperar servicios y cartas con evidencia compatible y perfiles con esa especialidad activa, conservando los filtros.

- «Plomero»: coincidencia textual exacta de la expresión útil.
- «Plomero a domicilio»: palabra completa en una oferta pertinente.
- «Servicio de fontanería»: equivalencia editorial del oficio.
- Perfil sin cartas que declara plomería: coincidencia por especialidad.
- «Cursos para ser plomero»: no ofrece el oficio solicitado; excluir.

Ordenar primero el nivel de oferta explícita y después el de especialidad. Dentro de cada nivel, aplicar las rondas de la sección 5. Para `reparar una fuga de agua`, resolver el servicio concreto: declarar plomería general ya no es evidencia suficiente.

## 5. Orden unificado y diversidad

### Relevancia base

Asignar una clave comparable a perfiles y cartas: especificidad respecto de la consulta, fuerza de evidencia, calidad de la coincidencia, reputación como desempate e ID estable. Una coincidencia por alias validado tiene el mismo valor conceptual que el nombre canónico.

Usar dos niveles de evidencia para el MVP, sin convertirlos en secciones visuales:

1. **Oferta explícita:** nombre/título o servicio vinculado con coincidencia directa o equivalencia validada; también evidencia específica y contextual en una misma oferta. Dentro de este nivel, preferir igualdad exacta normalizada, palabra/frase completa en nombre y equivalencia editorial, en ese orden, cuando el resto de restricciones sea equivalente. La mención en descripción tiene menor preferencia textual que el nombre de la oferta.
2. **Solo especialidad:** elegible para oficio general, nunca suficiente para afirmar una actividad específica no declarada.

La igualdad literal obtiene la mayor relevancia base; los sinónimos siguen siendo evidencia fuerte del mismo concepto. La diversidad puede reordenar candidatos dentro del primer nivel para dar una primera oportunidad a otros proveedores. No puede adelantar el segundo nivel al primero. Esto equilibra la prioridad de exact match con el objetivo original de evitar monopolios; no implica que todos los títulos idénticos deban ocupar todas las primeras posiciones.

Para cada candidato devolver tipo, ID de entidad, `providerId`, evidencia, concepto/especialidad coincidente y clave de relevancia. La evidencia se calcula durante recuperación; no se inventa una etiqueta de especialidad cuando faltan pruebas. Acumular cartas o repetir palabras no aumenta la relevancia del proveedor: su relevancia base es la de su mejor candidato.

### Rondas deterministas por nivel de evidencia

1. Asignar a cada entidad su mejor evidencia propia y un único nivel. Deduplicar por tipo e ID, no por proveedor.
2. Dentro de cada nivel, agrupar candidatos elegibles por `providerId` y ordenar proveedores por la relevancia de su mejor candidato de ese nivel; resolver empates con ID estable.
3. Crear la cola de cada proveedor en ese nivel: cartas pertinentes ordenadas por relevancia y, al final, su perfil pertinente.
4. Recorrer proveedores en ese orden y extraer una entidad de cada cola no vacía. Repetir rondas hasta agotar el nivel y continuar con el siguiente.
5. No reiniciar las rondas al cambiar de página. Un proveedor puede participar en ambos niveles, pero una entidad no puede aparecer dos veces.

La prioridad de cartas se aplica dentro del mismo nivel. Si un perfil tiene evidencia explícita y una de sus cartas solo coincide por especialidad, el perfil puede preceder a esa carta. No transferir la relevancia del mejor candidato a todas las entidades del proveedor. Si el perfil aparece por una carta explícita, registrar esa misma evidencia para justificar su nivel.

La prioridad al servicio también se aplica a búsquedas por nombre; no se introduce una excepción que contradiga el ejemplo. Si más adelante se desea destacar perfiles por nombre, se tratará como una decisión explícita de producto.

### Resultado del ejemplo solicitado

Tomando el orden inicial como relevancia base y todas las entidades como pertinentes y del mismo nivel de evidencia:

| Ronda | Posición | Resultado |
| --- | --- | --- |
| 1 | 1 | Juan — carta de servicio |
| 1 | 2 | Amelia — perfil |
| 1 | 3 | Eugenio — carta de servicio |
| 1 | 4 | Teresa — primera carta de servicio |
| 1 | 5 | Marcos — carta de servicio |
| 1 | 6 | Arletys — perfil |
| 1 | 7 | Pavel — carta de servicio |
| 1 | 8 | Alietys — perfil |
| 1 | 9 | Pedro — carta de servicio |
| 2 | 10 | Juan — perfil |
| 2 | 11 | Teresa — segunda carta de servicio |
| 3 | 12 | Teresa — perfil |

Un proveedor con veinte cartas conserva todas las pertinentes, pero ocupa un solo lugar en la primera ronda de cada nivel. Los proveedores sin cartas conservan su oportunidad de aparecer. El ejemplo original no especifica evidencias; si sus entidades pertenecen a distintos niveles, prevalece el orden por evidencia y la secuencia puede cambiar.

## 6. Recuperación, paginación y presentación

La mezcla no puede hacerse después de obtener solo las primeras 48 cartas y los primeros 48 perfiles: puede haber proveedores pertinentes que nunca entren a ese conjunto.

Implementar una recuperación unificada en D1, reutilizando las condiciones públicas de los repositorios existentes. Calcular elegibilidad, orden interno por proveedor y orden de proveedores antes del límite de página. Validar la estrategia SQL con datos locales y el entorno D1 real antes de fijar detalles; no hace falta introducir FTS ni un servicio externo para definir esta semántica.

La clave final de orden es nivel de evidencia, ronda dentro del nivel, posición de proveedor y desempate estable de entidad. La interfaz muestra tandas de 12 y reinicia al cambiar el conjunto. Mientras el conjunto pertinente siga siendo acotado, se recupera y ordena completo en el servidor y se revela en el cliente. Si las mediciones indican que ese contrato deja de ser viable, se sustituirá por un cursor ligado a consulta, filtros y versiones de ranking y vocabulario.

Para el MVP, documentar que una edición concurrente de oferta puede alterar el orden y exigir reiniciar la búsqueda; no prometer una instantánea estable sin implementarla. Revalidar siempre la elegibilidad pública. Si el volumen impide paginar el conjunto completo con buena latencia, introducir un índice derivado; aumentar arbitrariamente el límite de candidatos no resuelve el problema.

El contrato implementado devuelve una lista discriminada por tipo, motivo por resultado, total de entidades y total de proveedores únicos. No suma conteos de proveedores por tipo: un mismo proveedor puede tener perfil y cartas. La interfaz distingue, por ejemplo, «12 resultados de 9 proveedores».

`SearchExperience` reutiliza los componentes individuales de carta y perfil dentro de un único grid. Etiquetas discretas identifican el tipo y los motivos explican la coincidencia. Los filtros siguen en la URL, el envío ocurre al confirmar y al cambiar consulta o filtros se reinicia el estado visible.

Sin consulta, mantener una lista mixta de oferta pública filtrada, ordenada por calidad y diversidad, sin afirmar coincidencia textual. Si se filtra por un solo tipo, aplicar las mismas rondas a ese tipo.

Con cero coincidencias, mostrar un estado vacío, sugerencias de corrección o enlaces para precisar/ampliar filtros. No rellenar la lista con cartas ni perfiles generales. Explorar categorías será una acción explícita. Esto sustituye el discovery automático anterior y evita reproducir la percepción de resultados ajenos a la consulta.

## 7. Etapas de implementación

### Etapa 1 — Reproducir y fijar el contrato

- [x] Crear casos controlados de odontología, actividad específica, menciones incidentales y varios proveedores.
- [x] Comparar interpretación, candidatos SQL, motivos y resultado visible para `dentista` y `Necesito un dentista` contra D1 local.
- [x] Incorporar el contrato de orden mixto y casos negativos al check de backend.
- [x] Actualizar BR-031 con lista mixta, evidencia obligatoria, prioridad textual, rondas por nivel y vacío sin relleno.

Entrega: fallo reproducible y comportamiento esperado verificable.

### Etapa 2 — Vocabulario y evidencia

- [x] Ampliar la fuente editorial y su generador con alias de especialidad para odontología y plomería.
- [x] Validar alias duplicados y colisiones al generar el catálogo.
- [x] Adaptar `src/lib/search-intent.ts` y los tipos para distinguir oficio, actividad y texto libre.
- [x] Derivar asociaciones sin reescribir el texto confirmado y filtrar por estados públicos vigentes.
- [ ] Migrar los demás mapas heredados de oficios a la fuente editorial a medida que se revise cada especialidad.
- [ ] Materializar asociaciones e índice sólo si las mediciones de volumen lo requieren.

Entrega: interpretación explicable y evidencia de oferta que no depende de menciones accidentales.

### Etapa 3 — Recuperación y orden completos

- [x] Recuperar candidatos completos desde los repositorios D1 existentes y aplicar una única elegibilidad en la aplicación.
- [x] Exigir conceptos o términos completos en una misma oferta mediante `src/lib/search-matching.ts`.
- [x] Aplicar orden y rondas antes de presentar las primeras 12 posiciones.
- [x] Simplificar `src/application/search.ts` y los tipos para devolver resultados mixtos.
- [x] Dejar la ruta pública de búsqueda usando exclusivamente la nueva elegibilidad.

Entrega: API interna que produce el ejemplo exacto y conserva diversidad al paginar.

### Etapa 4 — Lista mixta

- [x] Adaptar `src/components/search-experience.tsx` al contrato único consumido por `/buscar`.
- [x] Incorporar tandas compartidas, contador de entidades/proveedores y motivos verificables.
- [x] Retirar secciones por tipo y relleno automático; conservar filtros, navegación y enlaces canónicos.
- [x] Leer las guías pertinentes de `node_modules/next/dist/docs/` antes de escribir código de Next.js.

Entrega: experiencia coherente con el orden solicitado en móvil y escritorio.

### Etapa 5 — Validación y activación

- [x] Ejecutar `npm run check:data`, `npm run check:backend`, `npm run typecheck`, `npm run lint` y `npm run build`.
- [x] Comprobar `/buscar` contra D1 local con oficios, actividades concretas y consulta desconocida.
- [x] Confirmar que el total de proveedores de `Necesito un dentista` coincide con los perfiles públicos de odontología en D1 local.
- [ ] Medir latencia y planes de consulta con más de 48 resultados por tipo y distribución desigual por proveedor.
- [ ] Introducir índice persistente y cursores si el volumen o la latencia lo justifican.

Entrega: búsqueda validada con datos representativos y sin pérdida silenciosa de resultados por límites internos.

## 8. Criterios de aceptación

| Caso | Resultado obligatorio |
| --- | --- |
| `dentista`, `odontólogo`, `Necesito un dentista` | Mismo oficio reconocido; ningún proveedor sin evidencia odontológica entra por relleno o reputación. |
| Perfil odontológico activo sin cartas | Aparece como perfil. |
| Perfil de limpieza que menciona dentistas | No aparece como odontólogo. |
| `implantes dentales` | La odontología general sin evidencia de implantes no habilita el resultado. |
| `dentista para niños` | Se conserva la restricción infantil; no se amplía automáticamente a todos los dentistas. |
| Odontología veterinaria | No aparece para dentista humano por compartir palabras. |
| Proveedor con odontología y otro oficio | Solo sus cartas pertinentes aparecen para dentista. |
| `fontanero`, `plomero`, `necesito un plomero` | Reconocen el mismo oficio; validar también tildes y puntuación. |
| `caños`, `sanitario` sin contexto suficiente | No asignan arbitrariamente una especialidad; permiten precisar. |
| `reparar caños` con palabras en dos servicios diferentes | No se inventa una oferta conjunta. |
| Error tipográfico / texto desconocido | Corrección sugerida o vacío; no resultados generales disfrazados de coincidencias. |
| `plomero` → `Plomero` / `Plomero a domicilio` / `Servicio de fontanería` | Oferta explícita con contexto compatible; exacta obtiene la mayor relevancia base y las otras conservan evidencia fuerte. |
| `plomero` → `Cursos para ser plomero` | Excluir aunque contenga la palabra completa. |
| Segunda carta explícita frente a perfil solo por especialidad | La carta conserva prioridad; la diversidad no cruza niveles de evidencia. |
| Perfil explícito y carta del mismo proveedor solo por especialidad | El perfil precede a esa carta; no heredar puntajes entre entidades. |
| Selección del catálogo seguida de edición a otra actividad | No conservar una asociación canónica incompatible. |
| Alias duplicados, destino inexistente o colisión no declarada | La generación falla con un diagnóstico corregible. |
| Repetir generación y carga inicial con los mismos datos | Mismos artefactos y asociaciones, sin duplicados ni cambios de texto del proveedor. |
| Ejemplo de doce entidades del mismo nivel | Coincide exactamente con la tabla de rondas. |
| Un proveedor con veinte cartas y otros con una | Una aparición por proveedor en la primera ronda de cada nivel; ninguna entidad pertinente se elimina. |
| Más de 48 resultados y página que corta una ronda | Se puede recorrer todo el conjunto; sin omisiones ni duplicados con datos fijos. |
| Solo perfiles / solo cartas / filtros combinados | Se respetan tipo y filtros antes de ordenar; conteos coherentes. |
| Carta retirada, servicio inactivo o proveedor suspendido | No aparecen, aunque sobreviva una asociación derivada de búsqueda. |
| Consulta con `%`, `_`, tildes o negaciones | Se trata literalmente/contextualmente, sin comodines involuntarios ni pérdida de sentido. |
| Cero coincidencias | Contador cero, sin cartas ni perfiles ajenos; ampliar filtros exige acción explícita. |

El lanzamiento exige cero falsos positivos en los casos negativos controlados, recuperar todos los candidatos esperados en esos fixtures y conservar el orden al paginar. Medir además precisión de los primeros 12 resultados, cobertura de oferta conocida, proveedores distintos por página y latencia p50/p95 frente al MVP. Fijar un presupuesto de latencia con la medición de base, no inventar una garantía antes de medir.

## 9. Alcance posterior

Dejar FTS, búsqueda semántica, rotación temporal y analítica persistente para evoluciones justificadas por mediciones. Primero resolver pertinencia, relaciones editoriales, lista mixta y paginación completa. Una búsqueda semántica futura deberá cumplir las mismas reglas de evidencia y no atribuir servicios inexistentes.
