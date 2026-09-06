import { sectorOfSpecialty } from "@/data/taxonomy";
import { limitFor } from "@/domain/plans";
import type { PlanLimits } from "@/types";

/**
 * Recorte de lo elegido al plan, para el alta.
 *
 * Distinto de `applyLimit` (BR-009), que se usa en un perfil ya creado: allá
 * lo que excede se conserva guardado e inactivo, porque quien pagó y baja de
 * plan no tiene por qué perder lo que había cargado —vuelve si recontrata—.
 *
 * En el asistente todavía no hay perfil ni nada guardado: lo elegido vive en
 * el borrador del navegador. Guardar de más ahí no protege a nadie y deja al
 * formulario mostrando especialidades que el plan no admite, con contadores
 * en rojo que no se pueden bajar sin adivinar cuáles sobran. Por eso acá se
 * recorta de verdad, y sólo después de avisarlo y que la persona acepte.
 *
 * El orden del recorte es el de la elección: se van las últimas entradas y
 * queda lo primero que se eligió, que es lo que la persona consideró
 * principal (TR-016).
 */

/** Lo que el asistente tiene elegido y depende del plan. */
export type PlanFitInput = {
  /** En orden de prioridad: la primera es la principal. */
  specialtyIds: string[];
  services: Array<{ specialtyId: string; name: string }>;
  locations: unknown[];
  socialLinks: unknown[];
};

export type PlanFitResult<T extends PlanFitInput> = {
  /** Lo que entra en el plan, ya recortado. */
  fitted: T;
  /** Qué se pierde, en palabras, para el aviso previo. */
  losses: string[];
};

/**
 * Qué rubros sobreviven al tope: los de las especialidades ya elegidas, en
 * orden de aparición, hasta llenar el cupo.
 *
 * Se recortan los rubros antes que las especialidades porque un rubro de más
 * arrastra todas sus especialidades: bajar primero por especialidad podría
 * dejar el rubro sobrante con una sola y seguir sin entrar en el tope.
 */
function keptSectors(specialtyIds: string[], max: number | null): Set<string> {
  const sectors: string[] = [];
  for (const id of specialtyIds) {
    const sector = sectorOfSpecialty(id);
    if (sector && !sectors.includes(sector.id)) sectors.push(sector.id);
  }
  return new Set(max === null ? sectors : sectors.slice(0, max));
}

/**
 * Recorta lo elegido a lo que el plan admite y dice qué queda fuera.
 *
 * Devuelve el mismo objeto cuando no sobra nada: así quien llama puede
 * comparar por identidad para saber si hace falta avisar.
 */
export function fitToPlan<T extends PlanFitInput>(
  selection: T,
  plan: PlanLimits,
): PlanFitResult<T> {
  const losses: string[] = [];

  const sectors = keptSectors(
    selection.specialtyIds,
    limitFor(plan, "serviceSectors"),
  );

  // Primero por rubro, después por cantidad: ver arriba.
  const withinSectors = selection.specialtyIds.filter((id) => {
    const sector = sectorOfSpecialty(id);
    return sector ? sectors.has(sector.id) : false;
  });

  const maxSpecialties = limitFor(plan, "specialties");
  const specialtyIds =
    maxSpecialties === null
      ? withinSectors
      : withinSectors.slice(0, maxSpecialties);

  const droppedSpecialties = selection.specialtyIds.length - specialtyIds.length;
  if (droppedSpecialties > 0) {
    const droppedSectors =
      new Set(
        selection.specialtyIds
          .map((id) => sectorOfSpecialty(id)?.id)
          .filter((id): id is string => id !== undefined),
      ).size - sectors.size;

    if (droppedSectors > 0) {
      losses.push(
        droppedSectors === 1 ? "1 rubro" : `${droppedSectors} rubros`,
      );
    }
    losses.push(
      droppedSpecialties === 1
        ? "1 especialidad"
        : `${droppedSpecialties} especialidades`,
    );
  }

  /*
   * Los servicios de una especialidad que se fue se van con ella (BR-010):
   * dejarlos huérfanos los haría rechazar por la FK compuesta al guardar.
   * Recién sobre lo que queda se aplica el tope de servicios.
   */
  const kept = new Set(specialtyIds);
  const withoutOrphans = selection.services.filter((service) =>
    kept.has(service.specialtyId),
  );

  /*
   * El tope se aplica cortando el final: `services` está en orden de agregado
   * —se acumula con `[...services, nuevo]`— así que los últimos del array son
   * los últimos que se agregaron, y son los que se van primero.
   *
   * Los servicios son texto libre y no salen necesariamente del catálogo
   * (TR-022), así que no hay ninguna otra jerarquía por la cual ordenarlos:
   * el orden en que se cargaron es la única señal de cuáles importan más, y
   * lo primero que alguien escribe es lo que más hace.
   */
  const maxServices = limitFor(plan, "services");
  const services =
    maxServices === null ? withoutOrphans : withoutOrphans.slice(0, maxServices);

  const droppedServices = selection.services.length - services.length;
  if (droppedServices > 0) {
    losses.push(
      droppedServices === 1 ? "1 servicio" : `${droppedServices} servicios`,
    );
  }

  const maxLocations = limitFor(plan, "locations");
  const locations =
    maxLocations === null
      ? selection.locations
      : selection.locations.slice(0, maxLocations);

  const droppedLocations = selection.locations.length - locations.length;
  if (droppedLocations > 0) {
    losses.push(
      droppedLocations === 1 ? "1 ubicación" : `${droppedLocations} ubicaciones`,
    );
  }

  // Las redes son todo o nada: el plan las incluye o no las incluye.
  const socialLinks = plan.allowsSocialLinks ? selection.socialLinks : [];
  const droppedSocial = selection.socialLinks.length - socialLinks.length;
  if (droppedSocial > 0) {
    losses.push(
      droppedSocial === 1
        ? "1 red social"
        : `${droppedSocial} redes sociales`,
    );
  }

  if (losses.length === 0) return { fitted: selection, losses };

  return {
    fitted: {
      ...selection,
      specialtyIds,
      services,
      locations,
      socialLinks,
    },
    losses,
  };
}
