# Reglas de negocio

Este documento reúne las reglas funcionales que definen **qué puede hacer el producto, qué debe cumplirse y qué debe impedirse**, independientemente de la tecnología utilizada para implementarlo.

Las decisiones sobre almacenamiento, índices, transacciones, seguridad, normalización y generación de archivos se documentan en [`technical_rules.md`](technical_rules.md). El modelo físico se detalla en `databases_and_relationships.md`.

## 1. Alcance y precedencia

- Este archivo es la fuente de la verdad para validaciones funcionales y criterios de aceptación.
- `technical_rules.md` es la fuente de la verdad para decisiones técnicas y mecanismos de implementación.
- `planes.md` presenta comercialmente los planes, pero no redefine sus capacidades.
- `locations.md`, `rubros_especialidades_servicios.md` y `sugerencias_horarios.md` contienen datos canónicos, no reglas adicionales.
- `databases_and_relationships.md` describe el esquema que aplica las reglas, pero no las redefine.
- Si un documento técnico contradice este archivo, primero se corrige el modelo o la implementación; no se cambia silenciosamente el comportamiento del negocio.

### Política contra la redundancia

- Una regla funcional completa se redacta una sola vez en este documento y recibe un identificador `BR-*`.
- Los demás documentos se limitan a referenciar ese identificador.
- Una descripción, ejemplo o constraint puede ilustrar o aplicar una regla, pero no alterar su significado ni introducir una excepción.
- Todo cambio funcional comienza aquí y luego actualiza únicamente las referencias o estructuras afectadas.

### Interpretaciones compartidas por toda la documentación

1. Un perfil puede guardar **hasta 10 entradas de horario**, de 3 a 120 caracteres.
2. Una **ubicación física** y un **área de servicio** son conceptos distintos. Una sucursal puede indicar un departamento o una localidad; la cobertura puede indicar Uruguay, departamentos o localidades.
3. Los límites de los planes se aplican únicamente a elementos activos. Los datos que exceden un plan después de una baja se conservan temporalmente, pero dejan de mostrarse públicamente y de contar como beneficios activos.
4. La verificación de contacto, la verificación comercial del perfil y la validación de una habilitación profesional son tres procesos independientes.

---

## 2. Cuentas, perfiles y permisos

### BR-001 — Tipos de cuenta

- Las cuentas de proveedores y administradores pertenecen al dominio de gestión del marketplace.
- Las cuentas de clientes pertenecen al dominio de opiniones y, por ahora, se autentican únicamente con Google.
- Una cuenta de proveedor puede administrar como máximo un perfil.
- Un perfil representa a un profesional independiente o a una empresa.
- Una cuenta inactiva o suspendida no puede iniciar nuevas sesiones ni realizar operaciones protegidas.

### BR-002 — Creación en borrador

- Un perfil puede crearse sin estar verificado y permanece en estado borrador.
- Un borrador puede estar incompleto y no necesita todavía ubicación física ni área de servicio.
- Los borradores no son visibles en el marketplace ni aparecen en resultados, páginas públicas o URLs indexables.

### BR-003 — Publicación y visibilidad

Para publicar o reactivar un perfil deben cumplirse todas estas condiciones:

1. La cuenta propietaria está activa.
2. El perfil tiene nombre, tipo y descripción válidos.
3. El proveedor verificó al menos un canal admitido: correo electrónico o teléfono.
4. Existe al menos un método público de contacto: correo de contacto o teléfono válido marcado como público.
5. Existe al menos una especialidad activa.
6. Existe al menos una modalidad de prestación activa.
7. Existe al menos un área de servicio explícita.
8. Si se ofrece atención en el negocio, existe al menos una ubicación física activa.
9. Todos los elementos activos respetan los límites y capacidades del plan.
10. Si se publican servicios regulados, se cumple BR-020.

Solo un perfil activo y no suspendido es visible públicamente. Suspender o desactivar un perfil debe retirarlo de búsquedas y páginas públicas sin borrar sus datos.

### BR-004 — Contacto

