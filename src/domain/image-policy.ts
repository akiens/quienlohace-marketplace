/**
 * Las reglas de un campo de imagen: qué acepta, cuánto pesa, cómo se procesa.
 *
 * Es el único lugar donde se decide eso, y lo consultan las dos capas — el
 * navegador para avisar al instante, el servidor para decidir de verdad
 * (TR-039, TR-042). Un campo nuevo se agrega acá y no toca nada más.
 *
 * Sin `server-only`: esto lo lee también el cliente. No trae bindings ni
 * secretos, sólo números y listas.
 */

/** Formato de entrada aceptado, con su extensión y su firma binaria. */
export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

/**
 * Reglas de un campo de imagen.
 *
 * Todo es configurable por campo: la portada tolera más ancho que el avatar,
 * y la galería admite varias donde las otras admiten una.
 */
export type ImagePolicy = {
  /** Cuántas imágenes admite el campo. `null` es "las que permita el plan". */
  maxCount: number | null;
  /** Tope del archivo original, en bytes. */
  maxBytes: number;
  /** Formatos de entrada admitidos. */
  accept: readonly ImageFormat[];
  /** Lado más largo de la imagen ya procesada, en píxeles. */
  maxDimension: number;
  /**
   * Mínimo del original, en píxeles. Una imagen más chica que esto se ve
   * borrosa al ampliarla y conviene rechazarla antes de subirla.
   */
  minDimension: number;
  /**
   * Proporción a la que se recorta, `ancho / alto`. `null` mantiene la
   * original, que es lo que corresponde salvo que el campo dibuje un marco
   * fijo.
   */
  aspectRatio: number | null;
  /** Calidad de la recompresión, 1-100. */
  quality: number;
  /** Si el campo admite reordenar. Sólo tiene sentido con varias. */
  sortable: boolean;
};

/**
 * Tope duro de entrada, en bytes, por encima del cual ni se intenta procesar.
 *
 * Es la red de seguridad de la ruta: ninguna política puede pedir más que
 * esto. Protege de que un campo mal configurado deje pasar un archivo capaz
 * de agotar la memoria del worker al descomprimirse (TR-042).
 */
export const ABSOLUTE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Tope duro de píxeles del original: ancho × alto.
 *
 * Es la defensa contra la *decompression bomb*: un PNG de pocos kilobytes
 * puede declarar 30.000 × 30.000 y pedir gigabytes al descomprimirse. El peso
 * del archivo no alcanza para detectarlo — hay que mirar las dimensiones que
 * declara, antes de decodificarlo entero.
 */
export const ABSOLUTE_MAX_PIXELS = 50_000_000;

/** Extensión con la que se guarda cada formato de entrada. */
export const FORMAT_EXTENSIONS: Record<ImageFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Firma binaria de cada formato: los primeros bytes que lo identifican.
 *
 * El nombre, la extensión y el `Content-Type` los escribe quien sube y no
 * prueban nada (TR-042). Esto mira el archivo. No reemplaza a decodificarlo
 * —un JPEG con la cabecera correcta puede estar roto de la mitad en adelante—
 * pero descarta al instante lo que ni siquiera aparenta ser una imagen.
 */
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// "RIFF" .... "WEBP": los cuatro bytes del medio son el tamaño del archivo.
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50];

/**
 * El formato real de un archivo, leído de sus primeros bytes.
 *
 * `null` si no coincide con ninguno de los admitidos, que incluye a los que
 * se rechazan a propósito: SVG puede traer scripts y se serviría desde el
 * dominio del sitio; GIF anima y no es lo que estos campos quieren.
 */
export function sniffFormat(bytes: Uint8Array): ImageFormat | null {
  const matches = (magic: number[], offset: number) =>
    magic.every((byte, index) => bytes[offset + index] === byte);

  if (matches(JPEG_MAGIC, 0)) return "image/jpeg";
  if (matches(PNG_MAGIC, 0)) return "image/png";
  // WebP necesita las dos marcas: "RIFF" solo también lo usa un WAV.
  if (matches(RIFF_MAGIC, 0) && matches(WEBP_MAGIC, 8)) return "image/webp";

  return null;
}

/** Los formatos que toda política acepta, salvo que diga otra cosa. */
const DEFAULT_ACCEPT: readonly ImageFormat[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Las políticas por campo.
 *
 * Los campos del perfil y de sus cartas se declaran acá. Uno nuevo —el logo de una
 * empresa, la foto de una opinión— se agrega acá con sus números y el resto
 * del flujo funciona sin tocarse.
 */
export const IMAGE_POLICIES = {
  avatar: {
    maxCount: 1,
    maxBytes: 5 * 1024 * 1024,
    accept: DEFAULT_ACCEPT,
    // Se muestra a 104px y en la tarjeta de resultados: 1024 sobra para
    // pantallas de alta densidad y no justifica guardar más.
    maxDimension: 1024,
    minDimension: 200,
    // Cuadrada: el marco es un círculo y una foto apaisada se recortaría
    // sola, con el recorte decidido por el navegador en vez de por acá.
    aspectRatio: 1,
    quality: 85,
    sortable: false,
  },
  cover: {
    maxCount: 1,
    maxBytes: 5 * 1024 * 1024,
    accept: DEFAULT_ACCEPT,
    // Es una franja a lo ancho del encabezado del perfil.
    maxDimension: 1920,
    minDimension: 600,
    aspectRatio: 3,
    quality: 82,
    sortable: false,
  },
  gallery: {
    // `null`: el tope real lo pone el plan (BR-009), que se consulta al subir.
    maxCount: null,
    maxBytes: 5 * 1024 * 1024,
    accept: DEFAULT_ACCEPT,
    maxDimension: 1600,
    minDimension: 400,
    // La proporción la elige quien sube: son trabajos, y recortarlos a una
    // forma fija cortaría justo lo que se quiere mostrar.
    aspectRatio: null,
    quality: 82,
    sortable: true,
  },
  service: {
    // Una portada y hasta tres fotos de muestra por carta.
    maxCount: 4,
    maxBytes: 5 * 1024 * 1024,
    accept: DEFAULT_ACCEPT,
    maxDimension: 1600,
    minDimension: 400,
    aspectRatio: null,
    quality: 82,
    sortable: true,
  },
} as const satisfies Record<string, ImagePolicy>;

/** El nombre de un campo de imagen configurado. */
export type ImageField = keyof typeof IMAGE_POLICIES;

export function policyFor(field: ImageField): ImagePolicy {
  return IMAGE_POLICIES[field];
}

export function isImageField(value: string): value is ImageField {
  return Object.hasOwn(IMAGE_POLICIES, value);
}

/** El `accept` del `<input type="file">` de un campo. */
export function acceptAttribute(field: ImageField): string {
  return policyFor(field).accept.join(",");
}

/** "5 MB", para los mensajes. */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

/** "JPG, PNG o WebP", para los mensajes. */
export function formatAccepted(field: ImageField): string {
  const names = policyFor(field).accept.map((format) =>
    format === "image/jpeg" ? "JPG" : format === "image/png" ? "PNG" : "WebP",
  );
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`;
}
