# Modelo de datos y relaciones

## Uso de este documento

Este archivo describe exclusivamente el esquema físico: tablas, columnas, tipos,
constraints, claves e índices. Las reglas funcionales pertenecen a
`business_rules.md`; las decisiones de implementación pertenecen a
`technical_rules.md`.

- Convenciones de nombres y tipos: **TR-001** y **TR-002**.
- Integridad referencial y validación por capas: **TR-003 a TR-006**.
- Los textos de “Reglas y notas” de las columnas explican el constraint físico;
  no crean reglas independientes.

<hr style="height: 5px; background-color: gray; border: none;">

# **users**
Cuenta con acceso a la plataforma. Puede pertenecer a un proveedor de servicios o a un administrador del sistema.

## Datos
| Campo                 | Tipo    | Nulo |  Default     |  Reglas y notas                   |
| ---                   | ---     | ---  | ---          | ---                               |
| `id`                  | text    | no   |  —           |  PK. UUID v4                      |
| `email`               | text    | no   |  —           | Único. Debe almacenarse normalizado en minúsculas |
| `email_verified`      | integer | no   | 0            | CHECK IN (0, 1). Indica si el correo fue verificado |
| `role`                | text    | no   | 'provider'   | CHECK IN ('provider', 'admin', 'superadmin') |
| `password_hash`       | text    | no   |  —           | Formato `pbkdf2:<iteraciones>:<salt>:<hash>` — PBKDF2-HMAC-SHA256, 600 000 iteraciones para hashes nuevos |
| `is_active`           | integer | no   | 1            | CHECK IN (0, 1). Determina si la cuenta está activa |
| `created_at`          | text    | no   |  —           | ISO 8601 UTC |
| `updated_at`          | text    | no   |  —           | ISO 8601 UTC |

## Índices: 
idx_users_email UNIQUE (email COLLATE NOCASE).

## Referencias normativas
- **TR-007**.

<hr style="height: 5px; background-color: gray; border: none;">

# **sessions**
Mantiene las sesiones de proveedores y administradores. El `id` es el hash SHA-256 del token de la cookie, nunca el token en claro; de este modo, una filtración de la base de datos no permite reutilizar las cookies.

## Datos
| Campo                 | Tipo    | Nulo |  Default     |  Reglas y notas                   |
| ---                   | ---     | ---  | ---          | ---                               |
| `id`                  | text    | no   |  —           |  PK. Hash SHA-256 del token de sesión |
| `user_id`             | text    | no   |  —           |  FK → users.id ON DELETE CASCADE  |
| `expires_at`          | text    | no   |  —           |  ISO 8601 UTC. Expiración predeterminada: 30 días |
| `created_at`          | text    | no   |  —           |  ISO 8601 UTC |

## Índices:
idx_sessions_user_id (user_id).  
idx_sessions_expires_at (expires_at).

<hr style="height: 5px; background-color: gray; border: none;">

# **profiles**
Representa al profesional independiente o empresa que ofrece servicios. Los datos de autenticación pertenecen exclusivamente a `users`.

