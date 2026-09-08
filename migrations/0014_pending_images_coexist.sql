-- ---------------------------------------------------------------------------
-- TR-043: la imagen pendiente tiene que poder convivir con la confirmada.
-- ---------------------------------------------------------------------------
--
-- La 0013 rehízo el índice único de `(profile_id, kind)` para que mirara sólo
-- las confirmadas, pero quedó otro que hace lo mismo por dueño:
-- `idx_profile_images_single_owner_kind`, de la 0005, que existe porque
-- durante el alta todavía no hay `profile_id` y sin él nada limitaría a una
-- foto por usuario.
--
-- Ese índice no distingue estado, así que al subir una foto de perfil nueva
-- —con la anterior todavía confirmada, como pide TR-043— la segunda fila
-- chocaba:
--
--   UNIQUE constraint failed: profile_images.owner_user_id, profile_images.kind
--
-- El reemplazo se hace exactamente así: las dos conviven mientras se edita y
-- recién al guardar queda una. Se rehace con el mismo filtro que la 0013 le
-- puso a su par: la restricción vale entre confirmadas, y las pendientes las
-- limita la política del campo, que es quien sabe cuántas admite.

DROP INDEX IF EXISTS idx_profile_images_single_owner_kind;

CREATE UNIQUE INDEX idx_profile_images_single_owner_kind
  ON profile_images (owner_user_id, kind)
  WHERE kind IN ('avatar', 'cover')
    AND lifecycle = 'confirmed';
