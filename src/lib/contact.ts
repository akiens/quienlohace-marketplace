import type { Profile } from "@/types";

/**
 * Enlaces de contacto directo. Contactar no requiere cuenta ni login: es la
 * conversión principal del marketplace.
 *
 * BR-004: el teléfono es un único dato y WhatsApp no se guarda aparte, así que
 * los dos enlaces salen de `phoneE164`. Ocultar el teléfono los deshabilita a
 * ambos, y por eso quien los muestra tiene que mirar `phonePublic` antes.
 */

export function whatsappHref(profile: Profile, message?: string): string {
  const text =
    message ??
    `Hola ${profile.name}, te contacto desde QuienLoHace por el servicio de ${
      profile.services[0]?.name ?? "tu especialidad"
    }.`;

  // `wa.me` quiere el número sin el "+" del formato E.164.
  return `https://wa.me/${profile.phoneE164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}

export function phoneHref(profile: Profile): string {
  // `tel:` no admite espacios; el número se muestra formateado igual.
  return `tel:${profile.phoneE164 || profile.phone.replace(/\s+/g, "")}`;
}

/**
 * BR-004: WhatsApp sólo se ofrece con un teléfono válido, público y habilitado
 * por el proveedor para ese uso.
 */
export function canUseWhatsapp(profile: Profile): boolean {
  return profile.whatsappEnabled && profile.phonePublic && profile.phoneE164 !== "";
}

/** BR-004: el teléfono se muestra sólo si el proveedor lo hizo público. */
export function canShowPhone(profile: Profile): boolean {
  return profile.phonePublic && profile.phone !== "";
}