- El correo público de contacto puede ser distinto del correo usado para iniciar sesión.
- El teléfono es un único dato. WhatsApp no se guarda como otro número: el proveedor indica si ese teléfono acepta WhatsApp.
- El acceso a WhatsApp solo se ofrece cuando hay un teléfono válido y el proveedor habilitó esa opción.
- Ocultar el teléfono impide mostrarlo y usarlo en enlaces públicos, incluido WhatsApp.
- Al menos un canal de contacto debe continuar público mientras el perfil esté activo.

### BR-005 — Identidad pública y URL

- Cada perfil tiene una URL pública única y estable.
- Si dos perfiles generan el mismo slug, se utiliza un sufijo numérico para desambiguarlos.
- Cambiar el nombre visible no debe romper automáticamente una URL ya publicada.

---

## 3. Planes y suscripciones

### BR-006 — Planes disponibles

QuienLoHace ofrece exactamente tres niveles, ordenados de menor a mayor: **Cobre**, **Oro** y **Platino**.

| Capacidad | Cobre | Oro | Platino |
| --- | ---: | ---: | ---: |
| Precio | Gratis | Pago | Pago |
| Rubros activos | 1 | 2 | 3 |
| Especialidades activas | 2 | 6 | 12 |
| Servicios activos | 10 | 25 | 50 |
| Cartas de servicio activas | 2 | 10 | 20 |
| Ubicaciones físicas activas | 1 | 5 | Sin límite |
| Imágenes activas en galería | 0 | 5 | 20 |
| Redes sociales | No | Sí | Sí |
| Solicitud de verificación del perfil e insignia | No | Sí | Sí |
| Posiciones destacadas y rotativas | No | No | Sí |
| Formulario de contacto | No | No | Sí |
| Landing page personalizada | No | No | Sí |
| Subdominio propio | No | No | Sí |
| Métricas | Básicas | Intermedias | Avanzadas |

Todos los planes incluyen perfil público, teléfono con acceso opcional a WhatsApp, correo de contacto, foto de perfil, imagen de portada, modalidades, áreas de servicio, horarios y medios de pago.

Las áreas de servicio, las modalidades, los horarios y los medios de pago no tienen límites diferentes por plan en la definición comercial actual.

Las posiciones destacadas siguen siendo una capacidad de Platino y ordenan los listados, pero no se enumeran en la presentación comercial de los planes: se decidió no prometerlas hasta que existan métricas que respalden qué significa "destacado".

### BR-007 — Cómputo de límites

- Solo cuentan registros activos.
- Los rubros se derivan de los rubros de las especialidades activas.
- El límite de servicios es total por perfil, no por especialidad.
- El límite de cartas de servicio es total por perfil; los borradores activos también consumen cupo.
- La foto de perfil y la portada no consumen el cupo de la galería.
- En la galería, el cupo cuenta las imágenes disponibles según el plan, incluidas las ocultas voluntariamente. Ocultar una imagen no libera cupo; las congeladas y semicongeladas quedan fuera del cupo disponible (BR-032 y BR-033).
- “Sin límite” significa que no hay máximo comercial; no elimina controles razonables contra abuso.
- Una operación que exceda el plan debe rechazarse o pedir que se desactive otro elemento. No debe aceptarse parcialmente sin informarlo.

### BR-008 — Vigencia de la suscripción

- Cobre es gratuito y no vence.
- Un plan en prueba o cancelado conserva sus beneficios hasta su fecha de fin.
- `past_due` representa un cobro pendiente; no produce por sí solo una baja inmediata.
- Un plan cancelado no se renueva y continúa vigente hasta el final del período adquirido.
- Oro y Platino no pueden contratarse hasta que tengan un precio válido definido.

### BR-009 — Cambio de plan

- Una mejora habilita los nuevos cupos cuando la suscripción queda activa.
- Una baja programada solo puede apuntar a un plan inferior.
- Al bajar de plan no se eliminan datos excedentes: se desactivan de forma determinista y dejan de mostrarse públicamente.
- Se conservan primero los elementos con mayor prioridad definida por el proveedor; ante empate, los más antiguos.
- Los elementos desactivados pueden reactivarse al mejorar el plan si vuelven a caber.
- Los datos excedentes pueden eliminarse después de 180 días desde la fecha comunicada al proveedor. Antes, el proveedor debe poder revisar qué quedó inactivo.
- Las redes sociales se conservan, pero permanecen inactivas en Cobre.
- Para imágenes de galería, BR-032 detalla la congelación, la selección única, la conservación y la recuperación. Ocultar voluntariamente una imagen se rige por BR-033 y es independiente del cambio de plan.

