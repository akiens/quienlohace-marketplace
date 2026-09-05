# Reglas técnicas

Este documento define **cómo implementar y validar** las reglas de negocio de QuienLoHace. No reemplaza a [`business_rules.md`](business_rules.md): cuando una decisión técnica afecte el comportamiento visible, prevalece la regla de negocio.

## 1. Fuentes de verdad

- `business_rules.md`: comportamiento funcional y criterios de aceptación.
- Este documento: implementación, validación, seguridad, generación, migraciones y pruebas.
- `databases_and_relationships.md`: esquema físico, constraints, relaciones e índices que aplican reglas `BR/TR`.
- `planes.md`: presentación comercial derivada de BR-006 a BR-009.
- `locations.md`: datos geográficos canónicos consumidos según TR-032 y TR-033.
- `rubros_especialidades_servicios.md`: datos canónicos de taxonomía consumidos según TR-020 a TR-022.
- `sugerencias_horarios.md`: strings canónicos consumidos según TR-024.
- Los JSON generados son artefactos derivados y nunca se editan como segunda fuente de verdad.

### Política contra la redundancia

- Una regla técnica completa se redacta una sola vez aquí y recibe un identificador `TR-*`.
- El modelo de datos puede expresar el constraint que la materializa, pero remite al identificador en lugar de repetir su explicación.
- Los documentos de datos conservan contenido, estructura y notas editoriales; sus generadores y validaciones se definen aquí.
- Las reglas funcionales no se reinterpretan en este documento: se referencian por `BR-*`.

Si dos fuentes se contradicen en el futuro, el cambio se detiene hasta establecer y aplicar una única decisión en todos los documentos afectados.

---

## 2. Persistencia

### TR-001 — Nombres y códigos

- Tablas y columnas usan `snake_case` en inglés.
- Estados y enumeraciones se persisten como códigos estables en inglés; sus etiquetas en español pertenecen a la UI.
- En UI se usan rubro, especialidad y servicio; en persistencia, `service_sector`, `specialty` y `service`.
- No se persisten valores derivados como modalidad híbrida, rubros del perfil, promedio o insignia visible.

### TR-002 — Tipos

- IDs transaccionales: UUID v4.
- Fechas: ISO 8601 en UTC.
- Booleanos SQLite: `INTEGER NOT NULL CHECK IN (0, 1)`.
- Importes: enteros en centésimos, nunca punto flotante.
- Moneda: código ISO 4217; inicialmente `UYU`.
- Límite `NULL`: sin límite comercial. Límite `0`: capacidad no incluida.

### TR-003 — Integridad referencial

- Toda conexión SQLite activa `PRAGMA foreign_keys = ON`.
- `PK`, `FK`, `UNIQUE`, `NOT NULL` y `CHECK` se aplican en base cuando la regla es local.
- Reglas entre tablas se validan en la aplicación y usan transacción si modifican varios registros.
- `RESTRICT`, `CASCADE` y `SET NULL` se eligen de forma explícita después de revisar su efecto funcional.

---

## 3. Validación por capas

### TR-004 — Entrada y autorización

- Toda entrada se valida en servidor aunque exista validación en UI.
- Los comandos sensibles rechazan o eliminan campos desconocidos mediante esquema explícito.
- Se autentica y autoriza antes de leer o mutar el recurso.
- Los errores identifican la regla incumplida sin revelar credenciales, hashes ni cuentas ajenas.

### TR-005 — Texto libre

- Se recortan extremos y se normalizan espacios repetidos cuando no sean significativos.
- Se guarda como texto, se escapa al renderizar y nunca se interpreta como HTML.
- Servicios: 3–80 caracteres.
- Horarios: 3–120 caracteres; máximo 10.
- Horarios rechazan teléfonos, correos, URLs y etiquetas HTML.
- Servicios duplicados se comparan sin distinguir mayúsculas dentro de perfil y especialidad.
- Frontend, API y base aplican el mismo criterio de longitud para Unicode.

### TR-006 — Reglas derivadas

Antes de activar un perfil, un servicio de dominio evalúa en una operación todos los requisitos de BR-003; nunca confía en flags enviados por el cliente.

