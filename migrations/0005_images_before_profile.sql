-- ---------------------------------------------------------------------------
-- Imágenes cargadas antes de que exista el perfil
-- ---------------------------------------------------------------------------

/*
 * La foto de perfil y la portada se piden en el primer tramo del alta, cuando
 * todavía no hay fila en `providers`: el perfil recién se crea al final, con
 * el formulario completo. Hasta entonces las imágenes no tienen a quién
 * colgarse, y `provider_id` es NOT NULL con clave foránea.
 *
 * La subida se ancla entonces al usuario, que sí existe desde que entra al
 * panel, y al crear el perfil las filas se reclaman poniéndoles su id. Con
 * esto la imagen sobrevive a una recarga a mitad del alta, igual que el resto
 * del borrador, en vez de perderse por no tener dónde guardarse.
 *
 * SQLite no permite aflojar un NOT NULL con ALTER TABLE, así que la tabla se
 * rehace. Es la forma habitual en SQLite y acá no cuesta nada: `provider_id`
 * pasa a ser opcional y se suma `owner_user_id`, que es quien subió el
 * archivo y el único que puede borrarlo.
 */

CREATE TABLE provider_images_new (
  id            TEXT PRIMARY KEY,
  provider_id   TEXT REFERENCES providers (id) ON DELETE CASCADE,
  -- Quién subió el archivo. Se conserva después de reclamar la imagen: es lo
  -- que autoriza a borrarla sin tener que llegar hasta `providers`.
  owner_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  storage_key   TEXT NOT NULL,
  alt           TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL DEFAULT 0,
  kind          TEXT NOT NULL DEFAULT 'gallery'
                CHECK (kind IN ('avatar', 'cover', 'gallery')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    TEXT NOT NULL
);

-- Las imágenes que ya existían pertenecen al dueño de su perfil.
INSERT INTO provider_images_new (
  id, provider_id, owner_user_id, storage_key, alt, position, kind, active, created_at
)
SELECT i.id, i.provider_id, p.user_id, i.storage_key, i.alt, i.position,
       i.kind, i.active, i.created_at
  FROM provider_images i
  JOIN providers p ON p.id = i.provider_id;

DROP TABLE provider_images;
ALTER TABLE provider_images_new RENAME TO provider_images;

CREATE INDEX idx_provider_images_provider ON provider_images (provider_id, position);

/*
 * Una sola foto de perfil y una sola portada. Mientras la imagen no está
 * reclamada el par (provider_id, kind) tiene el id en NULL, y en SQLite dos
 * NULL no chocan entre sí: por eso el único por usuario, que es el que
 * ordena el tramo del alta. La galería no entra en ninguno de los dos.
 */
CREATE UNIQUE INDEX idx_provider_images_single
  ON provider_images (provider_id, kind)
  WHERE kind IN ('avatar', 'cover') AND provider_id IS NOT NULL;

CREATE UNIQUE INDEX idx_provider_images_single_owner
  ON provider_images (owner_user_id, kind)
  WHERE kind IN ('avatar', 'cover');

-- Reclamar las imágenes del alta busca por usuario y perfil todavía vacío.
CREATE INDEX idx_provider_images_owner ON provider_images (owner_user_id, kind);
