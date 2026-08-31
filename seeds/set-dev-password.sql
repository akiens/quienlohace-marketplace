-- Pone la contraseña de prueba a todas las cuentas del seed.
-- GENERADO: no editar a mano. Regenerar con: npm run seed:generate
--
-- Contraseña: admin.123
--
-- Sirve para una base ya cargada, sin volver a insertar los datos.
-- Sólo toca los usuarios del seed (id LIKE 'seed-user-%').
--
-- Remoto: npm run db:password:remote

UPDATE users SET password_hash = 'pbkdf2:210000:031425364758697a8b9cadbecfe0f102:48bca13c0f127f1b54ccfde671c1983c0b489ad8b8c7d4455a8c23281edf0c34', updated_at = '2026-08-31T12:00:00.000Z' WHERE id LIKE 'seed-user-%';