Los cupos cuentan registros activos:

- Rubros: rubros distintos de especialidades activas.
- Especialidades: relaciones activas del perfil.
- Servicios: total de servicios activos del perfil.
- Ubicaciones: sucursales activas.
- Galería: imágenes activas de tipo galería.

---

## 4. Identidad, autenticación y sesiones

### TR-007 — Proveedores y administradores

- El correo de acceso se guarda en minúsculas y es único sin distinguir mayúsculas.
- Hashes nuevos: PBKDF2-HMAC-SHA256, al menos 600 000 iteraciones, salt aleatorio y formato versionado `algoritmo:costo:salt:hash`.
- Un hash conserva parámetros; tras un login válido puede rehacerse con parámetros actuales.
- Nunca se registra ni devuelve contraseña, salt, hash o token.

### TR-008 — Clientes con Google

- La identidad es `(auth_provider, auth_provider_user_id)` y usa el `sub` verificado.
- El correo no identifica externamente al cliente.
- Nombre, correo y avatar se sincronizan desde el token validado, no desde campos arbitrarios.
- Se validan firma, emisor, audiencia, expiración y nonce/estado cuando aplique.

### TR-009 — Sesiones

- El token usa entropía criptográfica y cookie `HttpOnly`, `Secure` y `SameSite` apropiado.
- Solo se persiste SHA-256 del token.
- Duración predeterminada: 30 días para gestión y 90 para clientes.
- Se rechazan sesiones vencidas o de cuentas inactivas/suspendidas; se pueden revocar todas las sesiones.
- Mutaciones basadas en cookies usan protección CSRF cuando corresponda.

### TR-010 — Verificaciones separadas

- `email_verified` acredita únicamente el correo de acceso.
- Publicar mediante teléfono exige persistir y auditar verificación telefónica; `phone_e164` no demuestra control.
- Hasta incorporar ese estado, BR-018 solo puede satisfacerse mediante correo verificado.
- La verificación comercial del perfil y las habilitaciones profesionales mantienen estados independientes y nunca se derivan del contacto ni entre sí.

---

## 5. Estados

### TR-011 — Perfil

Estados: `draft`, `active`, `suspended`, `inactive`.

- `draft → active`: validación completa.
- `active → inactive`: retira visibilidad sin borrar.
- Cualquier estado permitido `→ suspended`: solo moderación autorizada.
- `suspended → active`: decisión de moderación y nueva validación.
- Solo `active` participa en endpoints y páginas públicas.

### TR-012 — Suscripción

Estados: `trial`, `active`, `past_due`, `cancelled`, `expired`.

- Cobre tiene vencimiento nulo.
- `trial` y `cancelled` requieren vencimiento.
- `cancelled` conserva capacidades hasta vencer.
- Una baja programada apunta a un `rank` menor.
- Procesar vencimientos debe ser idempotente y serializar cambios concurrentes del perfil.

### TR-013 — Verificación del perfil y habilitaciones

Estados: `not_requested`, `pending`, `verified`, `rejected`.

- Estos estados corresponden a la verificación comercial del perfil. Solo `verified` produce insignia y una solicitud exige que el plan activo la permita.
- Las habilitaciones profesionales se registran por perfil y especialidad regulada con estados `pending`, `verified`, `rejected`, `revoked` o `expired`.
- Solo una habilitación `verified` y no vencida autoriza a mostrar servicios regulados de esa especialidad.
- Validar una habilitación está disponible para cualquier plan y no modifica `verification_status`.
- Una tarea idempotente marca como `expired` las habilitaciones vencidas y retira de la vista pública los servicios regulados afectados.

---

## 6. Planes, cupos y bajas

### TR-014 — Configuración

- Existen `cobre`, `gold` y `platinum`, con rangos únicos 1, 2 y 3.
- Límites y flags se leen de persistencia, no de condicionales dispersos.
- Una caché se invalida cuando cambia la configuración.
- Oro y Platino no se ofrecen mientras el precio sea cero o indefinido.

### TR-015 — Concurrencia

