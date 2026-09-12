# Propuesta de diseño del asistente de creación de perfiles

Estado: implementado el 2026-09-12; evaluación con personas usuarias pendiente. Propuesta original: 2026-09-11.

La implementación conserva las validaciones actuales del servidor: localidad y dirección del local requeridas, y cobertura editable en todas las modalidades. Estas diferencias preexistentes con las reglas documentadas se explican en [el asistente](../ui/create_profile_wizard.md). No se modificaron reglas de negocio para resolverlas dentro del rediseño visual.

Se verificaron en navegador el recorrido básico, recuperación al recargar, selección de tipo, localidad y anchos de 320, 375, 390, 768, 1280 y 1440 px; además, el flujo de Oro, validación de redes, revisión de pago y cancelación/confirmación de baja a Cobre. No equivale a pruebas de usabilidad con personas ni a pruebas en dispositivos físicos.

Basada en [las ideas del formulario](todo.md), contrastadas con [el asistente actual](../ui/create_profile_wizard.md), [las reglas de negocio](../rules/business_rules.md) y `src/components/dashboard/profile-form.tsx`. Este documento propone la experiencia; no sustituye las reglas vigentes ni convierte las ideas del documento original en cambios ya aprobados.

## 1. Dirección recomendada

Un asistente de una tarea por pantalla, pensado primero para teléfono. Mantener la bienvenida, el orden propuesto y la posibilidad de terminar con lo básico. Mostrar una pregunta clara, una explicación breve y una acción principal en cada paso.

El ajuste principal respecto de la idea original es evitar repetir «elegir paso → leer descripción → Completar → cerrar popup». Después de Comenzar, el primer paso se abre directamente y Continuar lleva al siguiente. El resumen de pasos sigue disponible para orientarse y revisar lo anterior.

En mobile, el área de trabajo ocupa el espacio bajo un encabezado compacto. Recomiendo que sea parte de la página, con apariencia de pantalla dedicada. Los selectores de localidad pueden reemplazar temporalmente su contenido, con Volver y Confirmar. Así se obtiene el espacio pedido sin acumular ventanas superpuestas.

En desktop, el mismo recorrido usa una columna lateral de progreso y un formulario central. La estructura de campos y las validaciones son compartidas entre tamaños.

## 2. Recorrido y cierre

1. Bienvenida, sin número de paso.
2. Cinco pasos básicos: Especialidades → Servicios → Identidad → Ubicación → Contacto.
3. Resumen de lo cargado con dos caminos: terminar con lo básico o agregar contenido opcional.
4. Imágenes y, si el plan lo admite, Redes. Cada paso permite «Omitir por ahora» si está vacío.
5. Pago cuando corresponda por la configuración vigente del plan, conservando el checkbox provisional.
6. Confirmación de creación y estado real del perfil.

El acceso a terminar con lo básico debe estar disponible también al recorrer los extras: no obligar a completar o visitar todos para encontrar la salida.

| Situación                                    | Acción principal del resumen | Alternativa           |
| -------------------------------------------- | ---------------------------- | --------------------- |
| Cobre, básicos válidos                       | Crear perfil                 | Agregar fotos         |
| Plan con pago pendiente en el asistente      | Continuar al pago            | Agregar fotos y redes |
| Extras terminados y pago requerido pendiente | Continuar al pago            | Revisar datos         |
| Todo lo requerido resuelto                   | Crear perfil                 | Revisar datos         |

El resumen es una pantalla breve de revisión, sin campos nuevos. No cuenta como otro requisito. En el pago, la confirmación del checkbox habilita Crear perfil si el resto sigue válido. No se presenta ese checkbox como un cobro exitoso.

Después de guardar, distinguir «Perfil creado» de «Perfil publicado». Si faltan verificaciones u otros requisitos de BR-003/020, explicar el siguiente paso con una acción concreta. No prometer visibilidad pública sólo por terminar el asistente.

## 3. Bienvenida y orientación

Texto propuesto:

> Creá tu perfil paso a paso
>
> Contanos qué hacés, dónde trabajás y cómo pueden contactarte. Primero completás los datos básicos; las fotos y otros detalles podés agregarlos después.
>
> Tu plan actual es Cobre. Podés cambiarlo durante la creación.

Debajo: mini recorrido «Qué ofrecés · Tu presentación · Dónde y cómo contactarte» y botón Comenzar centrado. No prometer un tiempo de carga sin medirlo.