## Datos
| Campo                 | Tipo    | Nulo |  Default     |  Reglas y notas                   |
| ---                   | ---     | ---  | ---          | ---                               |
| `id`                  | text    | no   |  —           |  PK. UUID v4                      |
| `user_id`             | text    | no   |  —           |  FK → users.id ON DELETE CASCADE. Único: un perfil por usuario                      |
| `contact_email`       | text    | no   | ''           | Correo público de contacto; puede diferir de users.email |
| `phone`               | text    | no   | ''           | Teléfono tal como lo ingresó la persona |
| `phone_e164`          | text    | no   | ''           | Teléfono normalizado en formato E.164; se utiliza para enlaces `tel:` y `wa.me` |
| `phone_verified_at`   | text    | sí   | —            | ISO 8601 UTC. NULL mientras no se haya verificado el teléfono actual |
| `whatsapp_enabled`    | integer | no   | 0            | CHECK IN (0, 1). Indica si `phone_e164` también recibe mensajes de WhatsApp |
| `phone_public`        | integer | no   | 1            | CHECK IN (0, 1). Indica si el teléfono se muestra públicamente |
| `name`                | text    | no   |  —           | Nombre del proveedor              |
| `slug`                | text    | no   | —            | Único. URL pública /profesionales/<slug>. Se deriva del nombre y se desambigua con sufijo -2, -3… |
| `type`                | text    | no   | 'individual' | CHECK IN ('individual','business') |
| `description`         | text    | no   | ''           | Breve descripción del proveedor   |
| `icon`                | text    | no   | 'work'       | Nombre de Material Symbols |
| `profile_status`      | text    | no   | 'draft'      | CHECK IN ('draft','active','suspended','inactive'). Sólo 'active' es visible al público |
| `verification_status` | text    | no   | 'not_requested' | CHECK IN ('not_requested','pending','verified','rejected'). Verificación comercial del perfil que controla la insignia; no representa contacto ni habilitaciones profesionales |
| `plan_id`             | text    | no   | 'cobre'      | FK → plans.id ON DELETE RESTRICT |
| `subscription_status` | text    | no   | 'active'     | CHECK IN ('trial','active','past_due','cancelled','expired'). `past_due` = plan activo pero cobro sin resolver |
| `plan_expires_at`     | text    | sí   | —            | Fin del período pago. NULL en Cobre, que no vence |
| `downgrade_plan_id`   | text    | sí   | —            | FK → plans.id ON DELETE RESTRICT. Plan al que se baja al vencer. NULL = sin baja agendada |
| `purge_excess_after`  | text    | sí   | —            | Desde cuándo se puede borrar lo que quedó fuera del plan (180 días) |
| `rating_sum`          | integer | no   | 0            | CHECK >= 0. Suma de estrellas de las opiniones publicadas |
| `review_count`        | integer | no   | 0            | CHECK >= 0. Cantidad de opiniones publicadas |
| `created_at`          | text    | no   |  —           | ISO 8601 UTC |
| `updated_at`          | text    | no   |  —           | ISO 8601 UTC |

## Índices:
idx_profiles_user_id UNIQUE (user_id).  
idx_profiles_slug UNIQUE (slug COLLATE NOCASE).  
idx_profiles_plan_id (plan_id).  
idx_profiles_profile_status (profile_status).  
idx_profiles_plan_expiry_downgrade (plan_expires_at, downgrade_plan_id) WHERE downgrade_plan_id IS NOT NULL.

## Referencias normativas
- **BR-002 a BR-009**, **BR-018 a BR-020**, **BR-026**, **TR-006** y **TR-010 a TR-016**.

<hr style="height: 5px; background-color: gray; border: none;">

# **service_modes**
Catálogo de modalidades básicas de prestación: en el domicilio del cliente, en el negocio o a distancia. La combinación de varias modalidades representa atención híbrida.

## Datos
| Campo          | Tipo     | Nulo |  Default |  Reglas y notas                   |
| ---            | ---      | ---  | ---      | ---                               |
| `id`           | text     | no   |  —       |  PK. UUID v4                      |
| `code`         | text     | no   | —        | CHECK IN ('at_customer','at_business','remote') |
| `name`         | text     | no   | —        | Nombre mostrado en español |
| `created_at`   | text     | no   | —        | ISO 8601 UTC |
| `updated_at`   | text     | no   | —        | ISO 8601 UTC |

## Índices:
idx_service_modes_code UNIQUE (code).

## Referencias normativas
- **BR-017** y **TR-001**.

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_service_modes**
Tabla intermedia de la relación muchos a muchos entre `profiles` y `service_modes`.

## Datos
| Campo               | Tipo     | Nulo |  Default |  Reglas y notas  |
| ---                 | ---      | ---  | ---      | ---              |
| `profile_id`        | text     | no   | —        | PK compuesta. FK → profiles.id ON DELETE CASCADE |
| `service_mode_id`   | text     | no   | —        | PK compuesta. FK → service_modes.id ON DELETE RESTRICT |

## Índices:
PK (profile_id, service_mode_id).  
idx_profile_service_modes_service_mode_id (service_mode_id).

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_social_links**
Enlaces del perfil a redes sociales y sitios externos. Su activación depende de `plans.allows_social_links`; en Cobre pueden conservarse, pero permanecen inactivos.

## Datos
| Campo          | Tipo     | Nulo |  Default |  Reglas y notas                   |
| ---            | ---      | ---  | ---      | ---                               |
| `profile_id`   | text     | no   | —        | PK compuesta. FK → profiles.id ON DELETE CASCADE |
| `platform`     | text     | no   | —        | PK compuesta. CHECK IN ('instagram','facebook','linkedin','x','tiktok','youtube','website') |
| `url`          | text     | no   | —        | URL completa |
| `is_active`    | integer  | no   | 1        | CHECK IN (0, 1). Se desactiva cuando el plan no permite enlaces sociales |
| `created_at`   | text     | no   | —        | ISO 8601 UTC |
| `updated_at`   | text     | no   | —        | ISO 8601 UTC |

