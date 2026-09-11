/**
 * Datos comerciales plausibles para las cartas del seed.
 *
 * No pretenden ser un tarifario: son importes ficticios en pesos uruguayos
 * pensados para que una consulta, una clase y una obra no reciban el mismo
 * rango al azar. Las bandas por rubro dan una base estable y las reglas por
 * nombre afinan los casos que tienen una unidad de trabajo reconocible.
 */
import type { Faker } from "@faker-js/faker";

import type {
  ServiceCardPriceKind,
  ServiceCardTier,
  ServiceModeCode,
} from "../src/types";

type WeightedPriceKind = { weight: number; value: ServiceCardPriceKind };

type OfferPreset = {
  minPricePesos: number;
  maxPricePesos: number;
  durations: number[];
  durationAdditions: number[];
  modes: ServiceModeCode[];
  priceKinds: WeightedPriceKind[];
  includes: string;
};

const FIXED_HEAVY: WeightedPriceKind[] = [
  { weight: 10, value: "quote" },
  { weight: 50, value: "fixed" },
  { weight: 25, value: "from" },
  { weight: 15, value: "range" },
];

const FLEXIBLE: WeightedPriceKind[] = [
  { weight: 20, value: "quote" },
  { weight: 25, value: "fixed" },
  { weight: 30, value: "from" },
  { weight: 25, value: "range" },
];

const QUOTE_HEAVY: WeightedPriceKind[] = [
  { weight: 50, value: "quote" },
  { weight: 8, value: "fixed" },
  { weight: 27, value: "from" },
  { weight: 15, value: "range" },
];

const HOURLY_OR_QUOTE: WeightedPriceKind[] = [
  { weight: 35, value: "quote" },
  { weight: 15, value: "fixed" },
  { weight: 35, value: "from" },
  { weight: 15, value: "range" },
];

