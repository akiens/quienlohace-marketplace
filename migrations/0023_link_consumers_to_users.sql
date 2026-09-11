-- Una persona puede empezar como cliente que deja opiniones y más adelante
-- crear una cuenta profesional (o hacerlo en el orden contrario). Ambos
-- registros conservan ciclos de vida y permisos distintos, pero pueden quedar
-- vinculados cuando la misma identidad estable de Google demuestra que
-- pertenecen a la misma persona.
--
-- El vínculo es deliberadamente nullable y usa ON DELETE SET NULL: borrar una
-- cuenta profesional nunca borra la identidad de cliente ni sus opiniones.

ALTER TABLE consumer_users
  ADD COLUMN user_id TEXT REFERENCES users (id) ON DELETE SET NULL;

-- Una cuenta profesional sólo puede representar una identidad de cliente.
-- NULL no participa del índice y mantiene independientes a quienes únicamente
-- usan QuienLoHace para opinar.
CREATE UNIQUE INDEX idx_consumer_users_user_id
  ON consumer_users (user_id) WHERE user_id IS NOT NULL;

-- Une datos ya existentes cuando ambos lados tienen el mismo `sub` de Google.
UPDATE consumer_users
   SET user_id = (
         SELECT oauth.user_id
           FROM user_oauth_identities oauth
          WHERE oauth.auth_provider = consumer_users.auth_provider
            AND oauth.provider_user_id = consumer_users.auth_provider_user_id
       ),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE EXISTS (
         SELECT 1
           FROM user_oauth_identities oauth
          WHERE oauth.auth_provider = consumer_users.auth_provider
            AND oauth.provider_user_id = consumer_users.auth_provider_user_id
       );