---

## 4. Rubros, especialidades y servicios

### BR-010 — Jerarquía del dominio

La jerarquía funcional es `Rubro → Especialidad → Servicio`.

- Un rubro agrupa especialidades.
- Cada especialidad pertenece a un único rubro.
- Cada servicio del perfil pertenece a una especialidad previamente seleccionada por ese perfil.
- El perfil selecciona especialidades y sus rubros se derivan automáticamente.
- Desactivar una especialidad desactiva también sus servicios asociados.
- Una carta de servicio se vincula con una especialidad seleccionada. Si esa especialidad deja de estar activa, la carta se conserva pero deja de mostrarse públicamente.

### BR-011 — Selección y texto libre

- Rubros y especialidades provienen del catálogo administrado; el proveedor no puede crearlos.
- El catálogo de servicios funciona como autocompletado, pero el proveedor puede confirmar un servicio personalizado.
- El servicio finalmente confirmado se guarda como texto del perfil.
- Un servicio debe tener entre 3 y 80 caracteres.
- No puede repetirse el mismo servicio dentro de la misma especialidad de un perfil, ignorando mayúsculas.
- Los alias sirven para buscar; no se muestran como opciones canónicas ni en el perfil público.
- Un servicio personalizado pertenece a una especialidad que el proveedor elige explícitamente; el sistema no la deduce por él. Con una sola especialidad en el perfil la elección es única y no se pregunta.
- Sin ninguna especialidad seleccionada no se pueden cargar servicios: cada servicio pertenece a una (BR-010) y sin ella no habría dónde ubicarlo.

### BR-012 — Calidad del catálogo

- Un servicio representa una actividad contratable, no una habilidad abstracta.
- Cada servicio canónico aparece en una sola especialidad; el descubrimiento transversal se resuelve con alias.
- Una especialidad mantiene una granularidad aproximada de 4 a 20 servicios.
- Los nombres se redactan para quien busca y en español natural de Uruguay.
- Las marcas no se usan como nombre canónico; pueden ser alias si son búsquedas habituales.
- Los resultados se priorizan desde coincidencias exactas y prefijos del nombre hacia alias, especialidad y rubro.

### BR-013 — Evolución del catálogo

- Agregar un servicio es compatible con perfiles existentes.
- Eliminar o mover un servicio exige revisar los perfiles que ya lo utilizan.
- Renombrar o reordenar rubros y especialidades con URLs publicadas requiere migración explícita.
- Antes de agregar una especialidad se comprueba que no sea un servicio de una especialidad existente.

---

## 5. Ubicaciones, cobertura y modalidades

### BR-014 — Catálogo geográfico

- La jerarquía es `Uruguay → departamento → localidad`.
- Uruguay es la única raíz; existen exactamente 19 departamentos.
- El proveedor selecciona ubicaciones existentes y activas; no crea países, departamentos, localidades, barrios, calles ni códigos postales.
- La localidad es el nivel más preciso del catálogo inicial.
- El proveedor no está obligado a precisar una localidad cuando un departamento es suficiente.

### BR-015 — Ubicación física

- Una ubicación física representa un local, consultorio, oficina o sucursal; no el territorio cubierto.
- Puede asociarse a un departamento o localidad. La dirección y el nombre de sucursal son opcionales.
- Uruguay no es una ubicación física válida porque no identifica dónde existe el establecimiento.
- Un perfil puede tener varias ubicaciones según su plan, pero solo una principal.
- La ubicación principal debe estar activa. Si se desactiva, deja de ser principal.
- Un perfil que no atiende en un negocio puede publicarse sin ubicación física.

### BR-016 — Áreas de servicio