## Índices:
PK (profile_id, platform).

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_payment_methods**
Medios de pago aceptados por el perfil. Se utilizan como dato visible en la ficha y como filtro de búsqueda.

## Datos
| Campo        | Tipo | Nulo | Default | Reglas y notas |
| ---          | ---  | ---  | ---     | --- |
| `profile_id` | text | no   | —       | PK compuesta. FK → profiles.id ON DELETE CASCADE |
| `method`     | text | no   | —       | PK compuesta. CHECK IN ('cash','bank_transfer','debit_card','credit_card','other') |

## Índices:
PK (profile_id, method).  
idx_profile_payment_methods_method_profile (method, profile_id).

## Referencias normativas
- **BR-023**.

<hr style="height: 5px; background-color: gray; border: none;">

# **locations**
Catálogo geográfico jerárquico de Uruguay. Contiene el país, sus 19 departamentos y sus localidades. Cualquiera de los tres niveles puede utilizarse como área de servicio; las ubicaciones físicas sólo admiten departamentos o localidades.

## Datos
| Campo        | Tipo    | Nulo | Default | Reglas y notas                                      |
| ---          | ---     | ---  | ---     | ---                                                  |
| `id`         | text    | no   | —       | PK. Identificador geográfico estable                 |
| `parent_id`  | text    | sí   | —       | FK autorreferenciada → locations.id ON DELETE RESTRICT. NULL únicamente para Uruguay |
| `type`       | text    | no   | —       | CHECK IN ('country','department','locality')          |
| `name`       | text    | no   | —       | Nombre canónico mostrado en la interfaz               |
| `slug`       | text    | no   | —       | Identificador legible dentro de su ubicación padre   |
| `is_active`  | integer | no   | 1       | CHECK IN (0, 1). Permite desactivar sin eliminar     |
| `created_at` | text    | no   | —       | ISO 8601 UTC |
| `updated_at` | text    | no   | —       | ISO 8601 UTC |

## Índices:
idx_locations_parent_id (parent_id).  
idx_locations_type (type).  
idx_locations_parent_slug UNIQUE (parent_id, slug).  
idx_locations_single_root UNIQUE ((1)) WHERE parent_id IS NULL.

## Referencias normativas
- **BR-014**, **TR-017**, **TR-032** y **TR-033**.

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_locations**
Registra las ubicaciones o sucursales físicas de un perfil. Esta información es distinta de las áreas en las que el proveedor presta servicios.

## Datos
| Campo         | Tipo    | Nulo | Default | Reglas y notas |
| ---           | ---     | ---   | ---     | --- |
| `id`          | text    | no    | —       | PK. UUID v4 |
| `profile_id`  | text    | no    | —       | FK → profiles.id ON DELETE CASCADE |
| `location_id` | text    | no    | —       | FK → locations.id ON DELETE RESTRICT. Debe apuntar a un departamento o localidad |
| `name`        | text    | sí    | —       | Nombre opcional de la sucursal |
| `address`     | text    | sí    | —       | Dirección opcional. No debe usarse para representar el área de cobertura |
| `is_primary`  | integer | no    | 0       | CHECK IN (0, 1). Solo una ubicación principal por perfil |
| `is_active`   | integer | no    | 1       | CHECK IN (0, 1). Los límites del plan cuentan únicamente ubicaciones activas |
| `created_at`  | text    | no    | —       | ISO 8601 UTC |
| `updated_at`  | text    | no    | —       | ISO 8601 UTC |

## Índices:
idx_profile_locations_profile_id (profile_id).  
idx_profile_locations_location_id (location_id).  
idx_profile_locations_active_primary UNIQUE (profile_id) WHERE is_primary = 1 AND is_active = 1.

## Referencias normativas
- **BR-006**, **BR-007**, **BR-009**, **BR-015**, **TR-016** y **TR-017**.

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_service_areas**
Tabla intermedia que registra dónde ofrece servicios un perfil. Cada selección puede representar todo Uruguay, un departamento completo o una localidad específica.

## Datos
| Campo         | Tipo | Nulo | Default | Reglas y notas                                       |
| ---           | ---  | ---  | ---     | ---                                                  |
| `profile_id`  | text | no   | —       | PK compuesta. FK → profiles.id ON DELETE CASCADE     |
| `location_id` | text | no   | —       | PK compuesta. FK → locations.id ON DELETE RESTRICT   |

