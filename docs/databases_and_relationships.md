# **Users**
Cuenta que tiene accesso a la plataforma. Estos seran proveedores de servicios y administrador del sistema.

## Data
| Campo                 | Tipo    | Nulo |  Default     |  Reglas y notas                   |
| ---                   | ---     | ---  | ---          | ---                               |
| `id`                  | text    | no   |  —           |  PK. UUID v4                      |
| `email`               | text    | no   |  —           |  unique                           |
| `verified`            | integer | no   |  —           |                                   |
| `role`                | text    | no   | 'provider'   | CHECK IN ('provider', 'admin', 'superadmin') |
| `password`            | text    | no   |  —           | Formato pbkdf2:<iteraciones>:<salt>:<hash> — PBKDF2-SHA256, 100 000 iteraciones. |
| `is_active`           | integer | no   | 1            | Determina si la cuenta del proveedor esta activa |
| `created_at`          | text    | no   |  —           | ISO 8601                                         |
| `updated_at`          | text    | no   |  —           | ISO 8601                                         |

## Índices: 
idx_users_email UNIQUE (email).

<hr style="height: 5px; background-color: gray; border: none;">

# **Sessions**
Sesiones de proveedores y admins. 
Sostener la sesión de un users. El id es el SHA-256 del token de la cookie, nunca el token en claro: si se filtra la base, las cookies no son reutilizables.

## Data
| Campo                 | Tipo    | Nulo |  Default     |  Reglas y notas                   |
| ---                   | ---     | ---  | ---          | ---                               |
| `id`                  | text    | no   |  —           |  PK. UUID v4                      |
| `user_id`             | text    | no   |  —           |  FK → users.id ON DELETE CASCADE  |
| `expires_at`          | text    | no   |  —           |  ISO. TTL de 30 días              |
| `updated_at`          | text    | no   |  —           |  ISO                              |

<hr style="height: 5px; background-color: gray; border: none;">

# **Profiles**
Es la persona que provee los servicios.

## Data
| Campo                 | Tipo    | Nulo |  Default     |  Reglas y notas                   |
| ---                   | ---     | ---  | ---          | ---                               |
| `id`                  | text    | no   |  —           |  PK. UUID v4                      |
| `user_id`             | text    | no   |  —           |  FK → users.id ON DELETE CASCADE. Único: un perfil por usuario                      |
| `email`               | text    | no   |  —           |  unique                           |
| `phone`               | text    | no   |  —           |                                   |
| `verified`            | integer | no   |  —           |                                   |
| `role`                | text    | no   | 'provider'   | CHECK IN ('provider', 'admin', 'superadmin') |
| `name`                | text    | no   |  —           | Nombre del proveedor              |
| `password`            | text    | no   |  —           | Formato pbkdf2:<iteraciones>:<salt>:<hash> — PBKDF2-SHA256, 100 000 iteraciones. |
| `is_active`           | integer | no   | 1            | Determina si la cuenta del proveedor esta activa |
| `profile_cover_image` | text    | si   | —            | Imagen por defecto según rubro |
| `profile_image`       | text    | si   | —            | Como valor por defecto en el frontend se le pondra las letras de las iniciales del proveedor |
| `slug`                | text    | no   | —            | Único. URL pública /profesionales/<slug>. Se deriva del nombre y se desambigua con sufijo -2, -3… |
| `type`                | text    | no   | 'individual' | CHECK IN ('individual','business') |
| `description`         | text    | no   | ''           | Breve descripcion del proveedor   |
| `icon`                | text    | no   | 'work'       | Nombre de Material Symbols |
| `location_id`         | text    | si   | —            | FK → locations.id ON DELETE RESTRICT. Puede apuntar a Uruguay, un departamento o una localidad |
| `profile_status`      | text    | no   |  'draft'     | CHECK IN ('draft','active','pending_verification','suspended','inactive'). Sólo 'active' es visible al público|
| `show_verified`       | integer | no   | 0            | CHECK IN (0, 1). Mostrar insignia de verificado |
| `plan_id`             | text    | no   | —            | FK → plans.id ON DELETE RESTRICT |
| `created_at`          | text    | no   |  —           |                                   |
| `updated_at`          | text    | no   |  —           |                                   |

