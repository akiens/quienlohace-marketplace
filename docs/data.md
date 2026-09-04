# Data Master
En este fichero vamos a tener cada una de las tablas, propiedades y su tipo, asi como las relaciones que existen entre las tamblas. La idea de este fichero es que sea la fuente de la verdad contra la cual vamos  validar si nuestra base de datos esta 100% alineada.

---

## 0. Alcance y método

Este documento describe el esquema **verificado contra la D1 local** de
`quienlohace-marketplace`, no contra las migraciones sueltas. Se construyó
leyendo el DDL real (`sqlite_master`) de la base Miniflare, contrastándolo con
las 7 migraciones aplicadas y con el código que la consume
(`src/infrastructure/`, `src/domain/`, `src/types/`).

| Dato | Valor |
| --- | --- |
| Motor | Cloudflare D1 (SQLite) |
| Binding | `env.DB` |
| `database_name` | `quienlohace` |
| `database_id` | `be93c0ea-e93a-45a8-95cb-08ff9933ed28` |
| Bucket de binarios | `env.MEDIA` → `quienlohace-media` (R2) |
| Migraciones aplicadas | 7 (`0001` … `0007`) |
| Tablas de negocio | 16 (+ `d1_migrations`, interna de Wrangler) |
| `PRAGMA foreign_keys` | `1` (activo) |

### Convenciones transversales

Estas reglas aplican a **todas** las tablas y no se repiten en cada ficha:

- **Fechas** → `TEXT` en ISO 8601 UTC (`2026-09-01T00:00:00.000Z`). SQLite no
  tiene tipo fecha nativo. Se generan siempre con `new Date().toISOString()`.
- **Booleanos** → `INTEGER` restringido a `0`/`1` por `CHECK`. No existe
  `BOOLEAN` en SQLite.
- **Identificadores** → `TEXT`. Los ids generados por la app son UUID v4
  (`crypto.randomUUID()`, en `src/lib/id.ts`). Los ids de master data
  (categorías, ubicaciones, planes) son *slugs* legibles y estables.
- **Dinero** → `INTEGER` en centavos. Nunca punto flotante.
- **Enumerados** → `TEXT` + `CHECK (col IN (…))`. El `CHECK` es la fuente de
  verdad del dominio permitido.
- **Borrado** → en cascada desde el padre (`ON DELETE CASCADE`) para lo que es
  parte del perfil; `ON DELETE SET NULL` para autorías, que deben sobrevivir a
  la baja de quien las escribió.

### Lo que NO vive en la base

Es tan importante como lo que sí, porque explica por qué hay columnas con
`_id` que no tienen `FOREIGN KEY`:

| Master data | Dónde vive | IDs de ejemplo |
| --- | --- | --- |
| Geografía (país / departamento / localidad / barrio) | `src/data/locations.ts` | `uruguay`, `montevideo`, `montevideo-montevideo`, `montevideo-montevideo-pocitos` |
| Categorías y subcategorías | `src/data/categories.ts` (20 categorías) | `hogar-y-mantenimiento`, `hogar-y-mantenimiento-plomeria-y-sanitaria` |

`providers.location_id`, `providers.category_id`, `providers.subcategory_id`,
`provider_service_areas.location_id` y `provider_subcategories.subcategory_id`
son referencias **lógicas** a ese master data. La base no puede validarlas:
la integridad depende de que el código sólo escriba ids existentes.

---

## 1. Mapa de relaciones

```
users ──1:1── providers ──1:N── provider_services
  │              │        ──1:N── provider_service_areas
  │              │        ──1:N── provider_subcategories
  │              │        ──1:N── provider_payment_methods
  │              │        ──1:N── provider_social_links
  │              │        ──1:N── provider_team_members
  │              │        ──1:N── provider_hours
  │              │        ──1:N── provider_images ──(binario)──> R2
  │              │        ──1:N── reviews
  │              └──N:1── plans
  ├──1:N── sessions
  └──1:N── provider_images (owner_user_id)

consumer_users ──1:N── consumer_sessions
       └───────────1:N── reviews ──1:N── review_reports
```

Cardinalidades exactas y su porqué:

