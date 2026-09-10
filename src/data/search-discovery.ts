/**
 * Necesidades expresadas como problemas cotidianos que el catálogo por sí
 * solo no puede relacionar con seguridad. Cada destino es un servicio
 * canónico: estas reglas interpretan la consulta, no asignan oferta a nadie.
 */
export const SEARCH_NEEDS: Array<{
  patterns: string[];
  serviceIds: string[];
}> = [
  {
    patterns: ["no enfria", "prende pero no enfria", "enciende pero no enfria"],
    serviceIds: [
      "hogar-y-mantenimiento-climatizacion-reparacion-de-aire-acondicionado",
    ],
  },
  {
    patterns: ["canilla que gotea", "grifo que gotea", "pierde agua la canilla"],
    serviceIds: [
      "hogar-y-mantenimiento-plomeria-y-sanitaria-instalacion-y-reparacion-de-griferia",
    ],
  },
  {
    patterns: ["humedad en la pared", "humedad en pared", "manchas de humedad"],
    serviceIds: [
      "hogar-y-mantenimiento-pintura-tratamiento-antihumedad",
      "inmuebles-inspecciones-inspeccion-de-humedades-y-filtraciones",
    ],
  },
];

/** Alias de oficio que autorizan recuperar toda una especialidad. */
export const OCCUPATION_SPECIALTIES: Record<string, string> = {
  electricista: "hogar-y-mantenimiento-electricidad",
  electricidad: "hogar-y-mantenimiento-electricidad",
  plomero: "hogar-y-mantenimiento-plomeria-y-sanitaria",
  sanitaria: "hogar-y-mantenimiento-plomeria-y-sanitaria",
  sanitario: "hogar-y-mantenimiento-plomeria-y-sanitaria",
  climatizacion: "hogar-y-mantenimiento-climatizacion",
};