/** Bandas amplias por rubro, expresadas en pesos (no centésimos). */
const SECTOR_PRESETS: Record<string, OfferPreset> = {
  "hogar-y-mantenimiento": {
    minPricePesos: 1_800,
    maxPricePesos: 22_000,
    durations: [60, 90, 120, 240, 480],
    durationAdditions: [60, 120, 240, 480],
    modes: ["at_customer", "at_business"],
    priceKinds: FLEXIBLE,
    includes: "evaluación inicial, mano de obra y detalle separado de materiales",
  },
  "reparaciones-y-servicio-tecnico": {
    minPricePesos: 1_200,
    maxPricePesos: 12_000,
    durations: [30, 60, 90, 120, 240],
    durationAdditions: [30, 60, 120, 240],
    modes: ["at_business", "at_customer", "remote"],
    priceKinds: FLEXIBLE,
    includes: "diagnóstico, mano de obra y confirmación del costo de repuestos antes de cambiarlos",
  },
  limpieza: {
    minPricePesos: 1_200,
    maxPricePesos: 9_000,
    durations: [120, 180, 240, 360, 480],
    durationAdditions: [60, 120, 240],
    modes: ["at_customer", "at_business"],
    priceKinds: FIXED_HEAVY,
    includes: "insumos básicos, tareas acordadas y repaso final de los ambientes",
  },
  "mudanzas-y-transporte": {
    minPricePesos: 3_500,
    maxPricePesos: 35_000,
    durations: [60, 120, 240, 480],
    durationAdditions: [60, 120, 240, 480],
    modes: ["at_customer", "at_business"],
    priceKinds: QUOTE_HEAVY,
    includes: "coordinación del recorrido, carga y descarga dentro del alcance acordado",
  },
  automotor: {
    minPricePesos: 1_500,
    maxPricePesos: 24_000,
    durations: [30, 60, 90, 120, 240, 480],
    durationAdditions: [30, 60, 120, 240],
    modes: ["at_business", "at_customer"],
    priceKinds: FLEXIBLE,
    includes: "revisión del vehículo, mano de obra y autorización previa para repuestos adicionales",
  },
  salud: {
    minPricePesos: 1_500,
    maxPricePesos: 6_500,
    durations: [30, 45, 60, 90],
    durationAdditions: [15, 30, 60],
    modes: ["at_business", "remote", "at_customer"],
    priceKinds: FIXED_HEAVY,
    includes: "entrevista inicial, evaluación profesional y pautas de seguimiento",
  },
  "belleza-y-bienestar": {
    minPricePesos: 700,
    maxPricePesos: 7_500,
    durations: [30, 45, 60, 90, 120, 180],
    durationAdditions: [15, 30, 60],
    modes: ["at_business", "at_customer"],
    priceKinds: FIXED_HEAVY,
    includes: "consulta previa, preparación y terminación del tratamiento elegido",
  },
  "fitness-y-deportes": {
    minPricePesos: 700,
    maxPricePesos: 5_000,
    durations: [45, 60, 90, 120],
    durationAdditions: [15, 30, 60],
    modes: ["at_business", "at_customer", "remote"],
    priceKinds: FIXED_HEAVY,
    includes: "evaluación inicial, actividad guiada y recomendaciones para continuar",
  },
  "servicios-profesionales": {
    minPricePesos: 2_500,
    maxPricePesos: 32_000,
    durations: [45, 60, 90, 120, 240, 480],
    durationAdditions: [30, 60, 120, 240],
    modes: ["remote", "at_business", "at_customer"],
    priceKinds: HOURLY_OR_QUOTE,
    includes: "relevamiento, análisis y entrega de las conclusiones o documentos acordados",
  },
  tecnologia: {
    minPricePesos: 4_000,
    maxPricePesos: 85_000,
    durations: [60, 120, 240, 480, 960, 2_400],
    durationAdditions: [60, 240, 480, 1_440],
    modes: ["remote", "at_business", "at_customer"],
    priceKinds: QUOTE_HEAVY,
    includes: "relevamiento técnico, implementación y una instancia de revisión de la entrega",
  },
  "marketing-y-diseno": {
    minPricePesos: 3_500,
    maxPricePesos: 55_000,
    durations: [60, 120, 240, 480, 960],
    durationAdditions: [60, 240, 480, 1_440],
    modes: ["remote", "at_business", "at_customer"],
    priceKinds: QUOTE_HEAVY,
    includes: "brief inicial, producción de la pieza o campaña y una ronda de ajustes",
  },
  "educacion-y-clases": {
    minPricePesos: 650,
    maxPricePesos: 3_200,
    durations: [45, 60, 90, 120],
    durationAdditions: [15, 30, 60],
    modes: ["remote", "at_customer", "at_business"],
    priceKinds: FIXED_HEAVY,
    includes: "encuentro personalizado, material de apoyo y orientación para practicar",
  },
  eventos: {
    minPricePesos: 7_000,
    maxPricePesos: 90_000,
    durations: [120, 240, 360, 480, 720],
    durationAdditions: [60, 120, 240, 480],
    modes: ["at_customer", "at_business", "remote"],
    priceKinds: QUOTE_HEAVY,
    includes: "coordinación previa, montaje o preparación y cobertura durante el tiempo contratado",
  },
  inmuebles: {
    minPricePesos: 3_000,
    maxPricePesos: 45_000,
    durations: [60, 90, 120, 240, 480],
    durationAdditions: [30, 60, 120, 240],
    modes: ["at_customer", "at_business", "remote"],
    priceKinds: QUOTE_HEAVY,
    includes: "relevamiento del inmueble, análisis y entrega del informe o gestión acordada",
  },
  mascotas: {
    minPricePesos: 700,
    maxPricePesos: 8_000,
    durations: [30, 45, 60, 90, 120],
    durationAdditions: [15, 30, 60],
    modes: ["at_business", "at_customer"],
    priceKinds: FIXED_HEAVY,
    includes: "evaluación inicial de la mascota, servicio acordado e indicaciones para el cuidado posterior",
  },
  "cuidado-y-asistencia": {
    minPricePesos: 900,
    maxPricePesos: 8_500,
    durations: [120, 240, 360, 480, 720],
    durationAdditions: [60, 120, 240, 480],
    modes: ["at_customer"],
    priceKinds: FLEXIBLE,
    includes: "coordinación previa, acompañamiento durante el período acordado y reporte a la familia",
  },
  gastronomia: {
    minPricePesos: 4_000,
    maxPricePesos: 85_000,
    durations: [120, 240, 360, 480],
    durationAdditions: [60, 120, 240],
    modes: ["at_customer", "at_business"],
    priceKinds: QUOTE_HEAVY,
    includes: "planificación del menú, elaboración y coordinación de la entrega o servicio",
  },
  turismo: {
    minPricePesos: 1_200,
    maxPricePesos: 18_000,
    durations: [90, 120, 240, 360, 480],
    durationAdditions: [60, 120, 240],
    modes: ["at_customer", "at_business", "remote"],
    priceKinds: FIXED_HEAVY,
    includes: "coordinación del punto de encuentro, actividad guiada y recomendaciones locales",
  },
  "servicios-rurales": {
    minPricePesos: 5_000,
    maxPricePesos: 110_000,
    durations: [240, 480, 720, 1_440, 2_880],
    durationAdditions: [120, 240, 480, 1_440],
    modes: ["at_customer", "at_business"],
    priceKinds: QUOTE_HEAVY,
    includes: "visita o coordinación de campo, personal y maquinaria definidos en el presupuesto",
  },
  seguridad: {
    minPricePesos: 2_500,
    maxPricePesos: 48_000,
    durations: [60, 120, 240, 480, 720],
    durationAdditions: [60, 120, 240, 480],
    modes: ["at_customer", "at_business", "remote"],
    priceKinds: QUOTE_HEAVY,
    includes: "relevamiento de riesgos, instalación o cobertura acordada y prueba final del servicio",
  },
};

