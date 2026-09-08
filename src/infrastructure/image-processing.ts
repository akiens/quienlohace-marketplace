import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  ABSOLUTE_MAX_BYTES,
  ABSOLUTE_MAX_PIXELS,
  FORMAT_EXTENSIONS,
  formatAccepted,
  formatBytes,
  policyFor,
  sniffFormat,
  type ImageField,
  type ImageFormat,
} from "@/domain/image-policy";

/**
 * Validación segura y optimización de las imágenes que llegan (TR-042).
 *
 * Lo que entra por el formulario no es una imagen hasta que se demuestra: el
 * nombre, la extensión y el `Content-Type` los escribe quien sube. Acá se
 * mira el archivo —su firma binaria primero, su decodificación después— y se
 * genera una versión nueva. Lo que se guarda es esa versión, nunca el
 * original: un archivo que se decodifica y se vuelve a codificar no puede
 * arrastrar lo que viniera escondido entre sus bytes.
 */

/** Lo que se guarda: la imagen ya procesada. */
export type ProcessedImage = {
  body: ArrayBuffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
};

export type ProcessResult =
  | { ok: true; image: ProcessedImage }
  | { ok: false; error: string };

/**
 * El binding de Cloudflare Images, si está disponible.
 *
 * Es el que decodifica y recomprime dentro del worker. Requiere plan pago, y
 * no está en el entorno de desarrollo: por eso se consulta en vez de darse
 * por hecho, y el flujo sigue sin él con lo que se pueda verificar de otro
 * modo (ver `process`).
 */
function imagesBinding(): ImagesBinding | null {
  try {
    const env = getCloudflareContext().env as CloudflareEnv & {
      IMAGES?: ImagesBinding;
    };
    return env.IMAGES ?? null;
  } catch {
    return null;
  }
}

function fail(error: string): ProcessResult {
  return { ok: false, error };
}

/** Un `ArrayBuffer` leído como stream, que es lo que el binding recibe. */
function toStream(body: ArrayBuffer): ReadableStream<Uint8Array> {
  return new Blob([body]).stream() as ReadableStream<Uint8Array>;
}

/**
 * Las dimensiones que **declara** la cabecera, sin decodificar el resto.
 *
 * Es lo que permite frenar una *decompression bomb* antes de gastar memoria:
 * un PNG de 40 KB puede anunciar 30.000 × 30.000 y pedir gigabytes al
 * expandirse. Leer sólo la cabecera cuesta nada y decide si vale la pena
 * seguir.
 *
 * `null` si la cabecera no se entiende; ahí decide la decodificación.
 */
function headerDimensions(
  bytes: Uint8Array,
  format: ImageFormat,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    if (format === "image/png") {
      // IHDR va siempre en los bytes 16-24, big-endian.
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }

    if (format === "image/jpeg") {
      /*
       * JPEG es una cadena de segmentos: hay que recorrerlos hasta el SOF,
       * que es el que trae el tamaño. No hay posición fija.
       */
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1] ?? 0;
        // SOF0..SOF15, salteando los que no describen la trama.
        const isSof =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc;
        if (isSof) {
          return {
            height: view.getUint16(offset + 5),
            width: view.getUint16(offset + 7),
          };
        }
        offset += 2 + view.getUint16(offset + 2);
      }
      return null;
    }

    // WebP: el tamaño depende de la variante (VP8 / VP8L / VP8X).
    const chunk = String.fromCharCode(...bytes.slice(12, 16));

    if (chunk === "VP8X") {
      // 24 bits little-endian, menos uno.
      const at = (index: number) => bytes[index] ?? 0;
      const width = 1 + (at(24) | (at(25) << 8) | (at(26) << 16));
      const height = 1 + (at(27) | (at(28) << 8) | (at(29) << 16));
      return { width, height };
    }

    if (chunk === "VP8 ") {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }

    if (chunk === "VP8L") {
      const at = (index: number) => bytes[index] ?? 0;
      const bits =
        at(21) | (at(22) << 8) | (at(23) << 16) | (at(24) << 24);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }

    return null;
  } catch {
    // Cabecera cortada o malformada: que decida la decodificación.
    return null;
  }
}

/**
 * Valida y regenera una imagen para la web.
 *
 * El orden es de lo más barato a lo más caro, para gastar lo mínimo en
 * rechazar lo que no va a entrar:
 *
 * 1. Peso, contra el tope del campo y contra el tope duro.
 * 2. Firma binaria: qué es en realidad este archivo.
 * 3. Dimensiones declaradas: freno de la bomba de descompresión.
 * 4. Decodificación: ¿se abre de verdad, o está roto?
 * 5. Recompresión: redimensionar, quitar metadatos, convertir a WebP.
 */