| Relación | Cardinalidad | Impuesta por |
| --- | --- | --- |
| `users` → `providers` | **1:0..1** | `UNIQUE INDEX idx_providers_user (user_id)` — un usuario administra un solo perfil en el MVP |
| `providers` → hijas de perfil | 1:N | FK + `ON DELETE CASCADE` |
| `plans` → `providers` | 1:N | **lógica**, vía `CHECK`, no `FOREIGN KEY` (ver §4.1) |
| `consumer_users` → `reviews` | 1:N, máx. 1 por proveedor | `UNIQUE INDEX idx_reviews_consumer_provider` (parcial) |
| `users` → `provider_images` | 1:N | FK `owner_user_id`, permite subir antes de que exista el perfil |

---

## 2. Identidad y acceso

### 2.1 `users` — cuentas que administran perfiles

**Propósito.** La cuenta de quien ofrece un servicio, más las cuentas de
administración de la plataforma. **No** incluye a los clientes que buscan y
opinan: ésos viven en `consumer_users` (§5.1), porque no comparten ciclo de
vida ni permisos.

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `email` | TEXT | no | — | Normalizado a minúsculas antes de escribir. **Único** por `idx_users_email` |
| `password_hash` | TEXT | **sí** | — | Formato `pbkdf2:<iteraciones>:<salt>:<hash>` — PBKDF2-SHA256, 100 000 iteraciones. `NULL` cuando la cuenta es sólo OAuth |
| `name` | TEXT | no | — | Nombre de la persona, no del negocio |
| `role` | TEXT | no | `'provider'` | `CHECK IN ('provider','admin','superadmin')` |
| `email_verified` | INTEGER | no | `0` | Booleano `0/1` |
| `created_at` | TEXT | no | — | ISO 8601 |
| `updated_at` | TEXT | no | — | ISO 8601 |

**Índices:** `idx_users_email` UNIQUE (`email`).

> El hash lleva sus propios parámetros embebidos, así que subir las
> iteraciones no invalida las contraseñas ya guardadas.

### 2.2 `sessions` — sesiones de proveedores y admins

**Propósito.** Sostener la sesión de un `users`. **El `id` es el SHA-256 del
token de la cookie, nunca el token en claro**: si se filtra la base, las
cookies no son reutilizables.

| Campo | Tipo | Nulo | Reglas y notas |
| --- | --- | --- | --- |
| `id` | TEXT | no | **PK**. SHA-256 hex del token de sesión |
| `user_id` | TEXT | no | **FK** → `users.id` `ON DELETE CASCADE` |
| `expires_at` | TEXT | no | ISO. TTL de **30 días** |
| `created_at` | TEXT | no | ISO |

**Índices:** `idx_sessions_user` (`user_id`), `idx_sessions_expires`
(`expires_at`, para la purga de vencidas).

---

## 3. El perfil profesional

### 3.1 `providers` — perfil público del profesional

**Propósito.** La entidad central del marketplace: el perfil que se lista, se
busca y se muestra. Concentra identidad pública, taxonomía, ubicación,
contacto, estado de publicación, plan contratado y la calificación agregada.

Tiene 34 columnas porque acumula siete migraciones. Se agrupan por función:

#### Identidad y pertenencia

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `user_id` | TEXT | no | — | **FK** → `users.id` `ON DELETE CASCADE`. **Único**: un perfil por usuario |
| `slug` | TEXT | no | — | **Único**. URL pública `/profesionales/<slug>`. Se deriva del nombre y se desambigua con sufijo `-2`, `-3`… |
| `name` | TEXT | no | — | Nombre público (persona o negocio) |
| `kind` | TEXT | no | `'individual'` | `CHECK IN ('individual','business')` |
| `description` | TEXT | no | `''` | Descripción larga del perfil |
| `icon` | TEXT | no | `'work'` | Nombre de Material Symbols |

#### Taxonomía y ubicación *(referencias lógicas al master data)*

| Campo | Tipo | Nulo | Reglas y notas |
| --- | --- | --- | --- |
| `category_id` | TEXT | no | Id de `src/data/categories.ts`. **Sin FK** |
| `subcategory_id` | TEXT | no | Subcategoría **principal**. Las adicionales van en `provider_subcategories` |
| `location_id` | TEXT | no | **Dónde está** el proveedor. Distinto de dónde trabaja (`provider_service_areas`) |