Si hay un borrador propio, reemplazar la bienvenida por «Continuá creando tu perfil», mostrar el punto de avance y ofrecer Retomar. No borrar el borrador al entrar o recargar. Informar «Avance guardado en este navegador» sólo si la persistencia funcionó; no insinuar sincronización entre dispositivos.

Durante los básicos, mostrar «Paso 2 de 5 · Datos básicos». Los extras se anuncian como «Opcional» y el pago como «Último requisito», sin cambiar retrospectivamente el denominador de los cinco básicos.

Estados del resumen: Pendiente, En curso, Completado, Para revisar y Omitido. Un opcional vacío no recibe el mismo tilde que un paso completado.

## 4. Composición responsive

### Mobile

Esquema orientativo, con los colores y componentes existentes:

```text
┌──────────────────────────────────┐
│ ←  Crear perfil       Plan Cobre │
├──────────────────────────────────┤
│ Paso 1 de 5          Ver pasos   │
│ ━━━━━░░░░░░░░░░░░░░░░░░░░░░░░  │
│ ¿A qué te dedicás?               │
│ Elegí las especialidades que     │
│ mejor describen tu trabajo.      │
│                                 │
│ Especialidades 1/2 · Rubros 1/1   │
│ [ Buscar especialidad…        ] │
│                                 │
│ Hogar y mantenimiento       ⌄   │
│ ☑ Electricidad                  │
│ ☐ Plomería                      │
│ ☐ Cerrajería                    │
│                                 │
├──────────────────────────────────┤
│ [ Volver ]     [ Continuar → ]  │
└──────────────────────────────────┘
```

- Una columna, márgenes de 16 px y campos con texto base de 16 px como punto de partida.
- Controles y filas seleccionables con objetivo de altura de 48 px; toda la fila activa el checkbox o radio.
- Encabezado compacto; evitar sumar el menú completo del dashboard, una barra de planes grande y otra barra de pasos sobre el formulario.
- Pie persistente con Volver y Continuar. Reservar espacio para que no tape el último campo, su error o el teclado; respetar el área segura del dispositivo.
- Un único desplazamiento principal. Evitar listas pequeñas con scroll dentro del scroll del formulario.
- Ver pasos abre el resumen; al volver se conserva la posición. Los pendientes bloqueados explican qué requisito falta.
- El teclado no aparece automáticamente al abrir un paso. Los campos de teléfono y correo usan el teclado adecuado.
- En pantallas muy estrechas, Agregar puede ocupar una segunda fila. No comprimir el campo del servicio para mantener un botón al lado a cualquier costo.

### Desktop

```text
┌──────────────────────────────────────────────────────────┐
│ Crear perfil                       Plan Cobre · Cambiar  │
├──────────────────┬───────────────────────────────────────┤
│ DATOS BÁSICOS    │ Paso 2 de 5                            │
│ ✓ Especialidades│ ¿Qué servicios ofrecés?                │
│ ● Servicios     │ Agregá lo que pueden contratarte.       │
│   Identidad     │                                        │
│   Ubicación     │ [ Escribí un servicio… ] [ Agregar ]    │
│   Contacto      │                                        │
│                 │ Sugerencias según tus especialidades   │
│ OPCIONALES      │ ☐ Instalación de luminarias             │
│   Imágenes      │ ☐ Reparación de instalaciones           │
│                 │                                        │
│                 │ [ Volver ]              [ Continuar ]  │
└──────────────────┴───────────────────────────────────────┘
```

Punto de partida: contenedor de 1040–1120 px, lateral de 240–280 px y formulario de hasta 680 px. Activar dos columnas cuando ambas quepan cómodamente, aproximadamente desde 1024 px. En tablet mantener una columna si el lateral estrecha los campos.

Mantener el orden de lectura y el texto de acciones entre tamaños. No agregar una vista previa permanente: compite por espacio y atención. El resumen final puede mostrar una tarjeta de ejemplo con los datos ingresados.

## 5. Diseño de cada paso