- Todo perfil activo declara al menos un área.
- El área no siempre se pregunta: cuando no se eligió ninguna, el perfil toma cobertura nacional. Quien atiende a distancia llega a todo el país y no se le pregunta; quien atiende sólo en su local cubre el departamento de cada local; quien se traslada puede acotar, y si no lo hace vale Uruguay.
- La regla anterior fija un valor por omisión, no una excepción: nunca se guarda un perfil activo sin área, porque sin ella no aparecería en ninguna búsqueda.
- Elegir Uruguay significa cobertura nacional, es explícito y reemplaza selecciones más específicas.
- Uruguay no puede combinarse con departamentos ni localidades.
- Elegir un departamento cubre todo el departamento y vuelve redundantes sus localidades.
- Al elegir un departamento se quitan sus localidades previamente seleccionadas.
- Puede combinarse un departamento con localidades de otros departamentos.
- Buscar por localidad incluye cobertura nacional, su departamento o la localidad exacta.
- Buscar por departamento incluye cobertura nacional, el departamento o alguna localidad descendiente.

### BR-017 — Modalidades de prestación

- Las modalidades son: en el domicilio del cliente, en el negocio y a distancia.
- Un perfil puede seleccionar una o varias.
- “Híbrida” se deriva cuando existen varias; no es una cuarta modalidad seleccionable.
- “En el negocio” activa el requisito de una ubicación física.

---

## 6. Verificación y servicios regulados

### BR-018 — Verificación de contacto

- Para publicar debe verificarse al menos el correo de la cuenta o el teléfono.
- Verificar un contacto demuestra control del canal; no concede insignia profesional.
- Si el único canal verificado deja de ser válido, los cambios sensibles requieren una nueva verificación.

### BR-019 — Verificación del perfil

- Es la verificación comercial que concede la insignia pública del perfil.
- Solo Oro y Platino pueden solicitarla.
- La insignia se muestra únicamente después de la aprobación.
- Los estados pendiente, no solicitada y rechazada no muestran insignia.
- La política de conservación de una insignia aprobada al bajar a Cobre debe definirse antes del lanzamiento; no se revoca silenciosamente.

### BR-020 — Habilitaciones y actividades reguladas

- Los servicios de salud, legales, notariales, contables y de seguros requieren una habilitación profesional vigente y aprobada para la especialidad correspondiente antes de mostrarse públicamente.
- Solicitar la validación de una habilitación no depende del plan, porque es un requisito regulatorio y no un beneficio comercial.
- Una habilitación aprobada no concede automáticamente la insignia del perfil definida en BR-019.
- En un perfil mixto, la falta de habilitación bloquea los servicios regulados, no necesariamente todo el perfil.
- La plataforma puede suspender un perfil o servicios concretos ante credenciales falsas, suplantación o incumplimiento normativo.

---

## 7. Contenido del perfil

### BR-021 — Imágenes

- Todos los planes admiten foto de perfil y portada.
- Solo puede existir una foto activa y una portada activa por perfil.
- La galería depende del plan y respeta BR-006.
- Una imagen subida durante el alta pertenece al usuario que la subió aunque todavía no esté asociada al perfil.
- Solo su propietario o un administrador autorizado puede reemplazarla o eliminarla.
- Las imágenes congeladas o semicongeladas por una baja no se muestran en el perfil público, pero siguen visibles para el proveedor en la gestión de imágenes según BR-032.
- La visibilidad voluntaria y el orden de las imágenes disponibles se rigen por BR-033.

### BR-032 — Galería al bajar o mejorar de plan

La congelación depende del cupo del plan y es independiente de la visibilidad elegida por el proveedor (BR-033). Este flujo comienza cuando el cambio de plan se hace efectivo, no cuando se programa.

| Estado por plan | Uso en galería | Gestión del proveedor |
| --- | --- | --- |
| Disponible | Ocupa cupo y puede mostrarse públicamente si está habilitada. | Permite el uso normal de la imagen. |
| Semicongelada | Queda fuera del cupo y no se muestra públicamente. | Permanece visible, con selección única pendiente y aviso del tiempo restante antes de su eliminación. |
| Congelada | Queda fuera del cupo y no se muestra públicamente. | Permanece visible, sin posibilidad de intercambiarla con las disponibles, y con aviso del tiempo restante antes de su eliminación. |

**Baja a un plan sin galería**