#### Contacto

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `phone` | TEXT | no | `''` | Teléfono tal como lo escribió la persona |
| `phone_e164` | TEXT | no | `''` | Normalizado E.164. De acá salen `tel:` y `wa.me` |
| `whatsapp` | TEXT | no | `''` | Heredado de `0001`. Reemplazado en la práctica por `whatsapp_enabled` + `phone_e164` |
| `whatsapp_enabled` | INTEGER | no | `0` | Booleano: si el mismo número atiende WhatsApp |
| `phone_public` | INTEGER | no | `1` | Booleano: si el teléfono se muestra públicamente |
| `public_email` | TEXT | no | `''` | Email de contacto público, distinto del de la cuenta |
| `schedule` | TEXT | no | `''` | Horario como texto libre. `provider_hours` es la versión estructurada |
| `service_mode` | TEXT | no | `'on_site'` | `CHECK IN ('on_site','at_business','remote','hybrid')` |

#### Estado, confianza y destaque

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `status` | TEXT | no | `'draft'` | `CHECK IN ('draft','active','pending_verification','suspended','inactive')`. **Sólo `'active'` es visible al público** |
| `featured` | INTEGER | no | `0` | Booleano. Primer criterio de orden en los listados |
| `verified` | INTEGER | no | `0` | Booleano. Insignia de verificado |
| `verification_status` | TEXT | no | `'unverified'` | `CHECK IN ('unverified','pending','verified','rejected')`. El *trámite*; `verified` es el resultado mostrado |

#### Plan y suscripción

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `plan_id` | TEXT | no | `'cobre'` | `CHECK IN ('cobre','gold','platinum')`. Referencia **lógica** a `plans.id` |
| `subscription_status` | TEXT | no | `'active'` | `CHECK IN ('trial','active','past_due','cancelled','expired')`. `past_due` = plan activo pero cobro sin resolver |
| `plan_expires_at` | TEXT | **sí** | — | Fin del período pago. `NULL` en Cobre, que no vence |
| `downgrade_plan_id` | TEXT | **sí** | — | `CHECK IS NULL OR IN (…)`. Plan al que se baja **al vencer**. `NULL` = sin baja agendada |
| `purge_excess_after` | TEXT | **sí** | — | Desde cuándo se puede borrar lo que quedó fuera del plan (180 días) |
| `pending_plan_id` | TEXT | **sí** | — | ⚠️ **Obsoleta.** Reemplazada por `downgrade_plan_id` en `0007`, que la vació. Sin referencias en el código |

#### Calificación desnormalizada

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `rating_sum` | INTEGER | no | `0` | Suma de estrellas de las opiniones **publicadas** |
| `review_count` | INTEGER | no | `0` | Cantidad de opiniones publicadas |

> El promedio es `rating_sum / review_count`, o `null` si `review_count = 0`.
> Se mantiene desnormalizado para no hacer un `AVG` por cada card del listado,
> y se actualiza **en el mismo `batch()`** que inserta, edita o borra la
> opinión, de modo que no puede quedar desincronizado.

#### Media heredada

| Campo | Tipo | Nulo | Default | Reglas y notas |
| --- | --- | --- | --- | --- |
| `logo_key` | TEXT | no | `''` | ⚠️ **Obsoleta.** Superada por `provider_images.kind='avatar'`. Sin referencias en el código |
| `cover_key` | TEXT | no | `''` | ⚠️ **Obsoleta.** Superada por `provider_images.kind='cover'`. Sin referencias en el código |

#### Auditoría

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `created_at` | TEXT | no | ISO |
| `updated_at` | TEXT | no | ISO. Lo toca cualquier escritura sobre la fila |

**Índices**

| Índice | Columnas | Para qué |
| --- | --- | --- |
| `idx_providers_slug` UNIQUE | `slug` | Resolver `/profesionales/<slug>` |
| `idx_providers_user` UNIQUE | `user_id` | Impone 1 perfil por usuario |
| `idx_providers_category` | `category_id, status` | Listado por categoría |
| `idx_providers_subcategory` | `subcategory_id, status` | Listado por subcategoría |
| `idx_providers_location` | `location_id, status` | Filtro geográfico |
| `idx_providers_ranking` | `status, featured DESC, review_count DESC` | Orden por defecto |
| `idx_providers_plan` | `plan_id, status` | Cortes por plan |
| `idx_providers_downgrade` (parcial) | `downgrade_plan_id, plan_expires_at` WHERE not null | Encontrar bajas vencidas |
| `idx_providers_pending_plan` (parcial) | `pending_plan_id, plan_expires_at` WHERE not null | ⚠️ Obsoleto, junto con su columna |

### 3.2 `provider_services` — servicios que ofrece

