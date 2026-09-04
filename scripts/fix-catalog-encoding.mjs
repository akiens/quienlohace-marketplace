/**
 * El catálogo llegó con la codificación rota: UTF-8 leído como Latin-1
 * ("CatÃ¡logo" por "Catálogo", "â" por "—"). Esto lo devuelve a UTF-8.
 *
 * Se usó una sola vez para dejar `docs/catalogo-servicios.md` sano; queda
 * versionado por si hay que repetirlo con una actualización del documento.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("uso: node fix-catalog-encoding.mjs <entrada> <salida>");
  process.exit(1);
}

// Se leen los bytes como Latin-1 y se reinterpretan como UTF-8, que es
// exactamente el camino inverso al que rompió el archivo.
const broken = readFileSync(input, "latin1");
writeFileSync(output, Buffer.from(broken, "utf8"), "utf8");
console.log(`${output}: ${Buffer.from(broken, "utf8").length} bytes`);
