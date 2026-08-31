import type { Category, Subcategory } from "@/types";
import { slugify } from "@/lib/slug";

type CategorySeed = {
  name: string;
  short: string;
  icon: string;
  providerCount: number;
  subs: string[];
};

/** Taxonomía administrada: los proveedores seleccionan, no crean (RF-019). */
const SEED: CategorySeed[] = [
  { name: "Hogar, Construcción y Mantenimiento", short: "Hogar y mantenimiento", icon: "home_repair_service", providerCount: 486, subs: ["Plomería y sanitaria", "Electricidad", "Construcción", "Pintura", "Carpintería", "Herrería y metal", "Aberturas", "Climatización", "Jardinería", "Piscinas", "Control de plagas"] },
  { name: "Reparaciones y Servicio Técnico", short: "Reparaciones y servicio técnico", icon: "handyman", providerCount: 214, subs: ["Electrodomésticos", "Computación", "Celulares y tablets", "Televisión y audio", "Otros equipos"] },
  { name: "Limpieza y Servicios para el Hogar", short: "Limpieza", icon: "cleaning_services", providerCount: 168, subs: ["Limpieza doméstica", "Limpieza profunda", "Limpieza comercial", "Servicios domésticos"] },
  { name: "Mudanzas, Transporte y Logística", short: "Mudanzas y transporte", icon: "local_shipping", providerCount: 97, subs: ["Mudanzas", "Fletes", "Logística", "Transporte de personas"] },
  { name: "Automotor", short: "Automotor", icon: "directions_car", providerCount: 152, subs: ["Mecánica", "Electricidad automotriz", "Neumáticos", "Carrocería", "Estética automotriz", "Accesorios"] },
  { name: "Salud", short: "Salud", icon: "medical_services", providerCount: 331, subs: ["Medicina", "Odontología", "Salud mental", "Rehabilitación", "Nutrición", "Fonoaudiología", "Podología", "Enfermería", "Centros de salud"] },
  { name: "Belleza, Estética y Bienestar", short: "Belleza y bienestar", icon: "content_cut", providerCount: 289, subs: ["Peluquería", "Barbería", "Uñas", "Estética", "Masajes", "Tatuajes y piercing", "Centros"] },
  { name: "Fitness y Deportes", short: "Fitness y deportes", icon: "fitness_center", providerCount: 118, subs: ["Entrenamiento", "Gimnasios", "Yoga y pilates", "Deportes", "Clases deportivas"] },
  { name: "Servicios Profesionales y Empresariales", short: "Servicios profesionales", icon: "business_center", providerCount: 243, subs: ["Contabilidad", "Legal", "Administración", "Recursos humanos", "Consultoría", "Seguros"] },
  { name: "Tecnología", short: "Tecnología", icon: "computer", providerCount: 176, subs: ["Desarrollo", "Diseño web", "Soporte IT", "Datos", "Servicios digitales"] },
  { name: "Marketing, Diseño y Comunicación", short: "Marketing y diseño", icon: "campaign", providerCount: 141, subs: ["Marketing", "Social media", "Publicidad digital", "Diseño", "Audiovisual", "Comunicación"] },
  { name: "Educación y Clases", short: "Educación y clases", icon: "school", providerCount: 205, subs: ["Apoyo académico", "Idiomas", "Tecnología", "Música", "Arte", "Clases profesionales", "Academias"] },
  { name: "Eventos y Celebraciones", short: "Eventos", icon: "celebration", providerCount: 132, subs: ["Organización", "Fotografía y video", "Música", "Gastronomía", "Decoración", "Entretenimiento"] },
  { name: "Inmuebles y Propiedades", short: "Inmuebles", icon: "apartment", providerCount: 164, subs: ["Inmobiliarias", "Agentes inmobiliarios", "Administración", "Tasaciones", "Arquitectura", "Ingeniería", "Agrimensura", "Inspecciones"] },
  { name: "Mascotas", short: "Mascotas", icon: "pets", providerCount: 88, subs: ["Veterinaria", "Estética animal", "Cuidado", "Entrenamiento"] },
  { name: "Cuidado Personal y Asistencia", short: "Cuidado y asistencia", icon: "volunteer_activism", providerCount: 76, subs: ["Cuidado de niños", "Adultos mayores", "Personas con dependencia"] },
  { name: "Gastronomía y Alimentación", short: "Gastronomía", icon: "restaurant", providerCount: 121, subs: ["Catering", "Chef", "Repostería", "Viandas", "Bebidas y eventos", "Servicios móviles"] },
  { name: "Turismo y Experiencias", short: "Turismo", icon: "travel_explore", providerCount: 64, subs: ["Guías", "Tours", "Traslados", "Excursiones", "Experiencias"] },
  { name: "Servicios Rurales", short: "Servicios rurales", icon: "agriculture", providerCount: 52, subs: ["Servicios agrícolas", "Servicios ganaderos", "Veterinaria rural", "Infraestructura rural", "Maquinaria agrícola", "Apicultura"] },
  { name: "Seguridad", short: "Seguridad", icon: "shield", providerCount: 71, subs: ["Seguridad privada", "Alarmas", "Cámaras", "Control de acceso", "Cercos eléctricos", "Cerrajería", "Porteros y videoporteros"] },
];

export const CATEGORIES: Category[] = SEED.map((seed) => {
  const slug = slugify(seed.short);
  const subcategories: Subcategory[] = seed.subs.map((name) => ({
    id: `${slug}-${slugify(name)}`,
    slug: slugify(name),
    name,
  }));
  return {
    id: slug,
    slug,
    name: seed.name,
    short: seed.short,
    icon: seed.icon,
    providerCount: seed.providerCount,
    subcategories,
  };
});

const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
const SUBCATEGORY_BY_ID = new Map(
  CATEGORIES.flatMap((c) => c.subcategories.map((s) => [s.id, s] as const)),
);

export function getCategory(id: string): Category | undefined {
  return CATEGORY_BY_ID.get(id);
}

export function getSubcategory(id: string): Subcategory | undefined {
  return SUBCATEGORY_BY_ID.get(id);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** Categoría a la que pertenece una subcategoría. */
export function getCategoryOfSubcategory(
  subcategoryId: string,
): Category | undefined {
  return CATEGORIES.find((c) =>
    c.subcategories.some((s) => s.id === subcategoryId),
  );
}