**Propósito.** Lista de servicios en texto libre acotado por la UI. Alimenta
la búsqueda por término (`LIKE` sobre `name`).

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `provider_id` | TEXT | no | — | **PK compuesta**. FK → `providers.id` CASCADE |
| `name` | TEXT | no | — | **PK compuesta**: no se repite un servicio en el mismo perfil |
| `position` | INTEGER | no | `0` | Orden de presentación |
| `active` | INTEGER | no | `1` | `0` = excede el plan (ver §6) |

### 3.3 `provider_service_areas` — zonas donde trabaja

**Propósito.** Dónde **presta servicio**, que es distinto de dónde está
ubicado (`providers.location_id`). Un plomero de Pocitos puede cubrir todo
Montevideo.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `provider_id` | TEXT | no | — | **PK compuesta**. FK → `providers.id` CASCADE |
| `location_id` | TEXT | no | — | **PK compuesta**. Referencia lógica al master data |
| `active` | INTEGER | no | `1` | `0` = excede el plan |

**Índices:** `idx_service_areas_location` (`location_id`) — búsqueda inversa
«quién atiende en esta zona».

### 3.4 `provider_subcategories` — subcategorías adicionales

**Propósito.** Varias subcategorías según el plan. `providers.subcategory_id`
sigue siendo la **principal**, para no romper las búsquedas existentes.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `provider_id` | TEXT | no | — | **PK compuesta**. FK → `providers.id` CASCADE |
| `subcategory_id` | TEXT | no | — | **PK compuesta**. Referencia lógica |
| `position` | INTEGER | no | `0` | Orden |
| `active` | INTEGER | no | `1` | `0` = excede el plan |

**Índices:** `idx_provider_subcategories_sub` (`subcategory_id`).

### 3.5 `provider_payment_methods` — medios de pago aceptados

**Propósito.** Filtro de búsqueda y dato de la ficha.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `provider_id` | TEXT | no | **PK compuesta**. FK → `providers.id` CASCADE |
| `method` | TEXT | no | **PK compuesta**. `CHECK IN ('Efectivo','Transferencia','Débito','Crédito','Otros')` |

> Es la única tabla hija **sin** columna `active`: los medios de pago no
> dependen del plan.
>
> Los valores del `CHECK` están en español y **con tildes** — son etiquetas de
> UI usadas como clave.

### 3.6 `provider_social_links` — redes sociales

**Propósito.** Enlaces a redes. Es una capacidad de plan
(`plans.allows_social_links`): en Cobre se guardan pero quedan inactivos.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `provider_id` | TEXT | no | — | **PK compuesta**. FK → `providers.id` CASCADE |
| `platform` | TEXT | no | — | **PK compuesta**: una URL por plataforma. `CHECK IN ('instagram','facebook','linkedin','x','tiktok','youtube','website')` |
| `url` | TEXT | no | — | URL completa |
| `active` | INTEGER | no | `1` | Todo o nada según el plan |

### 3.7 `provider_team_members` — integrantes del equipo

**Propósito.** Presentar al equipo. Sólo Platino tiene cupo
(`plans.max_team_members`: Cobre 0, Oro 0, Platino 12).

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `provider_id` | TEXT | no | — | FK → `providers.id` CASCADE |
| `name` | TEXT | no | — | Nombre del integrante |
| `role` | TEXT | no | `''` | Cargo. En el formulario se muestra como «Título» |
| `subtitle` | TEXT | no | `''` | Subtítulo |
| `bio` | TEXT | no | `''` | Reseña breve |
| `photo_key` | TEXT | no | `''` | Clave en R2. Sin fila propia en `provider_images` |
| `position` | INTEGER | no | `0` | Orden |
| `active` | INTEGER | no | `1` | `0` = excede el plan |

**Índices:** `idx_provider_team_provider` (`provider_id, position`).

> Las filas se **reemplazan enteras** al guardar el perfil (`DELETE` + `INSERT`
> en un `batch()`), así que los `id` no son estables entre guardados.

### 3.8 `provider_hours` — horarios estructurados por día

**Propósito.** Reemplazo estructurado de `providers.schedule`, para poder
mostrar «abierto ahora» y filtrar por disponibilidad.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `provider_id` | TEXT | no | — | **PK compuesta**. FK → `providers.id` CASCADE |
| `weekday` | INTEGER | no | — | **PK compuesta**. `CHECK BETWEEN 0 AND 6`. **0 = domingo, 6 = sábado** (igual que `Date.getDay()`) |
| `opens_at` | TEXT | **sí** | — | `"HH:MM"` 24h. `NULL` si cierra o es 24 h |
| `closes_at` | TEXT | **sí** | — | Ídem |
| `closed` | INTEGER | no | `0` | Booleano: cerrado ese día |
| `open_24h` | INTEGER | no | `0` | Booleano: abierto 24 h |

