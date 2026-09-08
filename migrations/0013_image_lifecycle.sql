-- ---------------------------------------------------------------------------
-- TR-043: una imagen subida es temporal hasta que el formulario se guarda.
-- ---------------------------------------------------------------------------
--
-- Hasta ahora una imagen quedaba viva apenas se subía: si el alta se
-- abandonaba a mitad, la fila y el objeto de R2 se quedaban para siempre, y
-- si se cambiaba la foto de perfil en el formulario, la anterior se borraba
-- en ese momento — antes de guardar, y sin vuelta atrás si después se
-- cancelaba la edición.
--
-- Con esto una imagen nace `pending`, pertenece a quien la subió y expira
-- sola. Guardar el formulario la confirma; cancelar la deja expirar; la
-- limpieza automática se lleva lo que nadie confirmó.

-- 1. El estado de la imagen dentro del ciclo de vida.
--
--    `pending`  recién subida, todavía no la confirmó ningún guardado.
--    `confirmed` guardada con el formulario: es la que se muestra.
--    `discarded` marcada para limpieza; ya no se muestra en ningún lado.
--
--    Las filas que ya existen son de perfiles guardados, así que nacen
--    confirmadas: tratarlas como pendientes las haría desaparecer del perfil
--    y la limpieza las borraría.
ALTER TABLE profile_images ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'confirmed'
  CHECK (lifecycle IN ('pending', 'confirmed', 'discarded'));

-- 2. Cuándo deja de valer una imagen que nadie confirmó.
--
--    Sólo lo llevan las pendientes. En una confirmada es NULL: no expira.
ALTER TABLE profile_images ADD COLUMN expires_at TEXT;

-- 3. El tamaño de la versión procesada, para poder mostrarla sin que el
--    navegador tenga que descargarla para saber cuánto espacio reservarle.
ALTER TABLE profile_images ADD COLUMN width INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_images ADD COLUMN height INTEGER NOT NULL DEFAULT 0;

-- 4. La limpieza busca por estado y vencimiento: sin índice recorrería la
--    tabla entera en cada pasada.
CREATE INDEX idx_profile_images_expiry
  ON profile_images (lifecycle, expires_at)
  WHERE lifecycle = 'pending';

-- 5. El índice de unicidad de avatar y portada tiene que dejar convivir la
--    confirmada con la pendiente que la va a reemplazar: mientras se edita,
--    las dos existen a la vez y recién al guardar queda una.
--
--    El índice viejo no lo permitía, así que se rehace mirando sólo las
--    confirmadas. Las pendientes las limita la política del campo, no la base.
DROP INDEX IF EXISTS idx_profile_images_single_profile_kind;

CREATE UNIQUE INDEX idx_profile_images_single_profile_kind
  ON profile_images (profile_id, kind)
  WHERE kind IN ('avatar', 'cover')
    AND profile_id IS NOT NULL
    AND lifecycle = 'confirmed';
