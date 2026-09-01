/**
 * Normalización de teléfonos uruguayos (RF-013, RF-169).
 *
 * El formulario pide un solo número. De ahí salen los dos usos: el enlace
 * `tel:` y el de `wa.me`, que necesita el número sin signos y con código de
 * país. Pedirlo dos veces era pedir el mismo dato dos veces y arriesgar que
 * no coincidieran.
 */

/** Código de país de Uruguay, sin `+`. */
const UY_COUNTRY_CODE = "598";

/** Sólo los dígitos: es lo que entiende wa.me. */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * Lleva un número escrito como se escribe acá a formato E.164.
 *
 * Acepta `099 123 456`, `+598 99 123 456` y `59899123456`. Si ya trae el
 * código de país se respeta; si empieza con el 0 de larga distancia
 * nacional, ese 0 se descarta antes de anteponer el código.
 *
 * Devuelve `""` cuando no hay suficientes dígitos para ser un teléfono: es
 * mejor guardar vacío que un número que no se puede llamar.
 */
export function toE164(input: string): string {
  const digits = phoneDigits(input);
  if (digits.length === 0) return "";

  if (digits.startsWith(UY_COUNTRY_CODE)) {
    const rest = digits.slice(UY_COUNTRY_CODE.length);
    return rest.length >= 8 ? `+${digits}` : "";
  }

  // El 0 inicial es de marcación nacional y no forma parte del número.
  const local = digits.startsWith("0") ? digits.slice(1) : digits;
  return local.length >= 8 ? `+${UY_COUNTRY_CODE}${local}` : "";
}

/** El número para `wa.me`: E.164 sin el `+`. */
export function toWhatsapp(input: string): string {
  return toE164(input).replace("+", "");
}
