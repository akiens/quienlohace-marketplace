-- Pone la contraseña de prueba a todas las cuentas del seed.
-- GENERADO: no editar a mano. Regenerar con: npm run seed:generate
--
-- Contraseña: admin.123
--
-- Sirve para una base ya cargada, sin volver a insertar los datos.
-- Sólo toca los usuarios del seed (id LIKE 'seed-user-%').
--
-- Remoto: npm run db:password:remote

UPDATE users SET password_hash = 'pbkdf2:100000:031425364758697a8b9cadbecfe0f102:37e0962c7b67fc7efbef8aaa62d8091629a7a1c40fa412450f7ae98a9fb07fd3', updated_at = '2026-08-31T12:00:00.000Z' WHERE id LIKE 'seed-user-%';