const FALLBACK_PRESET: OfferPreset = {
  minPricePesos: 1_500,
  maxPricePesos: 15_000,
  durations: [60, 90, 120, 240],
  durationAdditions: [30, 60, 120],
  modes: ["at_customer", "at_business", "remote"],
  priceKinds: FLEXIBLE,
  includes: "coordinación previa, realización del trabajo y confirmación final del alcance",
};

type OfferOverride = {
  pattern: RegExp;
  values: Partial<
    Pick<
      OfferPreset,
      | "minPricePesos"
      | "maxPricePesos"
      | "durations"
      | "durationAdditions"
      | "priceKinds"
    >
  >;
};

/** Reglas de mayor especificidad que las bandas de rubro. */
const OFFER_OVERRIDES: OfferOverride[] = [
  {
    pattern: /\b(clase|clases|tutoria|apoyo escolar|entrenamiento personal|yoga|pilates)\b/,
    values: {
      minPricePesos: 600,
      maxPricePesos: 2_800,
      durations: [45, 60, 90, 120],
      durationAdditions: [15, 30, 60],
      priceKinds: FIXED_HEAVY,
    },
  },
  {
    pattern: /\b(consulta|evaluacion|diagnostico|asesoramiento|orientacion|certificacion|tasacion|informe)\b/,
    values: {
      minPricePesos: 1_200,
      maxPricePesos: 9_500,
      durations: [30, 45, 60, 90, 120],
      durationAdditions: [15, 30, 60],
      priceKinds: FIXED_HEAVY,
    },
  },
  {
    pattern: /\b(corte|barba|manicura|pedicura|depilacion|masaje|limpieza facial|pestanas|cejas)\b/,
    values: {
      minPricePesos: 650,
      maxPricePesos: 4_800,
      durations: [30, 45, 60, 90, 120],
      durationAdditions: [15, 30, 60],
      priceKinds: FIXED_HEAVY,
    },
  },
  {
    pattern: /\b(urgencia|emergencia|auxilio|apertura de puertas|destape)\b/,
    values: {
      minPricePesos: 1_800,
      maxPricePesos: 8_500,
      durations: [30, 60, 90, 120],
      durationAdditions: [30, 60, 120],
      priceKinds: [
        { weight: 5, value: "quote" },
        { weight: 15, value: "fixed" },
        { weight: 55, value: "from" },
        { weight: 25, value: "range" },
      ],
    },
  },
  {
    pattern: /^(construccion|reforma|remodelacion|ampliacion)\b|\b(obra nueva|estructura metalica|perforacion de pozo)\b/,
    values: {
      minPricePesos: 18_000,
      maxPricePesos: 180_000,
      durations: [480, 960, 1_440, 2_880, 7_200],
      durationAdditions: [480, 1_440, 2_880, 7_200],
      priceKinds: QUOTE_HEAVY,
    },
  },
  {
    pattern: /\b(tratamiento de agua de piscina|limpieza de piscina|puesta a punto de temporada)\b/,
    values: {
      minPricePesos: 1_500,
      maxPricePesos: 8_500,
      durations: [60, 90, 120, 240],
      durationAdditions: [30, 60, 120],
      priceKinds: FIXED_HEAVY,
    },
  },
  {
    pattern: /\b(bicicletas?|pinchazo|cambio de aceite|cambio de bateria|copia y codificacion de llaves|lavado de automovil|lavado de motos)\b/,
    values: {
      minPricePesos: 600,
      maxPricePesos: 8_000,
      durations: [30, 45, 60, 90, 120],
      durationAdditions: [15, 30, 60],
      priceKinds: FIXED_HEAVY,
    },
  },
  {
    pattern: /\b(torta|tortas|cupcake|galletas|postre|panaderia|pasteleria|vianda|viandas|comidas congeladas)\b/,
    values: {
      minPricePesos: 800,
      maxPricePesos: 25_000,
      durations: [120, 240, 480, 960],
      durationAdditions: [60, 120, 240],
      priceKinds: [
        { weight: 10, value: "quote" },
        { weight: 35, value: "fixed" },
        { weight: 35, value: "from" },
        { weight: 20, value: "range" },
      ],
    },
  },
  {
    pattern: /\b(desarrollo|aplicacion movil|pagina web|tienda online|sistema de gestion|identidad de marca|produccion de video)\b/,
    values: {
      minPricePesos: 12_000,
      maxPricePesos: 140_000,
      durations: [480, 960, 2_400, 4_800],
      durationAdditions: [480, 1_440, 2_880],
      priceKinds: QUOTE_HEAVY,
    },
  },
  {
    pattern: /\b(mudanza|catering|casamiento|evento empresarial|quinceanero|fiesta)\b/,
    values: {
      minPricePesos: 8_000,
      maxPricePesos: 110_000,
      durations: [240, 480, 720],
      durationAdditions: [120, 240, 480],
      priceKinds: QUOTE_HEAVY,
    },
  },
  {
    pattern: /\b(reparacion|instalacion|mantenimiento|service)\b/,
    values: {
      minPricePesos: 1_500,
      maxPricePesos: 18_000,
      durations: [30, 60, 90, 120, 240, 480],
      durationAdditions: [30, 60, 120, 240],
      priceKinds: FLEXIBLE,
    },
  },
];

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function presetFor(sectorId: string, serviceName: string): OfferPreset {
  const sector = SECTOR_PRESETS[sectorId] ?? FALLBACK_PRESET;
  const override = OFFER_OVERRIDES.find(({ pattern }) =>
    pattern.test(normalized(serviceName)),
  );
  return override ? { ...sector, ...override.values } : sector;
}