- Todas las imágenes de galería quedan congeladas y se muestran en la sección de imágenes del proveedor con su advertencia de eliminación.
- No se ofrece selección de imágenes para conservar en la galería, porque el cupo es cero.

**Cambio a un plan con galería y un cupo menor que las imágenes conservadas**

- Tanto al bajar de plan como al mejorar a uno cuyo cupo no alcance para todas las imágenes conservadas, quedan disponibles tantas imágenes como permita el nuevo plan, siguiendo la prioridad y el desempate de BR-009. Las excedentes pasan a la sección de imágenes semicongeladas.
- El proveedor tiene una única oportunidad de elegir con cuáles permanecer, entre las imágenes que quedaron disponibles y las semicongeladas por ese cambio de plan, respetando el nuevo cupo.
- Puede ajustar esa elección antes de guardarla. La oportunidad se consume al confirmar y guardar correctamente la selección.
- Al guardar, las elegidas quedan disponibles y todas las no elegidas quedan congeladas. No vuelve a ofrecerse la selección para ese mismo ajuste de cupo ni se permiten intercambios posteriores con las congeladas. Así se evita usar la sección como almacenamiento rotativo.
- Mientras no se guarde la selección, se mantiene la galería provisional dentro del cupo; las excedentes siguen semicongeladas y su plazo de conservación continúa corriendo.
- Si todas las imágenes conservadas caben en el nuevo plan, no hay excedentes ni se requiere esta selección.

**Conservación y eliminación de excedentes**

- No se eliminan automáticamente imágenes por exceder el plan antes de transcurridos 180 días desde la fecha comunicada al proveedor según BR-009.
- Tanto las congeladas como las semicongeladas muestran cuánto tiempo les queda antes de ser eliminadas. La advertencia se muestra en la gestión del proveedor, nunca en el perfil público.
- Guardar la selección única y pasar de semicongeladas a congeladas no reinicia el plazo. Las imágenes disponibles que se descarten al guardar quedan sujetas al mismo plazo de esa baja.
- Transcurridos los 180 días, las imágenes que continúen congeladas o semicongeladas quedan sujetas a eliminación definitiva.

**Recuperación al mejorar de plan**

- Cuando la mejora queda activa y el nuevo cupo alcanza o supera el total de imágenes conservadas de la galería, todas las congeladas y semicongeladas se descongelan automáticamente y vuelven a estar disponibles para uso normal.
- Las imágenes recuperadas dejan de estar sujetas a la eliminación por aquella baja. Una imagen ya eliminada no puede recuperarse.
- Descongelar conserva la preferencia de mostrar u ocultar: no publica una imagen que el proveedor había ocultado voluntariamente.
- Si el nuevo cupo no alcanza para todas las imágenes conservadas, se aplica el flujo de selección única definido arriba: quedan disponibles las permitidas y las excedentes quedan semicongeladas hasta guardar la elección. Al guardarla, las no seleccionadas quedan congeladas y no se permite repetir la selección para ese mismo ajuste de cupo.

### BR-033 — Mostrar, ocultar y ordenar imágenes de galería

- Mostrar u ocultar es una preferencia de visibilidad pública, independiente de la congelación por plan y de la selección única de BR-032.
- Al ocultar una imagen disponible, deja de mostrarse en el perfil público. En la gestión permanece en la misma galería, se presenta visualmente deshabilitada y pasa a la última posición de la galería, después de las demás imágenes ocultas.
- Al volver a habilitarla, pasa a la última posición del grupo de imágenes habilitadas, antes de las ocultas. Las demás imágenes conservan su orden relativo.
- Ocultar una imagen no la mueve a otra sección, no la congela, no inicia un plazo de eliminación y no libera cupo del plan.
- Mostrar u ocultar no consume ni reabre la selección única y no permite descongelar imágenes ni eludir el límite del plan.

### BR-022 — Redes sociales

- Cada plataforma admite como máximo un enlace por perfil.
- Solo se muestran enlaces válidos y activos.
- Cobre no los muestra; Oro y Platino sí.
- Se conservan al bajar a Cobre para recuperarlos al volver a un plan compatible.

### BR-023 — Medios de pago