| Paso           | Pregunta y ayuda                                                            | Interacción propuesta                                                                                          |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Especialidades | ¿A qué te dedicás? Elegí las especialidades que describen tu trabajo.       | Búsqueda, rubros desplegables y especialidades con checkbox. Seleccionadas visibles con su rubro.              |
| Servicios      | ¿Qué servicios ofrecés? Agregá trabajos que pueden contratarte.             | Input + Agregar, lista de agregados y sugerencias seleccionables debajo.                                       |
| Identidad      | ¿Cómo querés presentarte? Así te reconocerán quienes busquen tus servicios. | Nombre, tarjetas con radio para independiente/empresa y descripción con ejemplo editable.                      |
| Ubicación      | ¿Dónde y cómo trabajás? Podés elegir más de una modalidad.                  | Modalidades visibles; cobertura y locales aparecen según la respuesta.                                         |
| Contacto       | ¿Cómo pueden contactarte? Elegí qué datos mostrar en tu perfil.             | Conservar campos y comportamiento actuales; separar contacto de horarios y formas de pago mediante subtítulos. |
| Imágenes       | Mostrá quién sos y tu trabajo. Podés hacerlo después.                       | Tocar foto/portada para subir o reemplazar; galería según el plan.                                             |
| Redes          | ¿Dónde pueden ver más de tu trabajo? Completá sólo las redes que usás.      | Una fila por plataforma con icono, nombre visible e input.                                                     |
| Pago           | Revisá tu plan                                                              | Mantener precio/configuración y checkbox actual; indicar que todavía no se realiza un cobro.                   |

### Especialidades y cupos

Los rubros agrupan opciones; se derivan de las especialidades y no agregan otra selección obligatoria. Mostrar por separado los contadores de rubros y especialidades. Aplicar BR-006/010 sin ocultar rubros ni especialidades cuando se llena el cupo.

Al intentar superar un límite, mostrar la notificación: «Tu plan permite 2 especialidades. Podés quitar una o cambiar de plan», con las acciones `Aceptar` y `Ver planes`. No mostrarla al seleccionar el último elemento permitido. Se pueden desmarcar las seleccionadas.

La búsqueda conserva todas las opciones. Si se intenta agregar una especialidad de un rubro adicional, explicar la restricción en la notificación sin modificar la selección.

### Servicios

Mostrar el cupo junto al título de la lista, contando tanto los personalizados como los sugeridos. Las sugerencias se agrupan por las especialidades ya elegidas; no mostrar todo el catálogo.

Con una sola especialidad, vincular automáticamente e indicar «Se agregará a Electricidad». Con varias, al tocar Agregar aparece una elección inline de especialidad con su rubro y acciones Agregar servicio / Cancelar. El texto se conserva mientras se decide. Una sugerencia del catálogo ya trae su vínculo.

Aplicar BR-011 para longitud y duplicados. Un texto escrito pero no agregado sigue siendo pendiente: mostrar «Agregá este servicio o descartá el texto para continuar». Evitar que el usuario crea que se guardó. Quitar una especialidad con servicios asociados requiere explicar el efecto antes de confirmar la eliminación.

### Identidad y sugerencia de descripción

Independiente y Empresa se presentan como radios con texto visible. La selección no se realiza sólo con un icono.

Botón «Ver un ejemplo» debajo de la descripción. Construir una plantilla sencilla con servicios confirmados; por ejemplo: «Ofrezco servicios de instalación de luminarias y reparación de instalaciones eléctricas». Adaptar la voz al tipo de perfil y ofrecer «Usar este texto» para que la persona lo confirme y edite.

No inventar experiencia, habilitaciones, calidad, disponibilidad ni cobertura. No reemplazar texto existente sin una decisión explícita. Una plantilla local alcanza para esta primera versión; no requiere IA generativa. Conservar la validación vigente de la descripción.

### Ubicación

Aplicar BR-014 a BR-017: distinguir las zonas donde se desplaza de la ubicación de un local. La dirección sigue siendo opcional y el local puede ubicarse en departamento o localidad; no convertir calle y localidad precisa en requisitos nuevos.

- A domicilio sin atención a distancia: mostrar cobertura con búsqueda y checkboxes jerárquicos. Indicar claramente la cobertura nacional por defecto y cómo acotarla.
- A distancia: mostrar «Atendés a distancia en todo Uruguay» y conservar la deducción vigente de cobertura.
- En el local: mostrar ubicaciones físicas, selección de departamento/localidad, dirección opcional y principal. Esto sigue apareciendo aunque también atienda a distancia.

El selector de localidad ocupa el área de trabajo en mobile y un diálogo acotado en desktop. Tiene búsqueda, departamento como contexto, selección única y Confirmar ubicación. Volver cancela la selección provisional; confirmar la aplica. Al cerrar se recuperan el foco y los datos del formulario.