- Comprobar un cupo y crear/activar el elemento ocurre en la misma transacción lógica.
- Dos solicitudes concurrentes no pueden superar el límite.
- El error devuelve capacidad, límite y uso activo para que la UI lo explique.

### TR-016 — Downgrade

Para cada capacidad excedida:

1. Ordenar por `sort_order` ascendente.
2. Empatar por `created_at` y luego `id`, ambos ascendentes.
3. Conservar activos los primeros que caben.
4. Desactivar el resto en la misma transacción.
5. Desactivar servicios de especialidades desactivadas.
6. Quitar `is_primary` si se desactiva la ubicación principal.
7. Registrar el inicio del período de conservación de 180 días.

La purga comprueba de nuevo que el dato continúa excedente. Una mejora o reactivación cancela su purga.

---

## 7. Geografía y cobertura

### TR-017 — Estructura

- `uruguay` es el único `country` y el único nodo sin padre.
- Departamentos dependen de Uruguay; localidades, de un departamento.
- Los IDs son estables; cambiar el nombre visible no cambia el ID.
- Solo se seleccionan registros activos.
- Una ubicación física admite `department` o `locality`, no `country`.

### TR-018 — Normalización de áreas

- Insertar `uruguay` elimina las demás áreas.
- Insertar un departamento elimina sus localidades elegidas.
- Insertar una localidad se rechaza o ignora si su departamento ya está seleccionado.
- Después de normalizar, un perfil activo conserva al menos un área.

### TR-019 — Búsqueda

- Por localidad: `uruguay` OR departamento padre OR localidad exacta.
- Por departamento: `uruguay` OR departamento exacto OR localidad descendiente.
- Siempre se filtran perfiles activos.

---

## 8. Taxonomía y servicios

### TR-020 — IDs

- `slugify`: NFD, sin diacríticos, minúsculas y secuencias fuera de `a-z0-9` convertidas en guiones.
- Rubro: `slugify(nombre corto)`.
- Especialidad: `<id-rubro>-<slugify(nombre)>`.
- Sugerencia: `<id-especialidad>-<slugify(nombre-canónico)>`.
- IDs publicados no se renombran sin migración y redirecciones cuando correspondan.

### TR-021 — Generador de servicios

- Lee el identificador declarado en cada bloque; no mantiene una tabla `MAPPING` paralela.
- Cada línea produce nombre y aliases, y referencia exactamente una especialidad.
- Falla ante IDs duplicados, especialidades inexistentes, nombres vacíos o duplicados normalizados.
- El catálogo administrativo marca con `requires_professional_credential` las especialidades de salud, contabilidad, legal y seguros que requieren habilitación.
- Antes de reemplazar el JSON se verifica que movimientos o eliminaciones no dejen relaciones inválidas.

El resultado esperado es un array de objetos con este contrato:

```json
[
  {
    "id": "hogar-y-mantenimiento-electricidad-puesta-a-tierra",
    "serviceSectorId": "hogar-y-mantenimiento",
    "specialtyId": "hogar-y-mantenimiento-electricidad",
    "name": "Puesta a tierra",
    "aliases": ["descarga a tierra", "jabalina", "aterramiento"]
  }
]
```

### TR-022 — Autocompletado

- Indexa nombre, aliases, especialidad y rubro.
- Normaliza minúsculas, diacríticos y espacios.
- Relevancia: nombre exacto, prefijo de nombre, alias exacto, palabra de nombre, prefijo de alias, nombre parcial, alias parcial, especialidad y rubro.
- La selección se guarda como texto del perfil, no como FK a una sugerencia mutable.

---

## 9. Horarios

### TR-023 — Persistencia

- Admitir `sort_order` de 0 a 9 e índice único `(profile_id, sort_order)`.
- Las instalaciones que todavía usen el esquema anterior deben migrar de 0–6 y 1–100 a 0–9 y 3–120 antes de implementar BR-024.
- Reordenar mediante lote transaccional o posiciones temporales que no violen unicidad.

### TR-024 — Generador y búsqueda