## Reglas:
- `location_id` guarda el nivel más específico que el proveedor decidió indicar: Uruguay, un departamento o una localidad.
- `location_id = NULL` significa que la ubicación todavía no fue configurada; no significa Uruguay.
- Mientras el perfil está en borrador, `location_id` puede ser NULL y puede no tener registros en `profile_service_areas`.
- Para activar el perfil, `location_id` debe contener una elección explícita y debe existir al menos un registro en `profile_service_areas`.

<hr style="height: 5px; background-color: gray; border: none;">

# **services_mode**
Modalidades de servicio. Las cuales pueden ser: A domicilio, En el negocio, A distancia, Hibrido

## Data
| Campo          | Tipo     | Nulo |  Default |  Reglas y notas                   |
| ---            | ---      | ---  | ---      | ---                               |
| `id`           | text     | no   |  —       |  PK. UUID v4                      |
| `mode`         |	TEXT    |	no   |	—       |	CHECK IN ('on_site','at_business','remote','hybrid') |

<hr style="height: 5px; background-color: gray; border: none;">

# **profiles_services_mode**  (many to many relationship)
Production de la relacion mucho a muchos entre profile y services_mode. Un perfil puede tener muchos modos de servicio y un modelo de servicio puede ser aplicado a muchos perfiles

## Data
| Campo               | Tipo     | Nulo |  Default |  Reglas y notas  |
| ---                 | ---      | ---  | ---      | ---              |
| `profile_id`        | text     | no   |  —       |  FK. UUID v4     |
| `service_mode_id`   |	TEXT     |	no  |	—        |	FK. UUID v4 |

<hr style="height: 5px; background-color: gray; border: none;">

# **Profile_social_links**
 Enlaces a redes. Es una capacidad de plan (plans.allows_social_links): en Cobre se guardan pero quedan inactivos.

## Data
| Campo          | Tipo     | Nulo |  Default |  Reglas y notas                   |
| ---            | ---      | ---  | ---      | ---                               |
| `id`           | text     | no   |  —       |  PK. UUID v4                      |
| `provider_id`  |	TEXT    |	no   |	—       |	PK compuesta. FK → providers.id CASCADE|
| `platform`     |	TEXT    |	no   |	—       |	PK compuesta: una URL por plataforma. CHECK IN ('instagram','facebook','linkedin','x','tiktok','youtube','website')|
| `url`          |	TEXT    |	no   |	—       |	URL completa|
| `active`       |	INTEGER |	no   |	1       |	Todo o nada según el plan|

<hr style="height: 5px; background-color: gray; border: none;">

# **Locations**
Catálogo geográfico jerárquico de Uruguay. Contiene el país, sus 19 departamentos y las localidades definidas en `departamentos_localidades_zonas_barrios.md`. Cualquiera de los tres niveles puede utilizarse como ubicación o área de servicio.

## Data
| Campo        | Tipo    | Nulo | Default | Reglas y notas                                      |
| ---          | ---     | ---  | ---     | ---                                                  |
| `id`         | text    | no   | —       | PK. Identificador geográfico estable                 |
| `parent_id`  | text    | si   | —       | FK autorreferenciada → locations.id ON DELETE RESTRICT. NULL únicamente para Uruguay |
| `type`       | text    | no   | —       | CHECK IN ('country','department','locality')          |
| `name`       | text    | no   | —       | Nombre canónico mostrado en la interfaz               |
| `slug`       | text    | no   | —       | Identificador legible dentro de su ubicación padre   |
| `is_active`  | integer | no   | 1       | CHECK IN (0, 1). Permite desactivar sin eliminar     |