No trasladar el cupo de locales a las zonas de cobertura: son conceptos diferentes. Leer los límites que efectivamente define el dominio; no crear un límite comercial para checkboxes de cobertura a partir del cupo de ubicaciones físicas.

### Contacto

Mantener el correo precargado editable, el teléfono, WhatsApp y sus controles de visibilidad. Explicar junto a ellos qué se mostrará públicamente. Conservar horarios y formas de pago en este paso, sin confundirlas con el pago del plan.

La marca de completado debe basarse en la validación real. Hoy `completion.contacto` sólo comprueba que el teléfono no esté vacío; eso no prueba validez ni el cumplimiento de las condiciones de contacto público de BR-003/004. Resolver esa diferencia al centralizar validación, sin introducir campos obligatorios nuevos por motivos visuales.

### Imágenes y redes

Foto de perfil cuadrada/circular y portada horizontal, con área completa pulsable y texto «Agregar foto» / «Agregar portada». Tras cargar, mostrar miniatura y acciones accesibles Cambiar y Quitar. Conservar el funcionamiento de galería y sus reglas BR-021/032/033.

Mostrar progreso y error por archivo, con Reintentar. No habilitar una salida que pierda silenciosamente una carga pendiente. Si se omite el paso, conservar las imágenes ya subidas correctamente. Avatar y portada están disponibles en todos los planes.

En redes, mantener siempre el nombre de la plataforma además del icono. Desktop: etiqueta e input al lado; mobile estrecho: etiqueta sobre el campo. Vacío significa no agregar esa red. Si se escribió un valor inválido, mostrar error en esa fila y conservar el resto. Para continuar se corrige o se vacía ese campo; no publicar parcialmente descartando errores sin avisar. Referencia: BR-022/030.

## 6. Navegación y validación

Continuar se habilita cuando el paso obligatorio es válido. Mientras no lo sea, mostrar una instrucción concreta cerca del botón: «Elegí al menos una especialidad para continuar». No llenar la pantalla de errores antes de que la persona interactúe; validar al salir del campo y actualizar al corregirlo.

- Volver siempre está disponible y conserva lo escrito, aunque sea parcial.
- Se puede revisar cualquier básico anterior; no saltar por encima del primer obligatorio inválido desde el resumen, el lateral o un estado restaurado.
- En opcionales vacíos, Omitir por ahora avanza sin marcarlos como completados. Con contenido inválido, pedir corregirlo o descartarlo explícitamente.
- Si una edición anterior invalida un paso posterior, marcarlo Para revisar y llevar al primer requisito pendiente antes de finalizar. Conservar los datos no afectados.
- Abrir y cerrar un paso no lo completa. Para los valores por defecto, Continuar confirma la respuesta mostrada.
- El botón Atrás del navegador debe cerrar primero una subvista de selección y recuperar el contexto. Definir y verificar su comportamiento antes de publicar el rediseño.
- Un error del servidor abre el paso correspondiente, conserva el borrador y sitúa el foco en un resumen o campo con error. Un error de red ofrece Reintentar y evita doble envío.

Separar «visitado», «válido» y «confirmado». Usar la misma definición de validez para el bloqueo de Continuar, el progreso y el envío, con revalidación autoritativa en el servidor. Hoy la navegación llama a `setStep` y los indicadores `completion` son comprobaciones parciales; cambiar sólo la apariencia no alcanza.

## 7. Cambio de plan durante el recorrido

Mantener los dos caminos existentes de alta y edición, documentados en [el asistente actual](../ui/create_profile_wizard.md). Aplicar BR-006 a BR-009; no cambiar sus políticas mediante este diseño.

En el alta, antes de confirmar una baja que recorta datos, mostrar el resumen calculado de pérdidas y acciones «Mantener mi plan» / «Cambiar y quitar excedentes». Hasta aceptar, se mantienen el plan anterior y sus contadores. Al cancelar, todo queda igual.

Después del cambio, actualizar cupos y pasos disponibles. Conservar el paso actual si todavía existe y es accesible; en caso contrario ir al primer obligatorio pendiente o al resumen. Una mejora no reinicia el formulario ni obliga a llenar los nuevos extras. Revalidar el requisito provisional de pago según el plan resultante.

No aplicar el recorte del borrador a un perfil existente. Tampoco prometer recuperación de datos eliminados durante el alta mediante las reglas de conservación de perfiles ya creados.

## 8. Accesibilidad y criterios visuales