- Solo las viñetas de secciones de sugerencias generan strings.
- Se toma el texto anterior a `— alias:`; encabezados y aliases no entran al JSON.
- El resultado es `string[]`, conserva el orden y no incluye IDs, grupos u objetos.
- Falla ante duplicados normalizados.
- La búsqueda prioriza exacta, inicio y parcial.
- La UI muestra inicialmente 6–8 resultados, permite texto libre y edición antes de confirmar.

El resultado esperado es un `string[]` sin IDs, grupos ni aliases:

```json
[
  "Lunes a viernes de 08:00 a 17:00",
  "Domingos: cerrado",
  "Atención solo con agenda previa"
]
```

---

## 10. Imágenes y enlaces

### TR-025 — Imágenes

- El binario se guarda fuera de la base; esta conserva una clave única.
- Patrón: `profiles/<userId>/<kind>-<uuid>.<ext>`, sin rutas aportadas por el usuario.
- Validar tipo real, extensión, tamaño, dimensiones y límites de procesamiento.
- Avatar y portada son únicos por propietario durante el alta y por perfil al asociarse.
- Asociar una imagen exige que su propietario coincida con el del perfil.
- Una tarea idempotente elimina subidas huérfanas después de un plazo configurado.

### TR-026 — URLs externas

- Exigir URL absoluta y esquema permitido; preferir `https`.
- Bloquear esquemas ejecutables, credenciales embebidas y URLs no analizables.
- Los enlaces públicos previenen reverse tabnabbing y no transfieren privilegios.

---

## 11. Opiniones y moderación

### TR-027 — Agregados

- `rating_sum` y `review_count` incluyen solo opiniones `published`.
- Crear, editar, ocultar, republicar o eliminar actualiza opinión y agregados en una transacción.
- Con cero opiniones: suma 0, conteo 0 y promedio `NULL`.
- Con opiniones: `review_count ≤ rating_sum ≤ review_count × 5`.
- Existe una operación administrativa para recalcular agregados.

### TR-028 — Unicidad y autoría

- Un índice parcial único impide más de una opinión por perfil y cliente.
- Opiniones importadas sin cliente requieren flujo administrativo y no se crean desde API pública.
- Al mostrar una opinión enlazada prevalece el nombre actual; se conserva la copia histórica.

### TR-029 — Reportes

- Al crearlo existe exactamente un autor: cliente o usuario de gestión.
- Eliminar después al autor puede dejar ambas referencias nulas sin perder historial.
- Un reporte abierto no tiene fecha ni administrador de resolución.
- Resolver guarda estado y fecha.
- Crear un reporte no cambia la opinión ni sus agregados.

---

## 12. Transacciones e idempotencia

### TR-030 — Operaciones atómicas

Se ejecutan en una transacción:

- publicación/reactivación y validación final;
- consumo de cupos;
- cambio de plan y desactivación de excedentes;
- normalización de áreas;
- desactivación de especialidad y servicios;
- cambio de opinión y agregados;
- resolución que también cambie la opinión.

### TR-031 — Reintentos

- Webhooks, tareas, purgas, vencimientos y migraciones son idempotentes.
- Efectos externos usan clave de idempotencia o identificador único.
- Tras un fallo parcial se reconcilia el estado antes de reintentar.

---

## 13. Índices críticos

Mantener índices para identidades y correos únicos; slug de perfil; relaciones muchos a muchos; perfiles por estado y plan; áreas por ubicación; especialidades por rubro/slug; servicios por perfil/especialidad/nombre; imágenes por perfil/orden y clave; horarios por perfil/orden; opiniones por perfil/estado/fecha; reportes por opinión/estado; sesiones por vencimiento; y planes por rango.

Cada índice nuevo debe justificar una consulta. Un índice único que materializa una regla tiene prioridad sobre validarla solo en la aplicación.

---

## 14. Generadores geográficos

### TR-032 — Parsing