## Índices:
PK (profile_id, location_id).  
idx_profile_service_areas_location_id (location_id).

## Referencias normativas
- **BR-016**, **TR-018** y **TR-019**.

<hr style="height: 5px; background-color: gray; border: none;">

# **service_sectors**
Representa un rubro general que agrupa varias especialidades. Los rubros de un perfil se obtienen a través de las especialidades seleccionadas.

## Datos
| Campo                 | Tipo    | Nulo | Default | Reglas y notas                                      |
| ---                   | ---     | ---  | ---     | ---                                                  |
| `id`                  | text    | no   | —       | PK. ID estable derivado por el catálogo (`slugify` del nombre corto) |
| `name`                | text    | no   | —       | Nombre del rubro. Único                              |
| `slug`                | text    | no   | —       | Único. Se utiliza en URLs y filtros                  |
| `description`         | text    | sí   | —       | Descripción interna o pública del rubro              |
| `icon`                | text    | sí   | —       | Nombre del icono utilizado en la interfaz            |
| `is_active`           | integer | no   | 1       | CHECK IN (0, 1). Permite desactivar sin eliminar     |
| `sort_order`          | integer | no   | 0       | Orden de aparición en la interfaz                    |
| `created_at`          | text    | no   | —       | ISO 8601 UTC |
| `updated_at`          | text    | no   | —       | ISO 8601 UTC |

## Índices:
idx_service_sectors_name UNIQUE (name COLLATE NOCASE).  
idx_service_sectors_slug UNIQUE (slug COLLATE NOCASE).

<hr style="height: 5px; background-color: gray; border: none;">

# **specialties**
Representa una especialidad dentro de un rubro y se relaciona con los perfiles mediante `profile_specialties`.

## Datos
| Campo                 | Tipo    | Nulo | Default | Reglas y notas                                      |
| ---                   | ---     | ---  | ---     | ---                                                  |
| `id`                  | text    | no   | —       | PK. ID estable `<service_sector_id>-<slugify(nombre)>` |
| `service_sector_id`   | text    | no   | —       | FK → service_sectors.id ON DELETE RESTRICT            |
| `name`                | text    | no   | —       | Nombre de la especialidad                            |
| `slug`                | text    | no   | —       | Único dentro del rubro. Se utiliza en URLs y filtros |
| `description`         | text    | sí   | —       | Descripción interna o pública de la especialidad     |
| `requires_professional_credential` | integer | no | 0 | CHECK IN (0, 1). Indica si sus servicios requieren una habilitación aprobada y vigente para mostrarse públicamente |
| `is_active`           | integer | no   | 1       | CHECK IN (0, 1). Permite desactivar sin eliminar     |
| `sort_order`          | integer | no   | 0       | Orden de aparición dentro del rubro                   |
| `created_at`          | text    | no   | —       | ISO 8601 UTC |
| `updated_at`          | text    | no   | —       | ISO 8601 UTC |

## Índices:
idx_specialties_service_sector_slug UNIQUE (service_sector_id, slug COLLATE NOCASE).

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_specialties**
Tabla intermedia que relaciona los perfiles con las especialidades que ofrecen.

## Datos
| Campo                 | Tipo | Nulo | Default | Reglas y notas                                      |
| ---                   | ---  | ---  | ---     | ---                                                  |
| `profile_id`          | text | no   | —       | PK compuesta. FK → profiles.id ON DELETE CASCADE     |
| `specialty_id`        | text | no   | —       | PK compuesta. FK → specialties.id ON DELETE RESTRICT |
| `is_active`           | integer | no | 1       | CHECK IN (0, 1). Los límites del plan cuentan únicamente especialidades activas |
| `sort_order`          | integer | no | 0       | CHECK >= 0. Orden de presentación y criterio estable al aplicar límites del plan |
| `created_at`          | text    | no   | —       | ISO 8601 UTC |
| `updated_at`          | text    | no   | —       | ISO 8601 UTC |

## Índices:
PK (profile_id, specialty_id).  
idx_profile_specialties_specialty_id (specialty_id).

<hr style="height: 5px; background-color: gray; border: none;">

# **professional_credentials**
Registra solicitudes y decisiones sobre habilitaciones profesionales asociadas a una especialidad regulada. Es independiente de la insignia comercial representada por `profiles.verification_status`.

