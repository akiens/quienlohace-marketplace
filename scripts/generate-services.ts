/**
 * Genera `src/data/services.json` desde `docs/catalogo-servicios.md`.
 *
 * El catálogo se escribió con su propia división de subcategorías, que no es
 * la del sitio: agrupa distinto y abre rubros que acá no existen ("Yeso,
 * cielorrasos y construcción en seco", "Techos e impermeabilización").
 * Adoptarla movería los slugs de `/categorias/*`, las páginas ya generadas y
 * el `subcategory_id` guardado en cada perfil, así que va al revés: cada
 * subcategoría del catálogo se apoya en la del sitio que le corresponde, y
 * varias caen en la misma.
 *
 * `MAPPING` es esa correspondencia y es lo único que hay que tocar cuando el
 * catálogo crezca. Una subcategoría sin entrada corta el script: es preferible
 * fallar acá que publicar servicios colgados de un rubro equivocado.
 *
 * Se corre a mano (`npm run generate:services`) y el resultado se commitea: el
 * sitio lee el JSON, no el markdown.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CATEGORIES } from "../src/data/categories";
import { slugify } from "../src/lib/slug";

/**
 * Catálogo → sitio. La clave es "<número de categoría del documento>|<nombre
 * de la subcategoría del documento>"; el valor, el id de subcategoría del
 * sitio.
 */
