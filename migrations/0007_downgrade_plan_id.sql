-- ---------------------------------------------------------------------------
-- La baja pendiente tiene su propia columna
-- ---------------------------------------------------------------------------

/*
 * `pending_plan_id` servía para dos cosas a la vez: una subida esperando el
 * pago y una baja esperando el vencimiento. Eran estados distintos con reglas
 * distintas, y para saber cuál era había que comparar rangos en cada lectura.
 *
 * Ahora subir es inmediato —se activa y se corre el vencimiento—, así que no
 * hay nada pendiente de ese lado. Lo único que queda pendiente es la baja, y
 * merece una columna que diga exactamente eso: `downgrade_plan_id`, con NULL
 * como "no hay baja agendada".
 */

ALTER TABLE providers ADD COLUMN downgrade_plan_id TEXT
  CHECK (downgrade_plan_id IS NULL OR downgrade_plan_id IN ('cobre', 'gold', 'platinum'));

/*
 * Lo que había en `pending_plan_id` se traslada, pero sólo si era una baja:
 * las subidas pendientes ya no existen como estado — con el cambio inmediato,
 * una subida sin pagar deja de tener sentido y se descarta.
 *
 * El orden de los planes está escrito acá porque SQLite no tiene el `rank` a
 * mano sin unir con `plans`, y es el mismo orden de siempre: 1, 2, 3.
 */
UPDATE providers
   SET downgrade_plan_id = pending_plan_id
 WHERE pending_plan_id IS NOT NULL
   AND (CASE pending_plan_id WHEN 'cobre' THEN 1 WHEN 'gold' THEN 2 ELSE 3 END)
     < (CASE plan_id        WHEN 'cobre' THEN 1 WHEN 'gold' THEN 2 ELSE 3 END);

-- Las subidas que quedaron a medias se descartan: el plan vigente es el bueno.
UPDATE providers SET pending_plan_id = NULL;

-- Buscar las bajas que ya vencieron, que son las que hay que aplicar.
CREATE INDEX idx_providers_downgrade
  ON providers (downgrade_plan_id, plan_expires_at)
  WHERE downgrade_plan_id IS NOT NULL;
