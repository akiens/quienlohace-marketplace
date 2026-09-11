-- Google como método de acceso opcional para cuentas de proveedor.
--
-- La identidad estable es `provider_user_id` (`sub` de OpenID Connect), no el
-- correo. El correo se conserva únicamente para auditoría y vinculación
-- inicial con una cuenta local que ya exista.
--
-- `users.password_hash = ''` representa una cuenta creada con Google que aún
-- no eligió contraseña. Conserva el NOT NULL del esquema actual; el adapter
-- nunca pasa ese valor a PBKDF2 y lo expone únicamente como `hasPassword`.

CREATE TABLE user_oauth_identities (
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  auth_provider    TEXT NOT NULL CHECK (auth_provider IN ('google')),
  provider_user_id TEXT NOT NULL,
  provider_email   TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,

  PRIMARY KEY (auth_provider, provider_user_id),
  UNIQUE (user_id, auth_provider)
);

CREATE INDEX idx_user_oauth_identities_user
  ON user_oauth_identities (user_id);
