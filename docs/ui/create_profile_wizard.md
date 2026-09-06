Cuando un usuario se registra por primera vez entonces es redirigido a la pagina "Crear" esta pagina mostrara un formulario por etapas que ayudara a crear un perfil basico o avanzado segun el plan elegido.

# Flow

- El borrador (`qlh.profileDraft` en localStorage) se borra **al enviar el formulario de registro**, no al entrar a "Crear".

  Antes se borraba al entrar a "Crear" y eso rompía la recarga: quien recargaba a mitad del formulario perdía el paso y todo lo cargado. Borrar en el registro cumple lo mismo —garantizar que una cuenta nueva no arranque con datos de otra— sin castigar a quien simplemente recarga.

  El borrador además lleva anotada la cuenta que lo escribió y no se lee desde ninguna otra, así que una máquina compartida no arrastra datos ajenos aunque el borrado no llegue a correr.

- El plan elegido (`qlh.selectedPlan`) sí se reclama al entrar a "Crear": se elige en `/planes` sin sesión, así que no puede nacer a nombre de nadie. Al entrar se le pone dueño, y si ya era de otra cuenta se descarta.

- Desde `/planes`, tocar el botón de un plan lleva a "Registro" con ese plan ya elegido y con el foco puesto en el formulario (ancla `#auth-form`).

## Persistencia al recargar

El formulario guarda el borrador en cada cambio, pero **no antes de haber leído el que ya estaba**.

`useSyncExternalStore` rinde primero el snapshot del servidor —vacío, para que la hidratación calce— y recién en el render siguiente el del cliente. Si el guardado corre en ese primer render escribe un formulario en blanco encima del guardado. No alcanza con ignorar los borradores vacíos: la modalidad viene con "A domicilio" puesta de fábrica, así que el borrador del primer render no parece vacío y pisa igual.

## Los dos caminos del cambio de plan

Bajar de plan hace **dos cosas distintas** según haya perfil creado o no. No
son una regla con excepción: son dos caminos separados, y confundirlos lleva a
borrar datos que había que conservar o a conservar datos que había que borrar.

Lo único que decide cuál corre es si existe perfil (`!existing` en
`saveProfile`). Ni el plan, ni el paso, ni la pantalla.

### Camino 1 — Primera creación del perfil

**Cuándo:** el usuario todavía no tiene perfil. Está completando el asistente
por primera vez y, con datos ya cargados, cambia a un plan menor (Platino a
Oro o Cobre, Oro a Cobre).

**Qué pasa:** se muestra un popup que advierte de la pérdida de datos.

- **Acepta:** se borra lo que sobra y el plan nuevo pasa a regir.
- **Cancela:** no se toca nada y el plan vuelve al que regía.

**Por qué se borra:** no hay perfil ni período pago que proteger. Lo elegido
vive sólo en el borrador del navegador (`qlh.profileDraft`). Conservar lo que
excede no le sirve a nadie y deja el formulario mostrando especialidades que
el plan no admite, con contadores en rojo que no se pueden bajar sin adivinar
cuáles sobran.

**Dónde vive:** `fitToPlan` (`src/domain/plan-fit.ts`), llamado desde
`ProfileFormFields` para el aviso y el recorte, y desde `saveProfile` para
revalidarlo en el servidor.

### Camino 2 — El usuario ya tiene perfil creado

**Cuándo:** existe perfil y se pide bajar de plan.

**Qué pasa:** no se borra nada, y tampoco cambia nada en el momento.

1. La baja se **agenda** en `downgrade_plan_id`. Sigue rigiendo el plan
   contratado.
2. Hasta que vence el período pago (`plan_expires_at`), `effectivePlanId()`
   devuelve el plan mayor: el usuario sigue usando todo lo que pagó.
3. Al vencer, rige el plan menor y lo que excede se **esconde**: queda
   guardado con `is_active = 0`, y las consultas públicas filtran por
   `is_active = 1`.
4. Lo escondido vuelve solo si se recontrata. Al agendar la baja se anota
   además una fecha (`purge_after`, hoy a 180 días —
   `EXCESS_RETENTION_DAYS`) a partir de la cual *se podría* borrar lo que
   quedó fuera. Es sólo una fecha anotada: hoy no hay ninguna tarea que
   borre, así que en la práctica lo escondido se conserva.

**Por qué no se borra:** el período ya está cobrado. Quitar funciones antes de
que venza sería cobrar por algo que se dejó de dar (RF-053, BR-009).

