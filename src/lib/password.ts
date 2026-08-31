import "server-only";

/**
 * Hashing de contraseñas con PBKDF2-SHA256 sobre WebCrypto.
 *
 * En Workers no existen `node:crypto`, scrypt ni argon2: `crypto.subtle` sólo
 * ofrece PBKDF2 como KDF para contraseñas. Con suficientes iteraciones es una
 * opción aceptable; si el runtime llegara a soportar argon2id, conviene migrar
 * (el formato guarda los parámetros, así que se puede rehashear al ingresar).
 */

const ITERATIONS = 210_000; // Recomendación OWASP 2023 para PBKDF2-SHA256.
const KEY_LENGTH = 32;
const FORMAT = "pbkdf2";

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_LENGTH * 8,
  );
}

/** Devuelve "pbkdf2:iteraciones:salt:hash" — el formato lleva sus parámetros. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt, ITERATIONS);
  return `${FORMAT}:${ITERATIONS}:${toHex(salt.buffer as ArrayBuffer)}:${toHex(bits)}`;
}

/** Comparación en tiempo constante: no filtra información por el tiempo de respuesta. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;

  const [format, iterations, salt, hash] = stored.split(":");
  if (format !== FORMAT || !iterations || !salt || !hash) return false;

  const bits = await derive(password, fromHex(salt), Number(iterations));
  return timingSafeEqual(toHex(bits), hash);
}