const MAPPING: Record<string, string> = {
  // 1. Hogar, Construcción y Mantenimiento
  "1|Electricidad": "hogar-y-mantenimiento-electricidad",
  "1|Sanitaria y plomería": "hogar-y-mantenimiento-plomeria-y-sanitaria",
  "1|Albañilería y construcción": "hogar-y-mantenimiento-construccion",
  "1|Pintura": "hogar-y-mantenimiento-pintura",
  // Sin rubro propio de yeso: es obra seca, va con construcción.
  "1|Yeso, cielorrasos y construcción en seco":
    "hogar-y-mantenimiento-construccion",
  "1|Carpintería y muebles": "hogar-y-mantenimiento-carpinteria",
  "1|Herrería y aluminio": "hogar-y-mantenimiento-herreria-y-metal",
  // Techos e impermeabilización tampoco tiene rubro propio: también es obra.
  "1|Techos e impermeabilización": "hogar-y-mantenimiento-construccion",
  "1|Pisos y revestimientos": "hogar-y-mantenimiento-construccion",
  "1|Jardinería y exteriores": "hogar-y-mantenimiento-jardineria",

  // 2. Reparaciones y Servicio Técnico
  "2|Electrodomésticos": "reparaciones-y-servicio-tecnico-electrodomesticos",
  // En el sitio la climatización es rubro de Hogar, no de Reparaciones.
  "2|Climatización y calefacción": "hogar-y-mantenimiento-climatizacion",
  "2|Electrónica, TV y audio":
    "reparaciones-y-servicio-tecnico-television-y-audio",
  "2|Celulares y tablets": "reparaciones-y-servicio-tecnico-celulares-y-tablets",
  "2|Máquinas y herramientas": "reparaciones-y-servicio-tecnico-otros-equipos",

  // 3. Limpieza y Servicios para el Hogar
  "3|Limpieza doméstica": "limpieza-limpieza-domestica",
  "3|Limpieza comercial": "limpieza-limpieza-comercial",
  "3|Tapizados, alfombras y colchones": "limpieza-limpieza-profunda",
  // El control de plagas es rubro de Hogar en el sitio.
  "3|Control de plagas y saneamiento": "hogar-y-mantenimiento-control-de-plagas",
  "3|Servicios domésticos complementarios": "limpieza-servicios-domesticos",

  // 4. Mudanzas, Transporte y Logística
  "4|Mudanzas": "mudanzas-y-transporte-mudanzas",
  "4|Fletes y repartos": "mudanzas-y-transporte-fletes",
  "4|Transporte de pasajeros": "mudanzas-y-transporte-transporte-de-personas",

  // 5. Automotor
  "5|Mecánica": "automotor-mecanica",
  "5|Electricidad y electrónica automotriz": "automotor-electricidad-automotriz",
  "5|Neumáticos y auxilio": "automotor-neumaticos",
  "5|Chapa, pintura y estética": "automotor-carroceria",
  // Motos y bicis no tienen rubro propio: el taller es mecánica.
  "5|Motos y bicicletas": "automotor-mecanica",

  // 6. Salud
  "6|Medicina y atención clínica": "salud-medicina",
  "6|Odontología": "salud-odontologia",
  "6|Psicología y salud mental": "salud-salud-mental",
  "6|Rehabilitación y terapias": "salud-rehabilitacion",
  "6|Nutrición y cuidados de salud": "salud-nutricion",

  // 7. Belleza, Estética y Bienestar
  "7|Peluquería y barbería": "belleza-y-bienestar-peluqueria",
  "7|Manos, pies y maquillaje": "belleza-y-bienestar-unas",
  "7|Estética": "belleza-y-bienestar-estetica",
  "7|Bienestar integral": "belleza-y-bienestar-masajes",

  // 8. Fitness y Deportes
  "8|Entrenamiento": "fitness-y-deportes-entrenamiento",
  "8|Clases deportivas": "fitness-y-deportes-clases-deportivas",
  "8|Servicios para deportistas": "fitness-y-deportes-deportes",

  // 9. Servicios Profesionales y Empresariales
  "9|Contabilidad y administración": "servicios-profesionales-contabilidad",
  "9|Servicios jurídicos y notariales": "servicios-profesionales-legal",
  "9|Recursos humanos": "servicios-profesionales-recursos-humanos",
  "9|Consultoría y gestión": "servicios-profesionales-consultoria",

  // 10. Tecnología
  "10|Informática y computadoras": "tecnologia-soporte-it",
  "10|Redes y conectividad": "tecnologia-soporte-it",
  "10|Desarrollo y servicios digitales": "tecnologia-desarrollo",

  // 11. Marketing, Diseño y Comunicación
  "11|Diseño gráfico y marca": "marketing-y-diseno-diseno",
  "11|Marketing digital": "marketing-y-diseno-marketing",
  "11|Fotografía y audiovisual": "marketing-y-diseno-audiovisual",
  "11|Comunicación y contenidos": "marketing-y-diseno-comunicacion",

  // 12. Educación y Clases
  "12|Apoyo académico": "educacion-y-clases-apoyo-academico",
  "12|Idiomas": "educacion-y-clases-idiomas",
  "12|Arte y música": "educacion-y-clases-musica",
  "12|Capacitación práctica": "educacion-y-clases-clases-profesionales",

  // 13. Eventos y Celebraciones
  "13|Organización y coordinación": "eventos-organizacion",
  "13|Música y entretenimiento": "eventos-entretenimiento",
  "13|Decoración y equipamiento": "eventos-decoracion",
  "13|Foto y video para eventos": "eventos-fotografia-y-video",

  // 14. Inmuebles y Propiedades
  "14|Operaciones inmobiliarias": "inmuebles-inmobiliarias",
  "14|Arquitectura y obra": "inmuebles-arquitectura",
  "14|Agrimensura e inspección": "inmuebles-agrimensura",

  // 15. Mascotas
  "15|Salud animal": "mascotas-veterinaria",
  "15|Higiene y estética": "mascotas-estetica-animal",
  "15|Cuidado y entrenamiento": "mascotas-cuidado",

  // 16. Cuidado Personal y Asistencia
  "16|Personas mayores y dependencia": "cuidado-y-asistencia-adultos-mayores",
  "16|Infancia y familia": "cuidado-y-asistencia-cuidado-de-ninos",
  "16|Asistencia cotidiana": "cuidado-y-asistencia-personas-con-dependencia",

  // 17. Gastronomía y Alimentación
  "17|Comidas y catering": "gastronomia-catering",
  "17|Panadería y repostería": "gastronomia-reposteria",
  "17|Bebidas y servicios gastronómicos": "gastronomia-bebidas-y-eventos",

  // 18. Turismo y Experiencias
  "18|Guías y recorridos": "turismo-guias",
  "18|Traslados y planificación": "turismo-traslados",
  "18|Experiencias y actividades": "turismo-experiencias",

  // 19. Servicios Rurales
  "19|Maquinaria y labores": "servicios-rurales-servicios-agricolas",
  "19|Ganadería y animales": "servicios-rurales-servicios-ganaderos",
  "19|Asesoramiento y mantenimiento rural":
    "servicios-rurales-infraestructura-rural",

  // 20. Seguridad
  "20|Alarmas y videovigilancia": "seguridad-alarmas",
  "20|Cerrajería": "seguridad-cerrajeria",
  "20|Protección y prevención": "seguridad-seguridad-privada",
};

