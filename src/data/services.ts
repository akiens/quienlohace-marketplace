import rawServices from "@/data/services.json";
import { getCategoryOfSubcategory, getSubcategory } from "@/data/categories";

/**
 * Catálogo de servicios: lo que un proveedor puede decir que hace.
 *
 * Se genera desde `docs/catalogo-servicios.md` con `npm run generate:services`.
 * El markdown es la fuente que se edita; el JSON, el resultado que lee el
 * sitio. Editarlo a mano se pierde en la próxima regeneración.
 *
 * La taxonomía del catálogo no es la del sitio: la correspondencia está en
 * `scripts/generate-services.ts`. Acá ya llega resuelta, con cada servicio
 * colgado de una subcategoría real.
 */
export type Service = {
  id: string;
  subcategoryId: string;
  name: string;
  /** Sinónimos y términos regionales. Sólo para buscar: nunca se muestran. */
  aliases: string[];
};

export const SERVICES = rawServices as Service[];

/**
 * Texto normalizado para comparar: sin tildes, en minúsculas y con los
 * espacios de más comidos.
 *
 * Sin esto "plomeria" no encontraría "plomería" y "Baños" no encontraría
 * "baños", que es exactamente como se escribe cuando se busca rápido.
 */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Un servicio con todo lo que hace falta para buscarlo y para mostrarlo,
 * calculado una vez al cargar el módulo.
 *
 * El contexto —subcategoría y categoría— se resuelve acá y no en cada
 * teclazo: son 633 servicios y hacerlo en el filtro significaría dos búsquedas
 * por servicio por letra tipeada.
 */
export type IndexedService = Service & {
  subcategoryName: string;
  categoryName: string;
  /** "Climatización · Hogar y mantenimiento", para mostrar bajo el nombre. */
  context: string;
  search: {
    name: string;
    aliases: string[];
    subcategory: string;
    category: string;
  };
};

export const SERVICE_INDEX: IndexedService[] = SERVICES.map((service) => {
  const subcategory = getSubcategory(service.subcategoryId);
  const category = getCategoryOfSubcategory(service.subcategoryId);

  const subcategoryName = subcategory?.name ?? "";
  const categoryName = category?.short ?? "";

  return {
    ...service,
    subcategoryName,
    categoryName,
    context: [subcategoryName, categoryName].filter(Boolean).join(" · "),
    search: {
      name: normalize(service.name),
      aliases: service.aliases.map(normalize),
      subcategory: normalize(subcategoryName),
      category: normalize(categoryName),
    },
  };
});

/**
 * Puntaje de un servicio contra lo tipeado. `null` es "no aparece".
 *
 * El orden sale del catálogo: primero lo que coincide con el nombre, después
 * con un alias, y al final el rubro. Dentro de cada grupo, la coincidencia
 * exacta gana al comienzo, y el comienzo a la aparición en el medio; así
 * "pintura" muestra "Pintura interior" antes que "Enduido y preparación de
 * paredes", que también la menciona.
 *
 * Números altos = más relevante, para poder ordenar de mayor a menor.
 */
function score(service: IndexedService, query: string): number | null {
  const { search } = service;

  if (search.name === query) return 100;
  if (search.name.startsWith(query)) return 90;

  if (search.aliases.some((alias) => alias === query)) return 80;

  // Alguna palabra del nombre empieza con lo tipeado: "aire" encuentra
  // "Instalación de aire acondicionado".
  if (search.name.split(" ").some((word) => word.startsWith(query))) return 70;

  if (search.aliases.some((alias) => alias.startsWith(query))) return 60;
  if (search.name.includes(query)) return 50;
  if (search.aliases.some((alias) => alias.includes(query))) return 40;

  // El rubro va último: coincide para todos los servicios que cuelgan de él,
  // así que como señal vale menos que cualquier coincidencia propia.
  if (search.subcategory.includes(query)) return 30;
  if (search.category.includes(query)) return 20;

  return null;
}

/**
 * Puntaje cuando lo tipeado son varias palabras.
 *
 * Buscar la frase entera como un bloque falla apenas el orden o alguna
 * palabra no coinciden literalmente: "corte de pelo" no encontraba "Corte de
 * cabello para hombre" —y es exactamente como se dice—. Acá cada palabra
 * busca por su cuenta y se pide que estén todas, sin importar el orden.
 *
 * Las palabras muy cortas y las de relleno ("de", "y", "para") no aportan a
 * distinguir nada: si se exigieran, "corte de pelo" quedaría atado a que el
 * nombre tenga un "de".
 */