## Datos
| Campo                 | Tipo | Nulo | Default | Reglas y notas |
| ---                   | ---  | ---   | ---     | --- |
| `id`                  | text | no    | —       | PK. UUID v4 |
| `profile_id`          | text | no    | —       | FK → profiles.id ON DELETE CASCADE |
| `specialty_id`        | text | no    | —       | FK → specialties.id ON DELETE RESTRICT. Debe requerir habilitación profesional |
| `credential_name`     | text | no    | —       | Nombre del título, matrícula, registro o habilitación |
| `credential_number`   | text | no    | ''      | Número o identificador declarado, cuando corresponda |
| `issuing_authority`   | text | no    | —       | Organismo o autoridad emisora |
| `document_storage_key`| text | no    | —       | Clave privada y única del documento probatorio; nunca se expone públicamente |
| `status`              | text | no    | 'pending' | CHECK IN ('pending','verified','rejected','revoked','expired') |
| `expires_at`          | text | sí    | —       | ISO 8601 UTC. NULL si la habilitación no tiene vencimiento |
| `submitted_at`        | text | no    | —       | ISO 8601 UTC |
| `reviewed_at`         | text | sí    | —       | ISO 8601 UTC. NULL mientras esté pendiente |
| `reviewed_by_user_id` | text | sí    | —       | FK → users.id ON DELETE SET NULL. Administrador que tomó la decisión |
| `rejection_reason`    | text | no    | ''      | Motivo visible para el proveedor cuando fue rechazada |
| `created_at`          | text | no    | —       | ISO 8601 UTC |
| `updated_at`          | text | no    | —       | ISO 8601 UTC |

## Índices:
idx_professional_credentials_profile_specialty (profile_id, specialty_id).  
idx_professional_credentials_status_expiry (status, expires_at).  
idx_professional_credentials_storage_key UNIQUE (document_storage_key).  
idx_professional_credentials_current UNIQUE (profile_id, specialty_id) WHERE status IN ('pending','verified').

## Referencias normativas
- **BR-020** y **TR-013**.

<hr style="height: 5px; background-color: gray; border: none;">

# **services**
Representa un servicio de texto libre ofrecido por un perfil dentro de una de sus especialidades seleccionadas. Las sugerencias se obtienen desde un archivo JSON organizado por especialidad y no se guardan en esta tabla como catálogo global.

## Datos
| Campo                 | Tipo | Nulo | Default | Reglas y notas                                         |
| ---                   | ---  | ---  | ---     | ---                                                     |
| `id`                  | text | no   | —       | PK. UUID v4                                             |
| `profile_id`          | text | no   | —       | Parte de FK compuesta → profile_specialties(profile_id, specialty_id) ON DELETE CASCADE |
| `specialty_id`        | text | no   | —       | Parte de FK compuesta → profile_specialties(profile_id, specialty_id) ON DELETE CASCADE |
| `name`                | text | no   | —       | Texto libre. Entre 3 y 80 caracteres                   |
| `is_active`           | integer | no | 1       | CHECK IN (0, 1). Los límites del plan cuentan únicamente servicios activos |
| `sort_order`          | integer | no | 0       | CHECK >= 0. Orden de presentación y criterio estable al aplicar límites del plan |
| `created_at`          | text    | no   | —       | ISO 8601 UTC |
| `updated_at`          | text    | no   | —       | ISO 8601 UTC |

## Índices:
idx_services_specialty_id (specialty_id).  
idx_services_profile_specialty_name UNIQUE (profile_id, specialty_id, name COLLATE NOCASE).

## Referencias normativas
- **BR-010 a BR-013**, **BR-020**, **TR-006** y **TR-020 a TR-022**.

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_images**
Referencia a los archivos binarios almacenados en R2. Una imagen puede existir antes que el perfil: durante el alta se solicitan la foto y la portada cuando todavía no hay una fila en `profiles`.

