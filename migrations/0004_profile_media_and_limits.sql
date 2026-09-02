-- ---------------------------------------------------------------------------
-- Imágenes con rol, y datos que sobreviven a una baja de plan
-- ---------------------------------------------------------------------------

-- `provider_images` guardaba sólo galería. El perfil necesita además una foto
-- de perfil y una portada, que son distintas en cantidad (una de cada) y en
-- uso, pero comparten la subida a R2 y la tabla.
ALTER TABLE provider_images ADD COLUMN kind TEXT NOT NULL DEFAULT 'gallery'
  CHECK (kind IN ('avatar', 'cover', 'gallery'));

-- Una sola foto de perfil y una sola portada por proveedor. La galería no
-- entra en el índice: ahí sí puede haber varias.
CREATE UNIQUE INDEX idx_provider_images_single
  ON provider_images (provider_id, kind)
  WHERE kind IN ('avatar', 'cover');

/*
 * Al bajar de plan no se borra nada (RF-053): lo que excede el plan nuevo
 * queda guardado pero inactivo, para que vuelva solo si se recontrata el
 * plan anterior.
 *
 * Las consultas públicas filtran por `active = 1`; el panel muestra todo,
 * marcando lo que está fuera del plan.
 */
ALTER TABLE provider_images ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));
ALTER TABLE provider_services ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));
ALTER TABLE provider_service_areas ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));
ALTER TABLE provider_subcategories ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));
ALTER TABLE provider_team_members ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));
ALTER TABLE provider_social_links ADD COLUMN active INTEGER NOT NULL DEFAULT 1
  CHECK (active IN (0, 1));

-- El documento pide subtítulo por integrante; la tabla tenía sólo `role`.
ALTER TABLE provider_team_members ADD COLUMN subtitle TEXT NOT NULL DEFAULT '';