type ServiceEntry = {
  id: string;
  subcategoryId: string;
  name: string;
  aliases: string[];
};

const VALID_SUBCATEGORIES = new Set(
  CATEGORIES.flatMap((c) => c.subcategories.map((s) => s.id)),
);

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = readFileSync(
    resolve(here, "../docs/catalogo-servicios.md"),
    "utf8",
  );

  const services: ServiceEntry[] = [];
  const seen = new Set<string>();
  const problems: string[] = [];

  let categoryNumber = "";
  let subcategory = "";
  let inCatalog = false;

  for (const line of doc.split(/\r?\n/)) {
    // "# 1. Hogar, Construcción y Mantenimiento" abre una categoría.
    const cat = /^#\s+(\d+)\.\s+(.+)$/.exec(line);
    if (cat) {
      categoryNumber = cat[1] ?? "";
      subcategory = "";
      inCatalog = true;
      continue;
    }

    // Un encabezado de nivel 1 sin número cierra el catálogo: lo que sigue
    // (criterios, reglas de búsqueda) no son servicios.
    if (/^#\s+[^\d]/.test(line)) {
      inCatalog = false;
      continue;
    }

    const sub = /^##\s+(.+)$/.exec(line);
    if (sub) {
      subcategory = (sub[1] ?? "").trim();
      continue;
    }

    if (!inCatalog || !subcategory) continue;

    // "- Instalación eléctrica — alias: electricista, instalación de luz"
    const item = /^-\s+(.+)$/.exec(line);
    if (!item) continue;

    const [rawName, rawAliases] = (item[1] ?? "").split(/\s+—\s+alias:\s*/);
    const name = (rawName ?? "").trim();
    if (!name) continue;

    const key = `${categoryNumber}|${subcategory}`;
    const subcategoryId = MAPPING[key];
    if (!subcategoryId) {
      problems.push(`Sin mapeo: ${key}`);
      continue;
    }
    if (!VALID_SUBCATEGORIES.has(subcategoryId)) {
      problems.push(`Subcategoría inexistente: ${subcategoryId} (${key})`);
      continue;
    }

    const aliases = (rawAliases ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    /*
     * El id lleva la subcategoría del sitio adelante: dos servicios con el
     * mismo nombre en rubros distintos siguen siendo dos entradas, y el id
     * dice a cuál pertenece cada una.
     */
    const id = `${subcategoryId}-${slugify(name)}`;

    /*
     * Varias subcategorías del catálogo caen en la misma del sitio, así que
     * un nombre repetido entre ellas colisiona. Gana el primero y se
     * descartan los demás: son el mismo servicio contado dos veces.
     */
    if (seen.has(id)) continue;
    seen.add(id);

    services.push({ id, subcategoryId, name, aliases });
  }

  if (problems.length > 0) {
    console.error("El catálogo tiene entradas sin destino:\n");
    for (const p of [...new Set(problems)]) console.error(`  - ${p}`);
    process.exit(1);
  }

  // Ordenado por id: el diff de una regeneración muestra sólo lo que cambió.
  services.sort((a, b) => a.id.localeCompare(b.id, "es"));

  writeFileSync(
    resolve(here, "../src/data/services.json"),
    `${JSON.stringify(services, null, 2)}\n`,
    "utf8",
  );

  const bySub = new Set(services.map((s) => s.subcategoryId));
  console.log(`${services.length} servicios en ${bySub.size} subcategorías.`);
}

main();
