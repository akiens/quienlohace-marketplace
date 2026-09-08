-- ---------------------------------------------------------------------------
-- BR-015: una ubicación física es una localidad con dirección.
-- ---------------------------------------------------------------------------
--
-- El local dejó de admitir un departamento entero y la dirección dejó de ser
-- opcional: "todo Canelones" no es un lugar donde se pueda atender a alguien,
-- y una localidad sola ubica el pueblo pero no la puerta.
--
-- Quedan filas viejas que no cumplen: las que apuntan a un departamento —el
-- generador del seed sorteaba entre localidades y departamentos, ya
-- corregido— y alguna sin dirección, de cuando el campo era opcional.
--
-- Se corrige acá y no en el seed porque el seed sólo se aplica a una base
-- recién creada; esto tiene que alcanzar también a las que ya existen.

-- 1. El local que apunta a un departamento pasa a la capital de ese
--    departamento, que es el punto más cercano al dato original: se conserva
--    el departamento y sólo se precisa dentro de él.
--
--    La capital va escrita y no deducida. En 12 de los 19 el id de la capital
--    es `<depto>-<depto>` y bastaba con eso, pero en los otros 7 la capital se
--    llama distinto que su departamento (Lavalleja → Minas, Colonia → Colonia
--    del Sacramento). Caer a "la primera por nombre" habría mandado Colonia a
--    "Artilleros", que no es más correcto que lo que había.
UPDATE profile_locations
   SET location_id = CASE location_id
         WHEN 'artigas'        THEN 'artigas-artigas'
         WHEN 'canelones'      THEN 'canelones-canelones'
         WHEN 'cerro-largo'    THEN 'cerro-largo-melo'
         WHEN 'colonia'        THEN 'colonia-colonia-del-sacramento'
         WHEN 'durazno'        THEN 'durazno-durazno'
         WHEN 'flores'         THEN 'flores-trinidad'
         WHEN 'florida'        THEN 'florida-florida'
         WHEN 'lavalleja'      THEN 'lavalleja-minas'
         WHEN 'maldonado'      THEN 'maldonado-maldonado'
         WHEN 'montevideo'     THEN 'montevideo-montevideo'
         WHEN 'paysandu'       THEN 'paysandu-paysandu'
         WHEN 'rio-negro'      THEN 'rio-negro-fray-bentos'
         WHEN 'rivera'         THEN 'rivera-rivera'
         WHEN 'rocha'          THEN 'rocha-rocha'
         WHEN 'salto'          THEN 'salto-salto'
         WHEN 'san-jose'       THEN 'san-jose-san-jose-de-mayo'
         WHEN 'soriano'        THEN 'soriano-mercedes'
         WHEN 'tacuarembo'     THEN 'tacuarembo-tacuarembo'
         WHEN 'treinta-y-tres' THEN 'treinta-y-tres-treinta-y-tres'
         ELSE location_id
       END,
       updated_at = datetime('now')
 WHERE location_id IN (SELECT id FROM locations WHERE type = 'department');

-- 2. La dirección que falta se marca como pendiente en vez de inventarse: es
--    un dato que sólo conoce quien tiene el local. El texto es visible a
--    propósito —al editar el perfil se ve que hay algo que completar— y el
--    formulario lo pide igual antes de dejar guardar.
UPDATE profile_locations
   SET address = 'Dirección pendiente',
       updated_at = datetime('now')
 WHERE address IS NULL OR TRIM(address) = '';
