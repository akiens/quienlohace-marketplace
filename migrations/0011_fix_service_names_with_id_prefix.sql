-- ---------------------------------------------------------------------------
-- Servicios guardados con el id de la especialidad pegado al nombre
-- ---------------------------------------------------------------------------

/*
 * Un servicio elegido del catálogo se guardó como
 * "hogar-y-mantenimiento-plomeria-y-sanitaria|Destape de cañerías" en vez de
 * "Destape de cañerías".
 *
 * El formulario identifica cada servicio elegido con una clave interna,
 * `especialidad|nombre`, porque el mismo texto puede existir en dos
 * especialidades del perfil y son dos servicios distintos. Esa clave viajaba
 * en el envío como si fuera el nombre, y así quedaba en la base. El origen ya
 * está corregido —ahora se manda la etiqueta—, pero lo escrito antes sigue
 * mal y hay que arreglarlo acá.
 *
 * Se corrige sólo lo que es exactamente ese defecto: el nombre empieza con el
 * `specialty_id` de su propia fila seguido de "|". Un nombre que casualmente
 * contenga "|" en otro lado no se toca, y uno con el prefijo de otra
 * especialidad tampoco: no habría forma de distinguirlo de un nombre legítimo.
 *
 * La comparación va con `substr` y no con `LIKE specialty_id || '|%'`: SQLite
 * rechaza un patrón que sale de una columna con "LIKE or GLOB pattern too
 * complex", así que esa forma —la evidente— falla al aplicarse.
 *
 * SQLite indexa desde 1: `substr(name, 1, length(specialty_id) + 1)` toma el
 * id más la barra, y `substr(name, length(specialty_id) + 2)` es lo que sigue.
 */

UPDATE services
   SET name = substr(name, length(specialty_id) + 2),
       updated_at = '2026-09-06T00:00:00.000Z'
 WHERE substr(name, 1, length(specialty_id) + 1) = specialty_id || '|'
   -- Nunca dejar un nombre vacío: si no queda nada después de la barra, la
   -- fila no es el defecto que se está arreglando.
   AND length(name) > length(specialty_id) + 1;
