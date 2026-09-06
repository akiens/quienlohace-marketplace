-- ---------------------------------------------------------------------------
-- Precios provisionales para Oro y Platino
-- ---------------------------------------------------------------------------

/*
 * PROVISORIO. Estos importes son para poder probar el flujo de pago, no la
 * tarifa definitiva: hay que reemplazarlos por los reales antes de cobrarle a
 * nadie.
 *
 * Hasta ahora los tres planes valían 0. En Cobre eso significa "gratis"; en
 * Oro y Platino significaba "todavía sin definir" (BR-008, TR-014), y ese 0
 * los mantenía sin contratar —`isPurchasable()` los bloquea— y sin paso de
 * pago en el asistente, que se muestra sólo si `price_cents > 0`. Con un
 * precio cargado los dos planes quedan contratables y el paso aparece.
 *
 * El paso de pago sigue siendo un placeholder: no cobra ni consulta ninguna
 * pasarela, sólo deja constancia de que se revisó. Poner precio lo hace
 * visible; no lo convierte en un cobro real.
 *
 * Los importes se guardan en centavos y en UYU, que es lo único que admite la
 * columna (`CHECK (currency IN ('UYU'))`). Los valores de referencia eran 5 y
 * 20 dólares; se cargan como 5 y 20 en la moneda de la tabla en vez de
 * recrearla para admitir USD, porque son cifras temporales y el cambio de
 * moneda —si hace falta— conviene hacerlo junto con los precios definitivos.
 */

UPDATE plans SET price_cents = 500,  updated_at = '2026-09-06T00:00:00.000Z' WHERE id = 'gold';
UPDATE plans SET price_cents = 2000, updated_at = '2026-09-06T00:00:00.000Z' WHERE id = 'platinum';

-- Cobre no se toca: su 0 es "gratis" y así se queda.
