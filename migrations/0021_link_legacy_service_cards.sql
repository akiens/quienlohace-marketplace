-- Puede haber cartas conservadas de una especialidad activa para la que el
-- perfil ya no tiene ningún servicio. No se les asigna un servicio de otra
-- especialidad: se recupera su oferta como servicio del perfil y recién
-- entonces se establece la relación.

INSERT INTO services (
  id, profile_id, specialty_id, name, is_active, sort_order, created_at, updated_at
)
SELECT
  'legacy-card-service-' || MIN(sc.id),
  sc.profile_id,
  sc.specialty_id,
  MIN(sc.title),
  ps.is_active,
  COALESCE((
    SELECT MAX(existing.sort_order) + 1
      FROM services existing
     WHERE existing.profile_id = sc.profile_id
  ), 0),
  MIN(sc.created_at),
  MAX(sc.updated_at)
FROM service_cards sc
JOIN profile_specialties ps
  ON ps.profile_id = sc.profile_id AND ps.specialty_id = sc.specialty_id
WHERE sc.service_id IS NULL
GROUP BY sc.profile_id, sc.specialty_id, ps.is_active;

UPDATE service_cards
   SET service_id = (
     SELECT s.id
       FROM services s
      WHERE s.profile_id = service_cards.profile_id
        AND s.specialty_id = service_cards.specialty_id
      ORDER BY s.is_active DESC, s.sort_order, s.created_at
      LIMIT 1
   )
 WHERE service_id IS NULL;