**Dónde vive:** `changePlan` (`src/app/actions/plan.ts`) agenda;
`effectivePlanId()` y `downgradeIsDue()` (`src/domain/plan-changes.ts`)
deciden qué plan rige hoy; `relationStatements`
(`src/infrastructure/d1-profile-repository.ts`) marca `is_active = 0`.

### Resumen

| | Camino 1 (sin perfil) | Camino 2 (con perfil) |
|---|---|---|
| Popup de advertencia | Sí | No |
| Efecto | Borra lo que sobra | Esconde lo que sobra |
| Cuándo | Al aceptar el popup | Al vencer el plan pagado |
| Se recupera | No | Sí, recontratando (180 días) |
| Helper | `fitToPlan` | `effectivePlanId` + `is_active = 0` |

> Al escribir código nuevo que dependa del plan, decidí primero en cuál de los
> dos caminos estás. `fitToPlan` **nunca** debe correr sobre un perfil que ya
> existe, y el agendado de baja **nunca** aplica durante la primera creación.

## Rubro y Especialidades

Dependiendo del plan se pueden agregar más o menos especialidades. Los rubros
no se eligen: se derivan de las especialidades (BR-010), y el plan limita las
dos cosas por separado.

### Reglas

1. Cada especialidad elegida queda como un botón removible de dos líneas: el
   nombre de la especialidad arriba y, en letra chica, el rubro del que sale.

   No es decoración. Hay homónimas en rubros distintos —"Veterinaria" está en
   Mascotas y en Servicios rurales—, y una vez elegidas la lista ya no está a
   la vista para desempatarlas: sin el rubro, dos etiquetas idénticas no se
   distinguen y no hay forma de saber cuál quitar.

2. Alcanzado el cupo de rubros del plan, el buscador deja de ofrecer
   especialidades de otros rubros.

   El tope de rubros no se elige ni se ve venir: elegir una especialidad de un
   rubro nuevo lo consume sin decirlo, y se sabría recién al guardar, con un
   error que pide quitar algo sin decir qué. Dejando de ofrecerlas, el límite
   se explica solo. Se avisa además con el cartel del plan, porque si no una
   especialidad que existe parecería no existir.

3. Sólo se muestran especialidades de los rubros permitidos.

4. **Camino 1 únicamente.** Al bajar de plan durante la primera creación del
   perfil, con datos que no entran en el nuevo, se pregunta antes de aplicarlo.

   El aviso dice **qué** se pierde, contado: "1 rubro, 3 especialidades, 3
   servicios". "Vas a perder datos" sin más obliga a aceptar a ciegas o a
   cancelar por las dudas.

   Aceptando se recortan las últimas entradas hasta que entre en el plan, en
   este orden exacto:

   1. Los rubros que sobran, con **todas** sus especialidades.
   2. Sobre lo que queda, el tope de especialidades.
   3. Los servicios de especialidades que ya no están.
   4. El tope de servicios, después el de ubicaciones, después las redes si el
      plan no las incluye.

   El orden importa: recortar primero por especialidad podría dejar el rubro
   sobrante con una sola y seguir sin entrar en el tope de rubros.

   Se conserva lo primero que se eligió, que es lo que la persona consideró
   principal (TR-016). Los servicios de una especialidad que se fue se van con
   ella (BR-010): dejarlos huérfanos los haría rechazar por la FK compuesta al
   guardar.

   Ejemplo (Oro 2 rubros / 6 especialidades → Cobre 1 rubro / 2
   especialidades, con 3 especialidades del rubro A y 2 del rubro B): se va el
   rubro B con sus 2 especialidades, y de las 3 que quedan en A sobreviven las
   2 primeras. Pérdida: 1 rubro, 3 especialidades, y los servicios que
   colgaban de ellas.

   Cancelando no se toca nada y el plan vuelve al que regía. Mientras el aviso
   está sin responder se sigue mostrando el plan viejo —es el que rige, porque
   todavía no se recortó nada—: pintar con los topes del nuevo dejaría a la
   vista contadores en rojo y pasos que desaparecen para un cambio que quizá
   se cancele.

   Un plan menor que igual da para todo lo cargado se aplica sin preguntar: la
   condición es que algo no entre, no que el plan haya bajado.

## Servicios
- En el select de servicios vamos a tener 2 formas de listar las sugerencias:
1. Si se seleccionaron especialidades en el paso anterior entonces vamos a mostrar como sugerencias los servicios que estan son partes de estas especialidades nada mas, los demas no los mostramos. La idea es ser lo mas precisos posible y ayudar al usuario sin crear demasiado ruido.
2. Si no se selecciono ninguna especialidad en el paso anterior entonces simplemente muestra todas las sugerencias.

