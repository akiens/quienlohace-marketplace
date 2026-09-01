-- Nombres de los planes en español.
--
-- El público de QuienLoHace es hispanohablante y las insignias ya decían
-- COBRE/ORO/PLATINO, así que el nombre mostrado quedaba en otro idioma que su
-- propia imagen. Se cambia sólo `name`, que es lo que se muestra.
--
-- Los `id` siguen siendo 'cobre'/'gold'/'platinum': están en los CHECK de
-- `providers.plan_id`, en las semillas y en los enlaces `/planes#<id>`.
-- Renombrarlos obligaría a reescribir todo eso sin que el usuario note nada.
UPDATE plans SET name = 'Oro',     updated_at = '2026-09-01T00:00:00.000Z' WHERE id = 'gold';
UPDATE plans SET name = 'Platino', updated_at = '2026-09-01T00:00:00.000Z' WHERE id = 'platinum';