## Índices:
idx_locations_parent_id (parent_id).  
idx_locations_type (type).  
idx_locations_parent_slug UNIQUE (parent_id, slug).

## Reglas:
- `uruguay` es el único registro de tipo `country` y el único con `parent_id = NULL`.
- Cada departamento tiene `parent_id = 'uruguay'`.
- Cada localidad tiene como `parent_id` el departamento al que pertenece.
- La aplicación no permite crear ubicaciones desde el formulario del proveedor; solo seleccionar registros activos.
- Los IDs son estables. Renombrar un lugar no debe cambiar su ID sin una migración explícita.

<hr style="height: 5px; background-color: gray; border: none;">

# **Profile_Service_Areas**
Tabla intermedia que registra dónde ofrece servicios un perfil. Cada selección puede representar todo Uruguay, un departamento completo o una localidad específica.

## Data
| Campo         | Tipo | Nulo | Default | Reglas y notas                                       |
| ---           | ---  | ---  | ---     | ---                                                  |
| `profile_id`  | text | no   | —       | PK compuesta. FK → profiles.id ON DELETE CASCADE     |
| `location_id` | text | no   | —       | PK compuesta. FK → locations.id ON DELETE RESTRICT   |

## Índices:
PK (profile_id, location_id).  
idx_profile_service_areas_location_id (location_id).

## Reglas:
- Seleccionar `uruguay` crea una fila explícita y reemplaza cualquier otra área del perfil.
- `uruguay` no puede combinarse con departamentos ni localidades.
- Seleccionar un departamento representa cobertura en todo ese departamento y hace redundante seleccionar sus localidades descendientes.
- No se guarda una localidad si ya está seleccionado su departamento padre. Al seleccionar el departamento, se eliminan las localidades descendientes previamente elegidas.
- Se puede combinar un departamento completo con localidades pertenecientes a otros departamentos.
- Una búsqueda por localidad incluye perfiles que hayan seleccionado `uruguay`, su departamento padre o la localidad exacta.
- Una búsqueda por departamento incluye perfiles que hayan seleccionado `uruguay`, el departamento exacto o alguna localidad descendiente de ese departamento.

<hr style="height: 5px; background-color: gray; border: none;">

# **Categories**
Representa un rubro general que agrupa varias subcategorías. El rubro se obtiene a través de la subcategoría seleccionada por el proveedor.

## Data
| Campo                 | Tipo    | Nulo | Default | Reglas y notas                                      |
| ---                   | ---     | ---  | ---     | ---                                                  |
| `id`                  | text    | no   | —       | PK. UUID v4                                          |
| `name`                | text    | no   | —       | Nombre del rubro. Único                              |
| `slug`                | text    | no   | —       | Único. Se utiliza en URLs y filtros                  |
| `description`         | text    | si   | —       | Descripción interna o pública del rubro              |
| `icon`                | text    | si   | —       | Nombre del icono utilizado en la interfaz            |
| `is_active`           | integer | no   | 1       | CHECK IN (0, 1). Permite desactivar sin eliminar     |
| `sort_order`          | integer | no   | 0       | Orden de aparición en la interfaz                    |
| `created_at`          | text    | no   | —       | ISO 8601                                             |
| `updated_at`          | text    | no   | —       | ISO 8601                                             |

## Índices:
idx_categories_name UNIQUE (name).  
idx_categories_slug UNIQUE (slug).

<hr style="height: 5px; background-color: gray; border: none;">

# **Subcategories**
Representa una especialidad dentro de un rubro. El proveedor debe seleccionar al menos una subcategoría; la categoría se deriva de esta relación.