Recerda que los servicios son libres al agregarlos, no tienen que estar en las sugerencias, las sugerencias solo son eso. Por lo tanto si se cambia a un plan menor simplemente hay que remover los ultimos servicios que no entren en la cantidad disponible del plan. Siempre se eliminan primero los ultimos que fueron agregados.

## Servicios

Las sugerencias salen de `src/data/taxonomy.json`, que es un catálogo fijo
generado con `npm run generate:services` desde
`docs/data/rubros_especialidades_servicios.md` (TR-021). No se consulta nada
en vivo: el JSON se importa una vez y se indexa al cargar el módulo.

### Las dos formas de sugerir

El buscador arma sus sugerencias de dos maneras, según el paso anterior:

1. **Con especialidades elegidas** — se sugieren **sólo** los servicios que
   cuelgan de esas especialidades. Los demás no se muestran.

   Es para ser preciso y no hacer ruido: quien declaró que es cerrajero no
   tiene por qué ver "Corte de cabello" entre sus opciones. En números, dos
   especialidades de peluquería llevan el catálogo de 1174 sugerencias a 19.

2. **Sin ninguna especialidad elegida** — se sugiere el catálogo entero, que
   es lo único que se puede ofrecer sin saber nada del proveedor.

Antes las especialidades declaradas sólo **priorizaban** (iban primero, con un
empujón de puntaje). Ahora **filtran**. La prioridad no alcanzaba: mezclada
con 1174 opciones de cualquier rubro, la sugerencia pasa a ser una lista que
hay que descartar a mano.

Lo resuelve `searchServices` (`src/data/services.ts`) con el parámetro
`preferSpecialties`: vacío es el modo 2, con contenido el modo 1.

### Los servicios son texto libre

Las sugerencias son **sólo eso**: sugerencias. Un servicio se agrega
escribiéndolo aunque no figure en el catálogo (`allowCustom` en el
`SearchSelect`), y lo que se guarda en el perfil es el texto confirmado, no
una referencia al catálogo — que puede cambiar sin arrastrar los perfiles
(TR-022).

Lo que el filtrado acota es lo que se *sugiere*, nunca lo que se puede cargar.

Cada servicio cuelga de una especialidad, porque la base lo exige con una FK
compuesta (BR-010): si vino del catálogo, de la suya; si se escribió a mano,
de la primera especialidad del perfil, que es la que la persona declaró como
actividad principal.

### Recorte al bajar de plan

Al bajar de plan se quitan los **últimos servicios agregados** hasta entrar en
el tope. Siempre los últimos primero.

`services` está en orden de agregado —se acumula con `[...services, nuevo]`—
así que el recorte es `slice(0, max)`: conserva el principio y corta el final.

Como el servicio es texto libre, no hay ninguna otra jerarquía por la cual
ordenarlos: el orden de carga es la única señal de cuáles importan más, y lo
primero que alguien escribe es lo que más hace. Un servicio escrito a mano no
se trata distinto de uno del catálogo.

Antes de ese corte se van los servicios cuya especialidad ya no está (BR-010),
que se pierden con ella y no cuentan como decisión aparte. El orden completo
del recorte está en la regla 4 de "Rubro y Especialidades".

# General Rules

1. En el step#4 Ubicación, si el proveedor no selecciona "A domicilio" entonces no se muestra "Zonas donde trabajás": no va a ninguna zona, atiende en su local o a distancia.

2. El correo de contacto se precarga con el correo entrado en el formulario de registro. Queda editable: puede ser distinto del de acceso.

3. **Camino 1.** Bajar de plan durante la primera creación pregunta antes de
   aplicar el cambio, y borra lo que no entra sólo si se acepta. Vale para
   cualquier dato del formulario que dependa del plan —especialidades,
   servicios, ubicaciones, redes—, no sólo para el paso de rubro.

4. El servidor aplica el mismo recorte por su cuenta sobre lo que llega, en la
   primera creación. Que la UI recorte no es una restricción, sólo una ayuda:
   el envío se puede armar a mano (TR-004).

   Con perfil ya creado el servidor **no** recorta: corre el camino 2.

5. El texto del diálogo de planes cambia según el camino, porque bajar de plan
   no significa lo mismo en los dos. Sin perfil avisa que lo que no entre se
   quita; con perfil, que se sigue con el plan actual hasta que venza y
   después lo que no entre deja de mostrarse. Un texto único le mentiría a uno
   de los dos.