> ⚠️ **Tabla creada pero todavía no usada.** El tipo `DayHours` existe en
> `src/types/index.ts`, pero **ninguna consulta la lee ni la escribe**, y en la
> base local tiene 0 filas. Hoy el horario real es `providers.schedule`.

### 3.9 `provider_images` — imágenes del perfil

**Propósito.** Referencia a los binarios que viven en R2. La tabla fue
**recreada** en `0005` para que una imagen pueda existir **antes** que el
perfil: durante el alta se piden foto y portada cuando todavía no hay fila en
`providers`.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `provider_id` | TEXT | **sí** | — | FK → `providers.id` CASCADE. **`NULL` mientras no se reclamó** |
| `owner_user_id` | TEXT | no | — | FK → `users.id` CASCADE. Quién subió el archivo; es lo que autoriza a borrarlo |
| `storage_key` | TEXT | no | — | Clave en R2: `providers/<userId>/<kind>-<uuid>.<ext>`. Se sirve por `/media/<key>` |
| `alt` | TEXT | no | `''` | Texto alternativo |
| `position` | INTEGER | no | `0` | Orden dentro de la galería |
| `kind` | TEXT | no | `'gallery'` | `CHECK IN ('avatar','cover','gallery')` |
| `active` | INTEGER | no | `1` | `0` = excede el cupo de galería del plan |
| `created_at` | TEXT | no | — | ISO |

**Índices**

| Índice | Columnas | Para qué |
| --- | --- | --- |
| `idx_provider_images_provider` | `provider_id, position` | Galería ordenada |
| `idx_provider_images_owner` | `owner_user_id, kind` | Reclamar imágenes del alta |
| `idx_provider_images_single` UNIQUE (parcial) | `provider_id, kind` WHERE `kind IN ('avatar','cover') AND provider_id IS NOT NULL` | Una foto y una portada por perfil |
| `idx_provider_images_single_owner` UNIQUE (parcial) | `owner_user_id, kind` WHERE `kind IN ('avatar','cover')` | Una foto y una portada por usuario, incluso sin perfil |

**Ciclo de vida.** Se escribe primero el objeto en R2 y después la fila en D1:
una fila que apunta a un objeto inexistente se ve como imagen rota, mientras
que un objeto sin fila no se ve en ningún lado. Al crear el perfil,
`claimImagesForProvider()` hace `UPDATE … SET provider_id = ? WHERE
owner_user_id = ? AND provider_id IS NULL`.

---

## 4. Planes comerciales

### 4.1 `plans` — catálogo de planes y sus límites

**Propósito.** Que precios, topes y capacidades se cambien **sin desplegar
código**. Es la fuente de verdad de qué puede hacer cada plan; el código sólo
lee de acá.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. `CHECK IN ('cobre','gold','platinum')` |
| `name` | TEXT | no | — | Nombre mostrado, en español |
| `price_cents` | INTEGER | no | `0` | Centavos |
| `currency` | TEXT | no | `'USD'` | |
| `period` | TEXT | no | `'month'` | `CHECK IN ('month','year')` |
| `rank` | INTEGER | no | — | Orden y nivel. **Mayor = más capacidades**; define qué es subir y qué es bajar |
| `max_services` | INTEGER | no | — | Tope de `provider_services` activos |
| `max_subcategories` | INTEGER | no | — | Tope de `provider_subcategories` activas |
| `max_service_areas` | INTEGER | no | — | Tope de `provider_service_areas` activas |
| `max_gallery_images` | INTEGER | no | — | Tope de `provider_images` con `kind='gallery'` activas |
| `max_team_members` | INTEGER | no | — | Tope de `provider_team_members` activos |
| `allows_social_links` | INTEGER | no | `0` | Booleano |
| `allows_landing` | INTEGER | no | `0` | Booleano |
| `allows_featured` | INTEGER | no | `0` | Booleano |
| `allows_contact_form` | INTEGER | no | `0` | Booleano |
| `allows_verification_request` | INTEGER | no | `0` | Booleano |
| `metrics_level` | TEXT | no | `'basic'` | `CHECK IN ('basic','intermediate','full')` |
| `created_at` / `updated_at` | TEXT | no | — | ISO |