- Se pueden declarar varios: efectivo, transferencia, débito y crédito.
- `otros` sigue siendo un valor válido y se muestra en los perfiles que lo tengan guardado, pero ya no se ofrece al cargar el perfil: no es filtrable y elegirlo era una forma de no contestar.
- Son visibles y pueden utilizarse como filtro.
- No dependen del plan.

### BR-024 — Horarios

- Un perfil puede guardar, ordenar, editar y eliminar hasta 10 entradas.
- Cada entrada es texto libre de 3 a 120 caracteres.
- Las sugerencias usan preferentemente 24 horas, pero no limitan el texto permitido.
- Se admiten horarios semanales, días cerrados, horarios cortados, agenda, emergencias y condiciones especiales.
- No se admiten teléfonos, correos, URLs ni HTML.
- Una sugerencia puede editarse; solo se guarda el texto final confirmado.

---

## 8. Clientes, opiniones y moderación

### BR-025 — Identidad del cliente

- Para opinar, el cliente se autentica con Google.
- La identidad externa usa el identificador estable de Google, no el correo.
- Nombre y avatar visibles pueden actualizarse desde Google en cada acceso.
- Un cliente suspendido no puede crear ni modificar opiniones o reportes.

### BR-026 — Opiniones y calificación

- Un cliente puede publicar como máximo una opinión por perfil.
- La calificación es un entero de 1 a 5.
- La opinión puede editarse y continúa siendo la misma para ese cliente y perfil.
- Solo opiniones publicadas se muestran y contribuyen a la calificación.
- El promedio es suma de estrellas publicadas dividida por su cantidad. Sin opiniones, el promedio es inexistente, no cero.
- Ocultar o republicar actualiza inmediatamente promedio y conteo.

### BR-027 — Reportes y moderación

- Clientes, proveedores y administradores autenticados pueden reportar una opinión.
- Una identidad puede reportar la misma opinión como máximo una vez con el modelo actual.
- Motivos: spam, contenido ofensivo, información falsa, información personal, conflicto de interés u otro.
- Reportar no oculta automáticamente ni modifica la calificación.
- Cada reporte abre una revisión y termina aceptado o desestimado.
- Solo un administrador autorizado resuelve reportes y cambia la visibilidad por moderación.
- El historial no se borra solo porque una opinión fue reportada.

---

## 9. Integridad, abuso y administración

### BR-028 — Inactivación y eliminación

- Catálogos, perfiles y contenidos referenciados se desactivan cuando sea necesario conservar relaciones o trazabilidad.
- La eliminación definitiva se reserva para solicitudes legítimas, datos huérfanos o vencimientos definidos.
- Suspender contenido no borra evidencia necesaria para moderación.

### BR-029 — Prevención de abuso

- El texto libre no puede contener código ejecutable ni eludir límites de longitud.
- El producto puede aplicar límites operativos razonables de frecuencia, tamaño y almacenamiento aunque un beneficio diga “sin límite”.
- Perfiles, opiniones, reportes, imágenes y formularios deben poder moderarse.
- Las acciones sensibles exigen autorización del propietario o rol administrativo.
- Las reglas antiabuso no pueden degradar silenciosamente un plan.

### BR-030 — Consistencia

- Una operación que afecta varias reglas se completa por entero o no se aplica.
- Nunca debe quedar público un perfil que dejó de cumplir requisitos de publicación.
- Los conteos públicos corresponden con los elementos activos realmente visibles. En la gestión de galería, el uso del cupo sigue BR-007 y distingue las imágenes ocultas de las congeladas o semicongeladas.

### BR-031 — Búsqueda y filtros