Reutilizar tipografía, colores, bordes y botones del sitio. Usar un color principal para acciones, texto + icono para estados y jerarquía tipográfica simple. Evitar animaciones largas o decoraciones que empujen los campos fuera de pantalla.

Etiquetas persistentes, foco visible, agrupaciones semánticas para radios/checkboxes y errores vinculados a sus campos. Anunciar cambios de paso, errores y contadores relevantes sin leer toda la pantalla en cada pulsación. Respetar reducción de movimiento y ampliación de texto.

Si se usa un modal, el fondo queda inactivo, el foco permanece dentro y al cerrarlo vuelve al disparador. Dejar visible el header no significa que sus controles externos deban continuar activos. Estas pautas siguen el [patrón de diálogo de W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

La recomendación de agrupar por tarea y titular cada pantalla con una pregunta toma como referencia [Question pages de GOV.UK](https://design-system.service.gov.uk/patterns/question-pages/). Es una adaptación propuesta al producto, no una medición de mejora ya obtenida.

## 9. Implementación por etapas

1. **Prototipo navegable con datos de ejemplo.** Validar bienvenida, pasos básicos, selector de ubicación, resumen y salida por plan en mobile y desktop. Probar especialmente Servicios y Ubicación con personas de poca experiencia digital.
2. **Estado y navegación.** Definir pasos, condiciones de acceso, validación compartida y restauración del borrador. Mantener sus IDs estables al reordenar; contemplar que un borrador antiguo abra Identidad sin Especialidades y recuperarlo en el primer requisito pendiente.
3. **Estructura visual y campos.** Extraer paneles reutilizables de `profile-form.tsx`, incorporar listas, radios, sugerencias e imágenes pulsables. `profile-workspace.tsx` sigue coordinando el plan; `profile-draft.ts` conserva aislamiento por cuenta y protección de hidratación.
4. **Integración y revisión.** Confirmar cambios de plan, errores de servidor, pago provisional y estado posterior a crear. Actualizar la documentación del asistente cuando la propuesta esté implementada.

El alta y la edición comparten campos actualmente. Mantener esa reutilización con una estructura de navegación propia del alta; la edición no debe quedar forzada a recorrer secuencialmente los pasos ni volver a pasar por la bienvenida.

Antes de escribir código Next.js, leer las guías locales relevantes en `node_modules/next/dist/docs/`, como exige `AGENTS.md`.

## 10. Criterios de aceptación

- En 320, 375, 390 y 768 px no hay scroll horizontal; en 1280 y 1440 px el formulario mantiene un ancho legible. Con teclado abierto se puede alcanzar el campo, su error y las acciones.
- Una persona puede completar Cobre con datos básicos sin entrar a Imágenes. En un plan con pago requerido puede omitir fotos/redes y llegar al checkbox provisional.
- No se avanza con un obligatorio inválido desde ningún acceso. Los opcionales vacíos no bloquean; los datos inválidos nunca desaparecen silenciosamente.
- Se prueban los tres planes y sus límites; bajar y cancelar no cambia nada, aceptar conserva exactamente lo permitido por la lógica existente, y mejorar no reinicia el avance.
- Servicios personalizados y sugeridos mantienen su especialidad correcta; se prueban duplicados, varias especialidades y eliminación de una con servicios asociados.
- Se verifican las combinaciones de modalidades, cobertura nacional, departamento/localidad, local sin dirección y múltiples locales según el plan.
- Recargar, volver y retomar conserva datos y un paso accesible. Cambiar de cuenta no muestra otro borrador. Un fallo de almacenamiento no muestra una confirmación falsa de guardado.
- Se prueban cargas fallidas, cargas pendientes, redes vacías/incorrectas y reintento de envío sin duplicación.
- El recorrido funciona con teclado y lector de pantalla; selectores y diálogos restauran el foco y no lo dejan detrás de una capa.
- Crear comunica el estado real y los requisitos de publicación pendientes. Editar un perfil existente conserva su comportamiento y sus reglas de cambio de plan.

Tras implementar, ejecutar typecheck, lint y verificaciones funcionales apropiadas del repositorio. Esta propuesta documental no implica que esas pruebas o una evaluación con usuarios ya se hayan realizado.

Para evaluar el diseño, observar finalización de básicos, abandono por paso, retrocesos por errores y éxito al retomar. Como prueba inicial propuesta, pedir a 3–5 personas que creen un perfil desde su teléfono sin instrucciones del facilitador. No capturar contenido de contacto o descripción como métricas.