## Data
| Campo                 | Tipo    | Nulo | Default | Reglas y notas                                      |
| ---                   | ---     | ---  | ---     | ---                                                  |
| `id`                  | text    | no   | —       | PK. UUID v4                                          |
| `category_id`         | text    | no   | —       | FK → categories.id ON DELETE RESTRICT                |
| `name`                | text    | no   | —       | Nombre de la especialidad                            |
| `slug`                | text    | no   | —       | Único dentro de la categoría. Se utiliza en URLs y filtros |
| `description`         | text    | si   | —       | Descripción interna o pública de la especialidad     |
| `is_active`           | integer | no   | 1       | CHECK IN (0, 1). Permite desactivar sin eliminar     |
| `sort_order`          | integer | no   | 0       | Orden de aparición dentro de la categoría            |
| `created_at`          | text    | no   | —       | ISO 8601                                             |
| `updated_at`          | text    | no   | —       | ISO 8601                                             |

## Índices:
idx_subcategories_category_id (category_id).  
idx_subcategories_category_slug UNIQUE (category_id, slug).

<hr style="height: 5px; background-color: gray; border: none;">

# **Profile_Subcategories**
Tabla intermedia que relaciona los perfiles con las subcategorías o especialidades que ofrecen.

## Data
| Campo                 | Tipo | Nulo | Default | Reglas y notas                                      |
| ---                   | ---  | ---  | ---     | ---                                                  |
| `profile_id`          | text | no   | —       | PK compuesta. FK → profiles.id ON DELETE CASCADE     |
| `subcategory_id`      | text | no   | —       | PK compuesta. FK → subcategories.id ON DELETE RESTRICT |
| `created_at`          | text | no   | —       | ISO 8601                                             |

## Índices:
PK (profile_id, subcategory_id).  
idx_profile_subcategories_subcategory_id (subcategory_id).

<hr style="height: 5px; background-color: gray; border: none;">

# **Services**
Representa un servicio de texto libre ofrecido por un perfil dentro de una de sus subcategorías seleccionadas. Las sugerencias se obtienen desde un archivo JSON organizado por subcategoría y no se guardan en esta tabla como catálogo global.

## Data
| Campo                 | Tipo | Nulo | Default | Reglas y notas                                         |
| ---                   | ---  | ---  | ---     | ---                                                     |
| `id`                  | text | no   | —       | PK. UUID v4                                             |
| `profile_id`          | text | no   | —       | Parte de FK compuesta → profile_subcategories(profile_id, subcategory_id) ON DELETE CASCADE |
| `subcategory_id`      | text | no   | —       | Parte de FK compuesta → profile_subcategories(profile_id, subcategory_id) ON DELETE CASCADE |
| `name`                | text | no   | —       | Texto libre. Entre 3 y 80 caracteres                   |

## Índices:
idx_services_profile_id (profile_id).  
idx_services_subcategory_id (subcategory_id).  
idx_services_profile_subcategory_name UNIQUE (profile_id, subcategory_id, name).

<hr style="height: 5px; background-color: gray; border: none;">

# Relationships
- Un `profile` can have a lot of `profile_social_links` y un `profile_social_links` pertenece solo a un profile.
- `locations` forma una jerarquía autorreferenciada: Uruguay contiene departamentos y cada departamento contiene localidades.
- Un perfil tiene una sola ubicación mediante `profiles.location_id`; puede ser Uruguay, un departamento o una localidad.
- Un perfil puede ofrecer servicios en una o varias ubicaciones mediante `profile_service_areas`, respetando las reglas de no redundancia entre padres y descendientes.
- Una categoría contiene muchas subcategorías y cada subcategoría pertenece a una categoría.
- Un perfil puede tener muchas subcategorías y una subcategoría puede pertenecer a muchos perfiles mediante `profile_subcategories`.
- Un perfil puede tener muchos servicios y cada servicio pertenece a un único perfil.
- Cada servicio pertenece a una de las subcategorías previamente seleccionadas por el perfil. La FK compuesta `(profile_id, subcategory_id)` garantiza esta regla.
- Las sugerencias de servicios se mantienen en un archivo JSON agrupado por subcategoría. Al seleccionar una sugerencia o escribir un servicio propio, se guarda su nombre como texto libre en `services`.
- No se necesita una tabla `profile_categories`, porque las categorías del perfil se obtienen a través de sus subcategorías.