- El buscador pide texto libre; todo lo que se elige de una lista vive en un único panel de filtros.
- Los criterios son: qué se busca, ubicación, calificación, rubros y especialidades, medios de pago y modalidad.
- **Qué se busca** distingue proveedor independiente, empresa y carta de servicio. Cada clase se consulta como una entidad propia.
- Perfiles y cartas se presentan en una sola lista, identificando el tipo de cada resultado. Dentro de un nivel de evidencia se muestra una entidad por proveedor antes de repetirlo; para un mismo proveedor y nivel, sus cartas pertinentes preceden a su perfil.
- Una lista de criterios vacía significa «todos». Elegir varios valores dentro de un criterio significa «cualquiera de estos»; criterios distintos se combinan restringiendo.
- Ningún criterio limita cuántos valores se pueden elegir. En particular, ubicación y especialidades no tienen tope.
- Los filtros viven en la URL, de modo que una búsqueda se puede compartir, volver atrás funciona y el estado sobrevive a recargar.
- Un valor que no existe en el catálogo se descarta al leer la URL: no filtra ni llega a la consulta.
- El número de criterios elegidos se muestra sobre el acceso al panel de filtros. Cuenta valores, no secciones: tres zonas son tres. Lo que está en «todos» no suma, y el texto escrito tampoco —se ve en el propio campo—.
- La búsqueda se lanza al confirmar, no mientras se escribe.
- Buscar desde cualquier página lleva a la página de resultados con los criterios aplicados.
- El texto se interpreta con normalización, alias canónicos y relaciones editoriales conocidas. Una relación con una especialidad no prueba que cada proveedor realice una actividad concreta: las coincidencias principales requieren evidencia declarada, salvo cuando la consulta representa el oficio o la especialidad completa.
- La relevancia de la coincidencia se aplica antes que la reputación. La oferta explícita —nombre, frase completa o alias validado en el servicio propio— precede a la coincidencia que sólo se apoya en una especialidad. La diversidad opera dentro de cada nivel de evidencia y nunca elimina resultados pertinentes.
- La descripción de un perfil y el nombre de un proveedor no convierten sus cartas ajenas en coincidencias de un oficio. Una actividad concreta exige evidencia en el servicio o carta; la especialidad general sólo alcanza cuando la consulta representa el oficio completo.
- Si no hay coincidencias, el total continúa en cero. Se pueden ofrecer correcciones o enlaces para explorar, pero no llenar la lista con proveedores o cartas generales. Retirar un filtro siempre requiere una acción de la persona usuaria.

### BR-034 — Cartas de servicio

- Una carta describe una oferta concreta o paquete y pertenece a un único perfil.
- Incluye nombre, descripción, especialidad, nivel de propuesta, precio, modalidad, duración, forma de pago, disponibilidad e imágenes opcionales.
- Cada carta admite hasta cuatro imágenes propias: la primera es la portada y las tres restantes son muestras. Estas imágenes no consumen el cupo de galería del perfil. Si no hay portada, se usa el fondo visual de la categoría.
- El nivel de propuesta es económico, estándar o premium y describe la oferta; no revela ni depende del plan interno del proveedor.
- El precio puede ser a convenir, fijo, «desde» o un rango en pesos uruguayos. Un rango válido tiene un máximo igual o mayor que el mínimo.
- La reputación mostrada es la calificación general del proveedor. No se mantienen opiniones separadas por carta.
- El proveedor puede dejarla como borrador. Sólo se publica cuando la carta, su especialidad y el perfil están activos y la carta está marcada para publicar.
- Agregar, modificar y eliminar cartas sólo está disponible en el modo edición. La vista normal del dashboard es exclusivamente de presentación y muestra también sus estados privados.
- Al superar el límite de un plan se conservan primero las cartas por su orden y antigüedad. Las excedentes siguen editables para su recuperación posterior, pero no son públicas.
- Cada carta pública tiene una URL canónica estable bajo `/profesionales/{proveedor}/servicios/{servicio}` y puede aparecer como resultado independiente de búsqueda y dentro del perfil del proveedor. Las URLs antiguas bajo `/servicios/` redirigen permanentemente a la canónica.

---

## 10. Decisiones comerciales pendientes

No deben inventarse durante la implementación:

1. Precio y período de Oro y Platino.
2. Duración y condiciones de prueba gratuita.
3. Plazo de gracia y consecuencias exactas de `past_due`.
4. Conservación de la insignia al bajar a Cobre.
5. Documentos aceptados, autoridades emisoras y períodos de vigencia específicos para cada actividad regulada.
6. Límites operativos antiabuso para capacidades “sin límite”.
7. Edición, réplica del proveedor y apelación en opiniones.
8. Eliminación de cuentas y conservación legal del contenido.

Hasta definirlas, la implementación debe mantenerlas configurables o bloquear el flujo afectado; no debe asumir valores irreversibles.
