-- ---------------------------------------------------------------------------
-- Cambios de plan: bajas programadas y retención de datos
-- ---------------------------------------------------------------------------

/*
 * Subir de plan y bajar de plan no son la misma operación.
 *
 * Subir se aplica al pagar: se cobra y las funciones nuevas quedan
 * disponibles en el momento. Eso ya se resuelve escribiendo `plan_id`.
 *
 * Bajar no puede aplicarse en el acto: el período que se pagó todavía corre,
 * y quitar las funciones antes de que termine sería cobrar por algo que se
 * dejó de dar. La baja se agenda: se guarda a qué plan se va y desde cuándo,
 * y hasta esa fecha sigue mandando el plan pago.
 */

-- Plan al que se pasa cuando termine el período pago. NULL si no hay ninguna
-- baja agendada, que es el caso normal.
ALTER TABLE providers ADD COLUMN pending_plan_id TEXT
  CHECK (pending_plan_id IS NULL OR pending_plan_id IN ('cobre', 'gold', 'platinum'));

/*
 * Hasta cuándo permanentemente se puede recuperar lo que quedó fuera del plan
 * nuevo.
 *
 * Al bajar de plan no se borra nada (RF-053): lo que excede queda inactivo y
 * vuelve solo si se recontrata. Pero guardar para siempre datos de alguien
 * que se fue tampoco corresponde, así que se anota una fecha a partir de la
 * cual se pueden borrar.
 *
 * Anotar la fecha y borrar son dos cosas distintas, y acá sólo se anota: el
 * borrado es una tarea aparte, que se ejecuta a conciencia y no como efecto
 * secundario de tocar un plan.
 */
ALTER TABLE providers ADD COLUMN purge_excess_after TEXT;

-- Buscar las bajas ya vencidas: las que hay que aplicar.
CREATE INDEX idx_providers_pending_plan
  ON providers (pending_plan_id, plan_expires_at)
  WHERE pending_plan_id IS NOT NULL;
