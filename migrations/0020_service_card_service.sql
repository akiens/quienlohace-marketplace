-- Cada carta representa una oferta concreta de uno de los servicios que el
-- perfil ya declaró. La FK evita relaciones huérfanas y, si se elimina ese
-- servicio, también deja de tener sentido conservar su carta.

ALTER TABLE service_cards
  ADD COLUMN service_id TEXT REFERENCES services (id) ON DELETE CASCADE;

-- Las cartas anteriores se asocian al primer servicio de su misma
-- especialidad. Los datos generados siempre tienen al menos uno.
UPDATE service_cards
   SET service_id = (
     SELECT s.id
       FROM services s
      WHERE s.profile_id = service_cards.profile_id
        AND s.specialty_id = service_cards.specialty_id
      ORDER BY s.is_active DESC, s.sort_order, s.created_at
      LIMIT 1
   );

CREATE INDEX idx_service_cards_service
  ON service_cards (service_id, is_active, is_published);

-- ALTER TABLE no permite agregar NOT NULL junto con una referencia en todas
-- las versiones de SQLite usadas por D1. Estos triggers mantienen el mismo
-- invariante para nuevas escrituras y actualizaciones.
CREATE TRIGGER service_cards_link_legacy_insert
AFTER INSERT ON service_cards
WHEN NEW.service_id IS NULL
BEGIN
  UPDATE service_cards
     SET service_id = (
       SELECT s.id FROM services s
        WHERE s.profile_id = NEW.profile_id
          AND s.specialty_id = NEW.specialty_id
        ORDER BY s.is_active DESC, s.sort_order, s.created_at LIMIT 1
     )
   WHERE id = NEW.id;
  SELECT RAISE(ABORT, 'service card requires service')
   WHERE (SELECT service_id FROM service_cards WHERE id = NEW.id) IS NULL;
END;

CREATE TRIGGER service_cards_require_service_update
BEFORE UPDATE OF service_id ON service_cards
WHEN NEW.service_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'service card requires service');
END;

CREATE TRIGGER service_cards_validate_service_insert
BEFORE INSERT ON service_cards
WHEN NEW.service_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM services s
     WHERE s.id = NEW.service_id AND s.profile_id = NEW.profile_id
  )
BEGIN
  SELECT RAISE(ABORT, 'service card service belongs to another profile');
END;

CREATE TRIGGER service_cards_validate_service_update
BEFORE UPDATE OF service_id, profile_id ON service_cards
WHEN NEW.service_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM services s
     WHERE s.id = NEW.service_id AND s.profile_id = NEW.profile_id
  )
BEGIN
  SELECT RAISE(ABORT, 'service card service belongs to another profile');
END;

-- `specialty_id` queda como columna de compatibilidad con las migraciones y
-- seeds anteriores, pero ya no es una relación elegida ni recibida por la
-- aplicación: siempre se deriva del servicio.
CREATE TRIGGER service_cards_sync_specialty
AFTER UPDATE OF service_id ON service_cards
WHEN NEW.service_id IS NOT NULL
BEGIN
  UPDATE service_cards
     SET specialty_id = (SELECT specialty_id FROM services WHERE id = NEW.service_id)
   WHERE id = NEW.id;
END;
