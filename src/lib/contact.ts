import type { Provider } from "@/types";

/**
 * Enlaces de contacto directo. Contactar no requiere cuenta ni login:
 * es la conversión principal del marketplace.
 */

export function whatsappHref(provider: Provider, message?: string): string {
  const text =
    message ??
    `Hola ${provider.name}, te contacto desde QuienLoHace por el servicio de ${
      provider.services[0] ?? "tu especialidad"
    }.`;

  return `https://wa.me/${provider.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function phoneHref(provider: Provider): string {
  // tel: no admite espacios; el número se muestra formateado igual.
  return `tel:${provider.phone.replace(/\s+/g, "")}`;
}