function forcedMode(serviceName: string): ServiceModeCode | null {
  const name = normalized(serviceName);
  if (/\b(online|remoto|virtual|telemedicina)\b/.test(name)) return "remote";
  if (/\b(a domicilio|en domicilio|movil|traslado|transporte|mudanza)\b/.test(name)) {
    return "at_customer";
  }
  if (/\b(centro|clinica|consultorio|laboratorio|gimnasio|salon|spa|estudio|taller)\b/.test(name)) {
    return "at_business";
  }
  return null;
}

/** Modalidades coherentes para el perfil, incluyendo las exigidas por su oferta. */
export function profileServiceModes(
  faker: Faker,
  sectorId: string,
  serviceNames: string[],
): ServiceModeCode[] {
  const preset = SECTOR_PRESETS[sectorId] ?? FALLBACK_PRESET;
  const result = new Set<ServiceModeCode>();
  // La primera modalidad de cada rubro es la forma habitual de prestarlo:
  // domicilio para oficios, local para salud y remoto para tecnología. Las
  // restantes agregan perfiles híbridos sin producir combinaciones absurdas.
  result.add(preset.modes[0]!);

  for (const name of serviceNames) {
    const mode = forcedMode(name);
    if (mode && preset.modes.includes(mode)) result.add(mode);
  }

  for (const mode of preset.modes) {
    if (result.size >= 3) break;
    if (!result.has(mode) && faker.datatype.boolean({ probability: 0.35 })) {
      result.add(mode);
    }
  }
  return [...result];
}

