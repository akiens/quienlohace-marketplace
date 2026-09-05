import type { Profile } from "@/types";

/**
 * Requisitos de publicación (BR-003).
 *
 * Vive en el dominio y no en la Server Action porque lo necesitan los dos
 * lados: el servidor para decidir, y el panel para mostrar qué falta antes de
 * que se intente. Es la misma función, así que no pueden discrepar.
 *
 * Se evalúa siempre sobre el perfil guardado y nunca sobre lo que diga el
 * cliente (TR-006): publicar es la operación que más reglas cruza, y confiar
 * en un flag enviado desde el formulario sería dejar que el navegador decida.
 */

/**
 * Los requisitos que el perfil todavía no cumple, en el orden en que conviene
 * resolverlos. Vacío significa que se puede publicar.
 */
export function publishBlockers(profile: Profile): string[] {
  const missing: string[] = [];

  if (profile.name.trim() === "" || profile.description.trim() === "") {
    missing.push("Completá el nombre y la descripción de tu perfil.");
  }

  // BR-004: al menos un canal de contacto público.
  const hasPublicPhone = profile.phonePublic && profile.phoneE164 !== "";
  if (profile.contactEmail === "" && !hasPublicPhone) {
    missing.push("Dejá un correo de contacto o hacé público tu teléfono.");
  }

  if (profile.specialtyIds.length === 0) {
    missing.push("Elegí al menos una especialidad.");
  }

  if (profile.serviceModes.length === 0) {
    missing.push("Indicá cómo prestás el servicio.");
  }

  if (profile.serviceAreaIds.length === 0) {
    missing.push("Elegí al menos una zona donde trabajás.");
  }

  // BR-015: atender en el negocio exige un local activo.
  const activeLocations = profile.locations.filter(
    (location) => location.isActive,
  );
  if (
    profile.serviceModes.includes("at_business") &&
    activeLocations.length === 0
  ) {
    missing.push("Agregá la dirección de tu local para atender ahí.");
  }

  return missing;
}

/** BR-003: si no falta nada, el perfil puede publicarse. */
export function canPublish(profile: Profile): boolean {
  return publishBlockers(profile).length === 0;
}
