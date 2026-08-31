-- Vacía todas las tablas de datos.
--
-- Sirve para limpiar la base de pruebas antes de pasar al dominio definitivo,
-- o para volver a un estado conocido.
--
-- CUIDADO: borra usuarios, perfiles y opiniones. Contra `--remote` esto es
-- irreversible salvo por Time Travel (D1 guarda 7 días en plan gratuito,
-- 30 en pago).
--
-- Local:  wrangler d1 execute quienlohace --local  --file=./seeds/truncate.sql
-- Remoto: npm run db:reset:remote
--
-- No toca `d1_migrations`: el esquema queda aplicado y no hace falta volver
-- a migrar.

DELETE FROM provider_payment_methods;
DELETE FROM provider_service_areas;
DELETE FROM provider_services;
DELETE FROM provider_images;
DELETE FROM reviews;
DELETE FROM providers;
DELETE FROM sessions;
DELETE FROM users;