function roundPesos(value: number): number {
  return Math.max(50, Math.round(value / 50) * 50);
}

function modeSentence(mode: ServiceModeCode): string {
  if (mode === "remote") return "Se realiza a distancia y se coordina la entrega por medios digitales";
  if (mode === "at_business") return "Se realiza en el local del proveedor con horario coordinado";
  return "Se realiza en el domicilio o lugar indicado dentro del área de cobertura";
}

function priceSentence(kind: ServiceCardPriceKind): string {
  if (kind === "quote") return "El precio final se confirma después de conocer el alcance";
  if (kind === "fixed") return "El importe corresponde al alcance publicado y cualquier adicional se acuerda antes";
  if (kind === "from") return "El precio publicado es una base y puede variar según complejidad o insumos";
  return "El rango cubre los casos habituales y se confirma antes de comenzar";
}

export type GeneratedServiceCardDetails = {
  description: string;
  priceKind: ServiceCardPriceKind;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  tier: ServiceCardTier;
  durationMinMinutes: number;
  durationMaxMinutes: number | null;
  serviceMode: ServiceModeCode;
};

/** Genera una oferta coherente y reproducible a partir del servicio concreto. */
export function serviceCardDetails(input: {
  faker: Faker;
  sectorId: string;
  serviceName: string;
  availableModes: ServiceModeCode[];
}): GeneratedServiceCardDetails {
  const { faker, sectorId, serviceName, availableModes } = input;
  const preset = presetFor(sectorId, serviceName);
  const tier = faker.helpers.weightedArrayElement<ServiceCardTier>([
    { weight: 24, value: "economy" },
    { weight: 56, value: "standard" },
    { weight: 20, value: "premium" },
  ]);
  const priceKind = faker.helpers.weightedArrayElement(preset.priceKinds);
  const preferredMode = forcedMode(serviceName);
  const compatibleModes = preset.modes.filter((mode) => availableModes.includes(mode));
  const serviceMode = preferredMode && availableModes.includes(preferredMode)
    ? preferredMode
    : faker.helpers.weightedArrayElement(
        (compatibleModes.length ? compatibleModes : availableModes).map(
          (value, index) => ({
            value,
            weight: index === 0 ? 60 : index === 1 ? 28 : 12,
          }),
        ),
      );

  const tierPercent = tier === "economy" ? 85 : tier === "premium" ? 140 : 105;
  const basePesos = roundPesos(
    faker.number.int({ min: preset.minPricePesos, max: preset.maxPricePesos }) *
      tierPercent / 100,
  );
  const rangeMaxPesos = roundPesos(
    basePesos * faker.number.int({ min: 120, max: 165 }) / 100,
  );
  const durationMinMinutes = faker.helpers.arrayElement(preset.durations);
  const durationMaxMinutes = faker.datatype.boolean({ probability: 0.62 })
    ? durationMinMinutes + faker.helpers.arrayElement(preset.durationAdditions)
    : null;

  return {
    description: `Incluye ${serviceName.toLowerCase()}, ${preset.includes}. ${modeSentence(serviceMode)}. ${priceSentence(priceKind)}.`,
    priceKind,
    priceMinCents: priceKind === "quote" ? null : basePesos * 100,
    priceMaxCents: priceKind === "range" ? rangeMaxPesos * 100 : null,
    tier,
    durationMinMinutes,
    durationMaxMinutes,
    serviceMode,
  };
}