## Datos
| Campo           | Tipo    | Nulo | Default  | Reglas y notas                                         |
| ---             | ---     | ---  | ---      | ---                                                     |
| `id`            | text    | no   | —        | PK. UUID v4 |
| `profile_id`    | text    | sí   | —        | FK → profiles.id ON DELETE CASCADE. NULL mientras la imagen no fue asociada a un perfil |
| `owner_user_id` | text    | no   | —        | FK → users.id ON DELETE CASCADE. Identifica quién subió el archivo y autoriza su eliminación |
| `storage_key`   | text    | no   | —        | Único. Clave en R2: profiles/<userId>/<kind>-<uuid>.<ext>. Se sirve mediante /media/<key> |
| `alt`           | text    | no   | ''       | Texto alternativo |
| `sort_order`      | integer | no   | 0        | Orden dentro de la galería |
| `kind`          | text    | no   | 'gallery' | CHECK IN ('avatar','cover','gallery') |
| `is_active`     | integer | no   | 1        | CHECK IN (0, 1). En galería, `0` indica que excede el cupo del plan |
| `created_at`    | text    | no   | —        | ISO 8601 UTC |
| `updated_at`    | text    | no   | —        | ISO 8601 UTC |

## Índices:
idx_profile_images_profile_sort (profile_id, sort_order).  
idx_profile_images_owner_kind (owner_user_id, kind).  
idx_profile_images_storage_key UNIQUE (storage_key).  
idx_profile_images_single_profile_kind UNIQUE (profile_id, kind) WHERE kind IN ('avatar','cover') AND profile_id IS NOT NULL.  
idx_profile_images_single_owner_kind UNIQUE (owner_user_id, kind) WHERE kind IN ('avatar','cover').

<hr style="height: 5px; background-color: gray; border: none;">

# **profile_schedule_entries**
Almacena hasta diez líneas de horario en texto libre por perfil. Este formato permite expresiones como «Martes de 08:00 a 19:00» o «Domingos: cerrado» sin imponer una estructura por día.

## Datos
| Campo        | Tipo    | Nulo | Default | Reglas y notas |
| ---          | ---     | ---   | ---     | --- |
| `id`         | text    | no    | —       | PK. UUID v4 |
| `profile_id` | text    | no    | —       | FK → profiles.id ON DELETE CASCADE |
| `text`       | text    | no    | —       | Línea de horario. Entre 3 y 120 caracteres. No admite teléfonos, correos, URLs ni HTML |
| `sort_order` | integer | no    | 0       | CHECK BETWEEN 0 AND 9. Orden dentro del horario |
| `created_at` | text    | no    | —       | ISO 8601 UTC |
| `updated_at` | text    | no    | —       | ISO 8601 UTC |

## Índices:
idx_profile_schedule_entries_profile_sort UNIQUE (profile_id, sort_order).

## Referencias normativas
- **BR-024**, **TR-005**, **TR-023** y **TR-024**.

<hr style="height: 5px; background-color: gray; border: none;">

# **plans**
Materializa la configuración de precios, límites y capacidades definida por BR-006 a BR-009.

## Datos
| Campo                         | Tipo    | Nulo | Default  | Reglas y notas |
| ---                           | ---     | ---   | ---      | --- |
| `id`                          | text    | no    | —        | PK. CHECK IN ('cobre','gold','platinum') |
| `name`                        | text    | no    | —        | Nombre mostrado en español |
| `price_cents`                 | integer | no    | 0        | CHECK >= 0. Precio expresado en centésimos de la moneda indicada |
| `currency`                    | text    | no    | 'UYU'    | CHECK IN ('UYU'). Código ISO 4217; se amplía el CHECK si se admiten otras monedas |
| `period`                      | text    | no    | 'month'  | CHECK IN ('month','year') |
| `rank`                        | integer | no    | —        | Único. CHECK > 0. Un valor mayor representa más capacidades |
| `max_service_sectors`         | integer | sí    | —        | CHECK IS NULL OR >= 0. Máximo de rubros distintos derivados de las especialidades activas |
| `max_specialties`             | integer | sí    | —        | CHECK IS NULL OR >= 0. Máximo de especialidades activas |
| `max_services`                | integer | sí    | —        | CHECK IS NULL OR >= 0. Máximo de servicios activos |
| `max_locations`               | integer | sí    | —        | CHECK IS NULL OR >= 0. Máximo de ubicaciones o sucursales físicas activas |
| `max_gallery_images`          | integer | sí    | —        | CHECK IS NULL OR >= 0. Máximo de imágenes de galería activas |
| `allows_social_links`         | integer | no    | 0        | CHECK IN (0, 1) |
| `allows_verification_request` | integer | no    | 0        | CHECK IN (0, 1). Permite solicitar la insignia comercial; no controla habilitaciones profesionales |
| `allows_featured_placement`   | integer | no    | 0        | CHECK IN (0, 1). Posiciones destacadas y rotativas |
| `allows_contact_form`         | integer | no    | 0        | CHECK IN (0, 1) |
| `allows_custom_landing`       | integer | no    | 0        | CHECK IN (0, 1) |
| `allows_subdomain`            | integer | no    | 0        | CHECK IN (0, 1) |
| `metrics_level`               | text    | no    | 'basic'  | CHECK IN ('basic','intermediate','advanced') |
| `created_at`                  | text    | no    | —        | ISO 8601 UTC |
| `updated_at`                  | text    | no    | —        | ISO 8601 UTC |