const FILLER = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "para", "por", "con", "a", "en"]);

function scoreWords(service: IndexedService, words: string[]): number | null {
  const meaningful = words.filter((word) => !FILLER.has(word));
  const needles = meaningful.length > 0 ? meaningful : words;

  let total = 0;
  let matched = 0;
  for (const word of needles) {
    const points = score(service, word);
    if (points !== null) {
      total += points;
      matched += 1;
    }
  }

  /*
   * Al menos una palabra tiene que coincidir, y no puede ser de relleno: sin
   * eso cualquier servicio entraría por compartir una preposición.
   */
  if (matched === 0) return null;

  /*
   * Se pondera por cuánto de lo buscado apareció. Exigir todas las palabras
   * dejaba fuera lo que la gente escribe de verdad: "corte de pelo" contra
   * "Corte de cabello para hombre" comparte "corte" y nada más, y es el
   * resultado correcto. Pero coincidir en una de tres tiene que valer menos
   * que coincidir en tres de tres, o "corte" traería primero cualquier cosa
   * con "de".
   */
  return (total / needles.length) * (matched / needles.length);
}

/**
 * Busca servicios. Sin texto devuelve el catálogo entero desde el principio:
 * la lista completa es una opción válida, no un caso de error.
 *
 * `limit` corta el resultado porque la lista se rinde en el DOM: 633 opciones
 * a la vez cuestan más de lo que aportan cuando ya casi ninguna sirve.
 */
export function searchServices(
  query: string,
  {
    limit = 50,
    exclude = [],
    preferSubcategories = [],
  }: {
    limit?: number;
    exclude?: string[];
    /**
     * Los rubros que el proveedor ya declaró. Lo que cuelga de ellos va
     * primero: es lo que casi siempre está por agregar, y hacérselo buscar
     * entre 633 teniendo el rubro dicho sería pedirle que repita el dato.
     */
    preferSubcategories?: string[];
  } = {},
): IndexedService[] {
  const taken = new Set(exclude.map(normalize));
  const available = SERVICE_INDEX.filter(
    (service) => !taken.has(service.search.name),
  );

  const preferred = new Set(preferSubcategories);
  const isPreferred = (service: IndexedService): boolean =>
    preferred.has(service.subcategoryId);

  const normalized = normalize(query);

  /*
   * Sin texto: primero los rubros elegidos y después el resto.
   *
   * El corte por `limit` va al final y no antes de ordenar. Cortando primero
   * quedaban los 633 recortados a los 60 alfabéticamente iniciales, y recién
   * ahí se priorizaba: un cerrajero abría la lista y no veía ni uno de sus
   * servicios, porque los suyos no entraban en ese recorte.
   */
  if (!normalized) {
    if (preferred.size === 0) return available.slice(0, limit);

    return [
      ...available.filter(isPreferred),
      ...available.filter((service) => !isPreferred(service)),
    ].slice(0, limit);
  }

  const words = normalized.split(" ").filter(Boolean);

  const scored: Array<{ service: IndexedService; points: number }> = [];
  for (const service of available) {
    /*
     * Con una sola palabra alcanza el puntaje directo; con varias, cada una
     * tiene que aparecer en algún lado. Se prueba primero la frase entera:
     * quien escribe el nombre completo espera verlo primero, y eso sólo lo
     * da la coincidencia exacta.
     */
    const exact = score(service, normalized);
    const base =
      words.length > 1
        ? Math.max(exact ?? 0, scoreWords(service, words) ?? 0) || null
        : exact;

    if (base === null) continue;

    /*
     * Un empujón, no un atajo: entre dos servicios que coinciden parecido
     * gana el del rubro declarado, pero una coincidencia clara de otro rubro
     * sigue ganándole a una floja del propio. Por eso suma y no multiplica.
     */
    scored.push({
      service,
      points: isPreferred(service) ? base + 15 : base,
    });
  }

  scored.sort(
    (a, b) =>
      b.points - a.points || a.service.name.localeCompare(b.service.name, "es"),
  );

  return scored.slice(0, limit).map((entry) => entry.service);
}

/**
 * Los servicios de un rubro, para ofrecer primero lo que corresponde a lo que
 * el proveedor ya eligió.
 */
export function servicesForSubcategories(
  subcategoryIds: string[],
): IndexedService[] {
  const wanted = new Set(subcategoryIds);
  return SERVICE_INDEX.filter((service) => wanted.has(service.subcategoryId));
}
