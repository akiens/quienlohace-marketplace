-- Índices de las dos tablas raíz que recorre la recuperación de candidatos.
-- Las relaciones consultadas por EXISTS ya tienen claves/índices con
-- profile_id a la izquierda desde 0008.

CREATE INDEX idx_profiles_public_search
  ON profiles (profile_status, type, plan_id, id);

CREATE INDEX idx_service_cards_public_search
  ON service_cards (is_active, is_published, profile_id, service_id, id);