**Contenido actual (verificado en la D1 local — 3 filas):**

| id | name | precio | rank | servicios | subcats | zonas | galería | equipo |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `cobre` | Cobre | US$ 0 /mes | 1 | 5 | 1 | 5 | 0 | 0 |
| `gold` | **Oro** | US$ 5 /mes | 2 | 15 | 4 | 15 | 5 | 0 |
| `platinum` | **Platino** | US$ 20 /mes | 3 | 30 | 8 | 30 | 20 | 12 |

| id | social | landing | featured | formulario | verificación | métricas |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| `cobre` | — | — | — | — | — | `basic` |
| `gold` | ✔ | — | — | — | ✔ | `intermediate` |
| `platinum` | ✔ | ✔ | ✔ | ✔ | ✔ | `full` |

> **Nota de nomenclatura.** Los `id` quedaron en inglés (`gold`, `platinum`)
> y los `name` se tradujeron en la migración `0003`. Los `id` están escritos
> en los `CHECK` de `providers`, en las semillas y en los enlaces
> `/planes#<id>`: renombrarlos obligaría a reescribir todo eso sin beneficio
> visible.

> **Por qué `providers.plan_id` no tiene `FOREIGN KEY`.** SQLite no permite
> `ALTER TABLE … ADD COLUMN` con clave foránea y `DEFAULT NOT NULL` a la vez.
> El `CHECK` cubre los valores válidos, y `plans` tiene exactamente esas tres
> filas.

---

## 5. Clientes y opiniones

### 5.1 `consumer_users` — clientes que buscan y opinan

**Propósito.** La identidad de quien busca servicios y deja opiniones.
**Separada de `users`** porque no comparten ciclo de vida ni permisos: un
cliente nunca administra un perfil y no tiene contraseña propia — la identidad
la aporta Google.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `auth_provider` | TEXT | no | `'google'` | `CHECK IN ('google')` — hoy sólo Google |
| `auth_provider_user_id` | TEXT | no | — | El `sub` de Google: **estable aunque cambie el email** |
| `email` | TEXT | no | — | Puede cambiar; no es la identidad |
| `display_name` | TEXT | no | `''` | Se **refresca en cada ingreso** desde Google |
| `avatar_url` | TEXT | no | `''` | URL del avatar de Google, ídem |
| `status` | TEXT | no | `'active'` | `CHECK IN ('active','suspended')` |
| `created_at` / `updated_at` | TEXT | no | — | ISO |

**Índices:** `idx_consumer_provider_uid` UNIQUE (`auth_provider,
auth_provider_user_id`) — **la identidad es el par proveedor + id externo, no
el email**; `idx_consumer_email` (`email`, no único).

### 5.2 `consumer_sessions` — sesiones de clientes

**Propósito.** Igual que `sessions` pero para `consumer_users`. Mismo esquema
opaco: el `id` es el SHA-256 del token.

| Campo | Tipo | Nulo | Notas |
| --- | --- | --- | --- |
| `id` | TEXT | no | **PK**. SHA-256 hex del token |
| `user_id` | TEXT | no | **FK** → `consumer_users.id` CASCADE |
| `expires_at` | TEXT | no | ISO. TTL de **90 días** (vs. 30 en proveedores) |
| `created_at` | TEXT | no | ISO |

**Índices:** `idx_consumer_sessions_user`, `idx_consumer_sessions_expires`.

### 5.3 `reviews` — opiniones sobre un proveedor

**Propósito.** Calificación y comentario sobre un perfil. Mantiene
sincronizados los agregados de `providers` en la misma transacción.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `provider_id` | TEXT | no | — | **FK** → `providers.id` CASCADE |
| `consumer_id` | TEXT | **sí** | — | **FK** → `consumer_users.id` `ON DELETE SET NULL`. Autor actual. `NULL` en las opiniones de semilla |
| `author_id` | TEXT | **sí** | — | **FK** → `users.id` `ON DELETE SET NULL`. Autoría heredada de `0001`; hoy siempre se inserta `NULL` |
| `author_name` | TEXT | no | — | Copia del nombre al momento de escribir. Al leer **gana** `consumer_users.display_name` si hay `consumer_id` |
| `rating` | INTEGER | no | — | `CHECK BETWEEN 1 AND 5` |
| `comment` | TEXT | no | `''` | |
| `status` | TEXT | no | `'published'` | `CHECK IN ('published','hidden','reported')`. **Sólo `'published'` se lee y suma al promedio** |
| `created_at` | TEXT | no | — | ISO |
| `updated_at` | TEXT | **sí** | — | ISO. `NULL` en las de semilla |