- Crear raíz `uruguay`.
- Cada encabezado de departamento genera un hijo `department`.
- Cada viñeta sin indentación genera una `locality` del departamento vigente.
- Encabezados secundarios y prosa se ignoran.
- Una viñeta indentada es error: no existe cuarto nivel.
- El paréntesis se conserva visible y se excluye del slug cuando `locations.md` así lo indica.
- ID del país: `uruguay`.
- ID de departamento: `slugify(nombre)`.
- ID de localidad: `<id-departamento>-<slugify(nombre)>`.
- `slugify` usa la misma normalización definida en TR-020.

El contrato generado es una colección jerárquica con nombres de propiedades en
`camelCase` para el JSON y su mapeo equivalente en `snake_case` al persistir:

```json
{
  "locations": [
    {
      "id": "uruguay",
      "parentId": null,
      "type": "country",
      "name": "Uruguay",
      "slug": "uruguay"
    },
    {
      "id": "canelones-ciudad-de-la-costa",
      "parentId": "canelones",
      "type": "locality",
      "name": "Ciudad de la Costa",
      "slug": "ciudad-de-la-costa"
    }
  ]
}
```

### TR-033 — Validaciones

El generador falla si no existen: raíz y país únicos; exactamente 19 departamentos; IDs únicos; localidad única dentro del departamento; padres válidos; slugs no vacíos; conteos coincidentes; y ausencia de cuarto nivel.

Agregar una localidad es compatible. Renombrar o eliminar exige migración de referencias y redirecciones cuando correspondan.

---

## 15. Migraciones

### TR-034 — Cambios seguros

- Toda migración es versionada, revisable e idempotente.
- Antes de cambiar IDs, slugs, jerarquías o relaciones se mide el impacto.
- No se elimina una estructura referenciada en el mismo despliegue que introduce su reemplazo sin fase compatible.
- Se validan conteos, huérfanos y muestras deterministas antes y después.

### TR-035 — Migraciones requeridas por el consenso documental

1. Cambiar horarios a texto de 3–120 caracteres.
2. Cambiar su orden a 0–9 y admitir 10 filas.
3. Incorporar `phone_verified_at` y reiniciarlo cuando cambie el teléfono normalizado.
4. Crear la persistencia de habilitaciones profesionales definida en el modelo de datos.
5. Si ya existen UUID para rubros o especialidades, migrarlos a los IDs estables del catálogo sin dejar relaciones huérfanas.

---

## 16. Seguridad, privacidad y observabilidad

### TR-036 — Seguridad

- Control de acceso por propietario y rol en cada operación protegida.
- Rate limits y límites de tamaño en login, verificación, opiniones, reportes, contacto, búsquedas y archivos.
- Consultas parametrizadas; nunca concatenar entrada en SQL.
- Secretos fuera del repositorio y rotables sin cambiar código.
- Evitar enumeración de cuentas.
- Revisar periódicamente algoritmos, costos criptográficos y dependencias.

### TR-037 — Privacidad

- La API pública expone solo campos autorizados del perfil activo.
- Correos de acceso, IDs externos, estados internos, evidencias y sesiones nunca forman parte del perfil público.
- Logs no contienen tokens, contraseñas, hashes ni datos personales completos innecesarios.
- Eliminación y anonimización respetan el historial de opiniones y moderación.

### TR-038 — Auditoría

- Registrar acciones administrativas, suspensiones, verificaciones, reportes resueltos, cambios de plan y purgas con actor, fecha, objetivo y resultado.
- Monitorear fallos de login, abuso, agregados inconsistentes, tareas vencidas y generadores fallidos.
- Los logs técnicos no sustituyen el historial de auditoría.

---

## 17. Pruebas mínimas

- Unitarias por regla y transición.
- Integración para constraints, cascadas, índices y transacciones.
- Concurrencia para cupos, opiniones únicas y reordenamientos.
- Contratos frontend–API para códigos, longitudes y errores.
- Generación reproducible de ubicaciones, servicios y horarios.
- Autorización entre propietario, cliente, admin y superadmin.
- Downgrade y upgrade sin pérdida.
- Búsqueda geográfica por país, departamento y localidad.
- Recalcular calificaciones al crear, editar, ocultar y republicar.

Una regla nueva no se considera implementada hasta tener un caso válido, uno inválido y, cuando corresponda, uno de frontera.