export async function processImage(
  field: ImageField,
  body: ArrayBuffer,
): Promise<ProcessResult> {
  const policy = policyFor(field);

  if (body.byteLength === 0) return fail("El archivo está vacío.");

  if (body.byteLength > policy.maxBytes) {
    return fail(`La imagen no puede pesar más de ${formatBytes(policy.maxBytes)}.`);
  }

  // Ninguna política puede pedir más que el tope duro del sistema.
  if (body.byteLength > ABSOLUTE_MAX_BYTES) {
    return fail("La imagen es demasiado pesada.");
  }

  const bytes = new Uint8Array(body);

  /*
   * Qué es esto en realidad. Un `.jpg` renombrado desde un `.exe`, un SVG con
   * un `<script>` adentro o un PDF con nombre de foto se caen acá, sin
   * importar lo que dijera el navegador.
   */
  const format = sniffFormat(bytes);
  if (!format) {
    return fail(
      `El archivo no es una imagen válida. Usá ${formatAccepted(field)}.`,
    );
  }

  if (!policy.accept.includes(format)) {
    return fail(`Formato no admitido. Usá ${formatAccepted(field)}.`);
  }

  const declared = headerDimensions(bytes, format);
  if (declared) {
    if (declared.width < 1 || declared.height < 1) {
      return fail("El archivo está dañado y no se puede abrir.");
    }

    // La bomba: pocos bytes que declaran una superficie enorme.
    if (declared.width * declared.height > ABSOLUTE_MAX_PIXELS) {
      return fail("La imagen tiene demasiados píxeles. Probá con una más chica.");
    }

    const smallest = Math.min(declared.width, declared.height);
    if (smallest < policy.minDimension) {
      return fail(
        `La imagen es muy chica: necesita al menos ${policy.minDimension} píxeles de lado.`,
      );
    }
  }

  const images = imagesBinding();

  /*
   * Sin el binding no hay con qué decodificar ni recomprimir dentro del
   * worker: es la única pieza del stack capaz de hacerlo —`sharp` y compañía
   * son binarios nativos, que el runtime de Workers no ejecuta—.
   *
   * Se guarda lo que llegó, que no es poco: ya pasó el tope de peso, la firma
   * binaria y las dimensiones declaradas, así que un ejecutable renombrado,
   * un SVG con scripts o una bomba de descompresión no llegan hasta acá. Y lo
   * que manda el navegador viene redimensionado y convertido a WebP por el
   * canvas, que además descarta el EXIF al dibujar.
   *
   * Lo que se pierde es la garantía: esas dos cosas las hizo el cliente, y el
   * cliente se puede manipular. Un archivo armado a mano puede conservar sus
   * metadatos y su tamaño original. Por eso esto **no cumple TR-042**, que
   * pide regenerar del lado del servidor, y la regla lo anota como la
   * degradación conocida y no como una alternativa válida.
   *
   * `width`/`height` quedan en lo que declare la cabecera, o en 0 si no se
   * pudo leer: son para reservar el espacio en pantalla, no una medición.
   */
  if (!images) {
    return {
      ok: true,
      image: {
        body,
        contentType: format,
        extension: FORMAT_EXTENSIONS[format],
        width: declared?.width ?? 0,
        height: declared?.height ?? 0,
        bytes: body.byteLength,
      },
    };
  }

  /*
   * La prueba de fuego: `info()` decodifica. Si el archivo está cortado, es
   * un JPEG con la cabecera bien y el resto basura, o un formato que se
   * rechaza, tira acá.
   */
  let info;
  try {
    info = await images.info(toStream(body));
  } catch {
    return fail("El archivo está dañado o no es una imagen que podamos leer.");
  }

  // El binding reconoce SVG aparte, y no se acepta: puede traer scripts.
  if (!("width" in info)) {
    return fail(`Formato no admitido. Usá ${formatAccepted(field)}.`);
  }

  if (info.width * info.height > ABSOLUTE_MAX_PIXELS) {
    return fail("La imagen tiene demasiados píxeles. Probá con una más chica.");
  }

  const smallest = Math.min(info.width, info.height);
  if (smallest < policy.minDimension) {
    return fail(
      `La imagen es muy chica: necesita al menos ${policy.minDimension} píxeles de lado.`,
    );
  }

  /*
   * La versión para la web.
   *
   * - `scale-down` nunca agranda: una foto ya chica se guarda como está en
   *   vez de estirarse y verse peor.
   * - Los metadatos no sobreviven: el binding decodifica a píxeles y vuelve a
   *   codificar desde ahí, así que el EXIF —incluidas las coordenadas de
   *   dónde se sacó la foto— no llega a la copia. La orientación sí se
   *   respeta al decodificar, así que la imagen no queda acostada.
   * - WebP pesa bastante menos que JPEG a igual calidad y lo entienden todos
   *   los navegadores que el sitio soporta.
   */
  const target = fitTo(info.width, info.height, policy);

  try {
    const output = await images
      .input(toStream(body))
      .transform({
        width: target.width,
        height: target.height,
        fit: policy.aspectRatio === null ? "scale-down" : "cover",
      })
      .output({ format: "image/webp", quality: policy.quality });

    const processed = await new Response(output.image()).arrayBuffer();

    return {
      ok: true,
      image: {
        body: processed,
        contentType: "image/webp",
        extension: "webp",
        width: target.width,
        height: target.height,
        bytes: processed.byteLength,
      },
    };
  } catch {
    return fail(
      "No pudimos procesar la imagen. Probá con otra o en otro formato.",
    );
  }
}

/**
 * A qué tamaño se guarda, respetando el lado más largo de la política.
 *
 * Con `aspectRatio` el campo dibuja un marco fijo y se recorta a esa forma;
 * sin él se mantiene la proporción original, que es lo que corresponde cuando
 * la imagen es el contenido y no la decoración.
 */
function fitTo(
  width: number,
  height: number,
  policy: { maxDimension: number; aspectRatio: number | null },
): { width: number; height: number } {
  if (policy.aspectRatio !== null) {
    const side = Math.min(policy.maxDimension, Math.max(width, height));
    return policy.aspectRatio >= 1
      ? { width: side, height: Math.round(side / policy.aspectRatio) }
      : { width: Math.round(side * policy.aspectRatio), height: side };
  }

  const longest = Math.max(width, height);
  if (longest <= policy.maxDimension) return { width, height };

  const scale = policy.maxDimension / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