**Índices**

| Índice | Columnas | Para qué |
| --- | --- | --- |
| `idx_reviews_provider` | `provider_id, status, created_at DESC` | Listado de la ficha |
| `idx_reviews_consumer_provider` UNIQUE (parcial) | `provider_id, consumer_id` WHERE `consumer_id IS NOT NULL` | **Una opinión por cliente y proveedor** |
| `idx_reviews_author_provider` UNIQUE (parcial) | `provider_id, author_id` WHERE `author_id IS NOT NULL` | Ídem, heredado |

> Los índices son **parciales** a propósito: las opiniones de semilla tienen
> ambos autores en `NULL`, y en SQLite dos `NULL` no chocan entre sí.

> ⚠️ **Discrepancia tipo ↔ base.** El tipo `ReviewStatus` de
> `src/types/index.ts` declara `"pending" | "published" | "hidden" |
> "reported"`, pero el `CHECK` de la columna **no admite `'pending'`**.
> Insertar ese valor haría fallar la escritura.

### 5.4 `review_reports` — reportes de opiniones

**Propósito.** Reportar una opinión **no la borra**: abre una revisión. Por eso
es una tabla propia y no un flag en `reviews`.

| Campo | Tipo | Nulo | Default | Notas |
| --- | --- | --- | --- | --- |
| `id` | TEXT | no | — | **PK**. UUID v4 |
| `review_id` | TEXT | no | — | **FK** → `reviews.id` CASCADE |
| `consumer_id` | TEXT | **sí** | — | **FK** → `consumer_users.id` SET NULL. Si reporta un cliente |
| `user_id` | TEXT | **sí** | — | **FK** → `users.id` SET NULL. Si reporta un proveedor/admin |
| `reason` | TEXT | no | — | `CHECK IN ('spam','offensive','false_info','personal_info','conflict','other')` |
| `detail` | TEXT | no | `''` | Texto libre |
| `status` | TEXT | no | `'open'` | `CHECK IN ('open','reviewed','dismissed')` |
| `created_at` | TEXT | no | — | ISO |

**Índices:** `idx_review_reports_review` (`review_id, status`).

> `consumer_id` y `user_id` son ambos opcionales: quien reporta es uno **u**
> otro. La base no impone que al menos uno esté presente.

---

## 6. Reglas transversales de negocio

### 6.1 Bajar de plan no borra nada

Al bajar de plan, lo que excede el plan nuevo **queda guardado con
`active = 0`**. Vuelve solo si se recontrata el plan anterior.

Llevan columna `active`: `provider_services`, `provider_service_areas`,
`provider_subcategories`, `provider_social_links`, `provider_team_members`,
`provider_images`. **No** la lleva `provider_payment_methods`.

Cómo se lee, según quién mira:

| Ámbito | Filtro | Por qué |
| --- | --- | --- |
| Público (`scope = "public"`) | `AND active = 1` | Un perfil que bajó a Cobre no puede seguir mostrando la galería de Platino |
| Panel del dueño (`scope = "owner"`) | sin filtro | Tiene que poder editarlo y saber que está ahí |

`providers.purge_excess_after` anota desde cuándo se puede borrar lo excedente
(**180 días**). Anotar la fecha y borrar son operaciones distintas: el borrado
es una tarea aparte que hoy **no está implementada**.

### 6.2 Subir es inmediato, bajar se agenda

| Operación | Efecto en la fila |
| --- | --- |
| **Subir** | `plan_id` = nuevo, `downgrade_plan_id = NULL`, `purge_excess_after = NULL`, se corre `plan_expires_at` |
| **Bajar** | **No toca `plan_id`.** Escribe `downgrade_plan_id` y `purge_excess_after`; hasta el vencimiento sigue rigiendo el plan pago |
| **Cancelar baja** | `downgrade_plan_id = NULL`, `purge_excess_after = NULL` |
| **Consolidar baja vencida** | `plan_id` = el bajado, `downgrade_plan_id = NULL`, `plan_expires_at = NULL` |

El plan que rige **hoy** se resuelve al leer con `effectivePlanId()`
(`src/domain/plan-changes.ts`), no con una tarea nocturna: así la respuesta es
correcta en el instante en que se pregunta.