## Referencias normativas
- Valores iniciales y capacidades: **BR-006 a BR-009**.
- Configuración, cupos y cambios: **TR-014 a TR-016**.
- Los precios de Oro y Platino continúan pendientes según la sección 10 de `business_rules.md`.

## Índices:
idx_plans_rank UNIQUE (rank).

<hr style="height: 5px; background-color: gray; border: none;">

# **consumer_users**
Identidad de los clientes que buscan servicios y dejan opiniones. Está separada de `users` porque no comparte su ciclo de vida ni sus permisos y, por ahora, utiliza únicamente autenticación con Google.

## Datos
| Campo                   | Tipo | Nulo | Default  | Reglas y notas |
| ---                     | ---  | ---   | ---      | --- |
| `id`                    | text | no    | —        | PK. UUID v4 |
| `auth_provider`         | text | no    | 'google' | CHECK IN ('google') |
| `auth_provider_user_id` | text | no    | —        | Identificador `sub` de Google. Es estable aunque cambie el correo |
| `email`                 | text | no    | —        | Puede cambiar; no se utiliza como identidad externa |
| `display_name`          | text | no    | ''       | Se actualiza en cada ingreso con el nombre recibido desde Google |
| `avatar_url`            | text | no    | ''       | Se actualiza en cada ingreso con el avatar recibido desde Google |
| `status`                | text | no    | 'active' | CHECK IN ('active','suspended') |
| `created_at`            | text | no    | —        | ISO 8601 UTC |
| `updated_at`            | text | no    | —        | ISO 8601 UTC |

## Índices:
idx_consumer_users_provider_identity UNIQUE (auth_provider, auth_provider_user_id).  
idx_consumer_users_email (email COLLATE NOCASE).

<hr style="height: 5px; background-color: gray; border: none;">

# **consumer_sessions**
Mantiene las sesiones de clientes. Al igual que en `sessions`, el `id` es el hash SHA-256 del token y nunca se almacena el token en claro.

## Datos
| Campo        | Tipo | Nulo | Default | Reglas y notas |
| ---          | ---  | ---   | ---     | --- |
| `id`         | text | no    | —       | PK. Hash SHA-256 del token de sesión |
| `consumer_user_id` | text | no | —      | FK → consumer_users.id ON DELETE CASCADE |
| `expires_at` | text | no    | —       | ISO 8601 UTC. Expiración predeterminada: 90 días |
| `created_at` | text | no    | —       | ISO 8601 UTC |

## Índices:
idx_consumer_sessions_consumer_user_id (consumer_user_id).  
idx_consumer_sessions_expires_at (expires_at).

<hr style="height: 5px; background-color: gray; border: none;">

# **reviews**
Almacena opiniones y calificaciones sobre un perfil; los agregados correspondientes se materializan en `profiles`.

## Datos
| Campo         | Tipo    | Nulo | Default     | Reglas y notas |
| ---           | ---     | ---   | ---         | --- |
| `id`          | text    | no    | —           | PK. UUID v4 |
| `profile_id`  | text    | no    | —           | FK → profiles.id ON DELETE CASCADE |
| `consumer_user_id` | text | sí  | —           | FK → consumer_users.id ON DELETE SET NULL. NULL en opiniones importadas o de semilla |
| `author_name` | text    | no    | —           | Copia del nombre al escribir. Si existe `consumer_user_id`, al mostrar prevalece consumer_users.display_name |
| `rating`      | integer | no    | —           | CHECK BETWEEN 1 AND 5 |
| `comment`     | text    | no    | ''          | Texto de la opinión |
| `status`      | text    | no    | 'published' | CHECK IN ('published','hidden'). Sólo `published` se muestra y suma a la calificación |
| `created_at`  | text    | no    | —           | ISO 8601 UTC |
| `updated_at`  | text    | no    | —           | ISO 8601 UTC. Inicialmente igual a `created_at` |

