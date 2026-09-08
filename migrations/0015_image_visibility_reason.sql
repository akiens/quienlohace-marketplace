-- ---------------------------------------------------------------------------
-- BR-009: por qué una imagen no se muestra decide si se puede borrar.
-- ---------------------------------------------------------------------------
--
-- `is_active = 0` responde "no se muestra", pero no dice por qué. Y hay dos
-- motivos que no significan lo mismo:
--
--   1. La ocultó el proveedor. Una foto de un servicio que por ahora no da y
--      que no quiere borrar. Es suya y no sobra: no se borra nunca.
--   2. No entra en el plan, después de una baja. Es un dato excedente, y
--      BR-009 permite eliminarlo a los 180 días de comunicada la baja.
--
-- Sin distinguirlos, una limpieza a 180 días se llevaría las fotos que
-- alguien ocultó a propósito estando en un plan que le alcanzaba —creyendo
-- que sólo las estaba escondiendo—. Ese es el borrado accidental que esta
-- columna existe para impedir.
--
-- `hidden_reason` sólo tiene sentido con `is_active = 0`:
--
--   NULL      la imagen se muestra.
--   'owner'   la ocultó el proveedor. No se borra nunca.
--   'plan'    no entra en el plan vigente. Borrable a los 180 días.

ALTER TABLE profile_images ADD COLUMN hidden_reason TEXT
  CHECK (hidden_reason IS NULL OR hidden_reason IN ('owner', 'plan'));

-- Cuándo dejó de entrar en el plan: de acá cuentan los 180 días de BR-009.
-- Sólo lo llevan las ocultas por plan.
ALTER TABLE profile_images ADD COLUMN hidden_at TEXT;

/*
 * Las filas que ya están inactivas lo quedaron por el recorte automático del
 * plan, que es lo único que las desactivaba hasta ahora. Se marcan como tales.
 *
 * `hidden_at` queda en NULL a propósito y no en la fecha de hoy: no se sabe
 * cuándo fue esa baja, y ponerle la de la migración arrancaría un plazo de
 * 180 días que nadie comunicó. La limpieza ignora las que no tienen fecha, y
 * la vuelve a poner el próximo recorte.
 */
UPDATE profile_images SET hidden_reason = 'plan' WHERE is_active = 0;

-- La limpieza busca por motivo y fecha: sin índice recorrería la tabla entera.
CREATE INDEX idx_profile_images_hidden
  ON profile_images (hidden_reason, hidden_at)
  WHERE hidden_reason = 'plan';