### 6.3 Visibilidad pública

Sólo se muestra al público lo que cumple `providers.status = 'active'` **y**,
en las tablas hijas, `active = 1`. En opiniones, `reviews.status =
'published'`.

### 6.4 Escritura de las tablas hijas

Al guardar el perfil, las hijas se **reemplazan enteras**: `DELETE` de todas
las filas del proveedor seguido de los `INSERT`, todo dentro de un mismo
`db.batch()` atómico. La consecuencia es que los `id` de
`provider_team_members` **no son estables** entre guardados.

---

## 7. Estado verificado de la D1 local

Volumen al momento de escribir este documento:

| Tabla | Filas | Observación |
| --- | ---: | --- |
| `users` | 912 | Todos con `role = 'provider'` |
| `providers` | 904 | 843 `active`, 59 `draft`, 2 `inactive` |
| `reviews` | 3 584 | Todas `published`, todas sin autor (semilla) |
| `provider_services` | 2 724 | |
| `provider_payment_methods` | 2 279 | |
| `provider_service_areas` | 1 496 | |
| `plans` | 3 | Cobre / Oro / Platino |
| `provider_images` | 2 | 1 `avatar` + 1 `cover`, ambas reclamadas |
| `provider_subcategories` | 1 | |
| `provider_social_links` | 1 | |
| `consumer_users` | 0 | Sin flujo de Google ejercido en local |
| `consumer_sessions` | 0 | |
| `provider_hours` | 0 | Tabla no usada por el código |
| `provider_team_members` | 0 | |
| `review_reports` | 0 | |
| `sessions` | 8 | |

**Chequeos de integridad ejecutados — todos OK:**

- `rating_sum` / `review_count` vs. suma real de opiniones publicadas: **0
  filas desalineadas**.
- Proveedores sin usuario: **0**. Opiniones sin proveedor: **0**. Servicios sin
  proveedor: **0**.
- `PRAGMA foreign_keys = 1`.

Distribución por plan: 539 Cobre, 236 Oro, 129 Platino (127 `active` + 2
`past_due`). 2 perfiles con baja agendada, 4 con vencimiento, 48 destacados,
185 verificados.

---

## 8. Desalineaciones detectadas

Puntos donde el esquema real y el código **no coinciden**. Son hallazgos, no
correcciones aplicadas.

| # | Objeto | Qué pasa | Impacto |
| --- | --- | --- | --- |
| 1 | `providers.pending_plan_id` + `idx_providers_pending_plan` | Sustituida por `downgrade_plan_id` en `0007`, que la vació. **0 referencias en el código**, 0 filas con valor | Columna e índice muertos |
| 2 | `providers.logo_key`, `providers.cover_key` | Superadas por `provider_images.kind IN ('avatar','cover')`. **0 referencias en el código**, todas vacías | Columnas muertas |
| 3 | `provider_hours` | Tabla e índice creados, tipo `DayHours` definido, pero **0 referencias en el código** y 0 filas. El horario real es `providers.schedule` (texto libre) | Funcionalidad pendiente |
| 4 | `ReviewStatus` (TS) vs. `reviews.status` (CHECK) | El tipo declara `'pending'`; el `CHECK` **no lo admite** | Escribir `'pending'` rompe en runtime |
| 5 | `providers.whatsapp` | Heredada de `0001`, reemplazada por `whatsapp_enabled` + `phone_e164`, pero **se sigue escribiendo** en `create()` y `update()` | Dato duplicado |
| 6 | `reviews.author_id` + `idx_reviews_author_provider` | La autoría pasó a `consumer_id` en `0002`. Se sigue insertando, pero **siempre `NULL`** | Columna e índice en desuso |
| 7 | `providers.verified` vs. `verification_status` | Dos columnas para la misma idea (resultado vs. trámite) sin invariante que las ate en la base | Pueden divergir |
| 8 | `review_reports.consumer_id` / `user_id` | Ambos opcionales, sin `CHECK` que exija al menos uno | Se puede insertar un reporte sin autor |
| 9 | `provider_team_members.photo_key` | Apunta a R2 sin fila en `provider_images`, así que **queda fuera** del borrado y del cupo de galería | Riesgo de objetos huérfanos |

**Sin desalineación** en el resto: las 16 tablas de negocio, sus columnas,
tipos, `CHECK`, defaults, claves e índices coinciden exactamente entre las 7
migraciones, la D1 local y lo que el código lee y escribe.