## Índices:
idx_reviews_profile_status_created (profile_id, status, created_at DESC).  
idx_reviews_profile_consumer_user UNIQUE (profile_id, consumer_user_id) WHERE consumer_user_id IS NOT NULL.

## Referencias normativas
- **BR-026**, **TR-027**, **TR-028** y **TR-030**.

<hr style="height: 5px; background-color: gray; border: none;">

# **review_reports**
Registra reportes sobre opiniones sin borrar la opinión original. Cada reporte abre un proceso de revisión independiente.

## Datos
| Campo         | Tipo | Nulo | Default | Reglas y notas |
| ---           | ---  | ---   | ---     | --- |
| `id`          | text | no    | —       | PK. UUID v4 |
| `review_id`   | text | no    | —       | FK → reviews.id ON DELETE CASCADE |
| `consumer_user_id` | text | sí | —      | FK → consumer_users.id ON DELETE SET NULL. Se usa cuando reporta un cliente |
| `user_id`     | text | sí    | —       | FK → users.id ON DELETE SET NULL. Se usa cuando reporta un proveedor o administrador |
| `reason`      | text | no    | —       | CHECK IN ('spam','offensive','false_info','personal_info','conflict','other') |
| `detail`      | text | no    | ''      | Texto libre con detalles del reporte |
| `status`      | text | no    | 'open'  | CHECK IN ('open','upheld','dismissed') |
| `created_at`  | text | no    | —       | ISO 8601 UTC |
| `resolved_at` | text | sí    | —       | ISO 8601 UTC. NULL mientras el reporte está abierto |
| `resolved_by_user_id` | text | sí | —     | FK → users.id ON DELETE SET NULL. Administrador que resolvió el reporte |

## Índices:
idx_review_reports_review_status (review_id, status).  
idx_review_reports_consumer_user_id (consumer_user_id) WHERE consumer_user_id IS NOT NULL.  
idx_review_reports_user_id (user_id) WHERE user_id IS NOT NULL.  
idx_review_reports_resolved_by_user_id (resolved_by_user_id) WHERE resolved_by_user_id IS NOT NULL.  
idx_review_reports_review_consumer_user UNIQUE (review_id, consumer_user_id) WHERE consumer_user_id IS NOT NULL.  
idx_review_reports_review_user UNIQUE (review_id, user_id) WHERE user_id IS NOT NULL.

## Referencias normativas
- **BR-027**, **TR-029** y **TR-030**.

<hr style="height: 5px; background-color: gray; border: none;">

# Relaciones
- Un `user` puede tener un único `profile`; un `profile` pertenece a un único `user`.
- Un `user` puede mantener varias `sessions`; cada sesión pertenece a un único usuario.
- Un `profile` pertenece a un `plan`, y un plan puede estar asociado a muchos perfiles.
- Un `profile` puede aceptar varios medios de pago mediante `profile_payment_methods`.
- Un `profile` puede tener varios `profile_social_links`; cada enlace pertenece a un único perfil.
- `locations` forma una jerarquía autorreferenciada: Uruguay contiene departamentos y cada departamento contiene localidades.
- Un perfil puede tener cero o varias ubicaciones físicas mediante `profile_locations`.
- Un perfil puede prestar servicios en una o varias zonas mediante `profile_service_areas`.
- Un perfil puede utilizar varias modalidades y una modalidad puede corresponder a varios perfiles mediante `profile_service_modes`.
- Un rubro (`service_sector`) contiene muchas especialidades y cada especialidad pertenece a un único rubro.
- Un perfil puede tener muchas especialidades y una especialidad puede pertenecer a muchos perfiles mediante `profile_specialties`.
- Un perfil puede presentar varias habilitaciones mediante `professional_credentials`; cada una pertenece a una especialidad.
- Un perfil puede tener muchos servicios y cada servicio pertenece a un único perfil.
- Cada servicio pertenece a una especialidad seleccionada previamente por el perfil. La FK compuesta `(profile_id, specialty_id)` garantiza esta regla.
- Un perfil puede almacenar varias líneas de horario mediante `profile_schedule_entries`.
- No se necesita una tabla `profile_service_sectors`, porque los rubros del perfil se obtienen a través de sus especialidades.
- Un `consumer_user` puede mantener varias `consumer_sessions` y escribir opiniones.
- Un `profile` puede recibir muchas `reviews`.
- Una `review` puede recibir muchos `review_reports`; cada reporte puede pertenecer a un cliente o a un usuario proveedor/administrador.
