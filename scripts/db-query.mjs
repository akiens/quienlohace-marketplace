/**
 * Consulta rápida de la D1 local, en formato tabla.
 *
 * Lee directamente el SQLite de Miniflare, así que no hace falta que
 * `wrangler dev` esté corriendo. Sólo lectura: nunca escribe.
 *
 * Uso:
 *   node scripts/db-query.mjs                       -- resumen de tablas
 *   node scripts/db-query.mjs "SELECT * FROM users LIMIT 5"
 */
import { DatabaseSync } from "node:sqlite";
import { readdirSync, statSync } from "node:fs";

const DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

/** De las bases de Miniflare, la que tenga tablas y se haya tocado último. */
function findDatabase() {
  const candidates = readdirSync(DIR)
    .filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
    .map((f) => ({ file: `${DIR}/${f}`, mtime: statSync(`${DIR}/${f}`).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const c of candidates) {
    const db = new DatabaseSync(c.file, { readOnly: true });
    const has = db.prepare(
      "SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='users'",
    ).get();
    if (has.n > 0) return { db, file: c.file };
    db.close();
  }
  throw new Error(`No encontré ninguna base con datos en ${DIR}`);
}

/** Imprime filas como tabla, recortando lo muy largo para que no se desarme. */
function printTable(rows) {
  if (rows.length === 0) return console.log("(sin filas)");
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    const s = v === null ? "NULL" : String(v);
    return s.length > 40 ? `${s.slice(0, 37)}...` : s;
  };
  const width = Object.fromEntries(
    cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => cell(r[c]).length))]),
  );
  const line = (ch, l, m, r) =>
    l + cols.map((c) => ch.repeat(width[c] + 2)).join(m) + r;

  console.log(line("─", "┌", "┬", "┐"));
  console.log("│" + cols.map((c) => ` ${c.padEnd(width[c])} `).join("│") + "│");
  console.log(line("─", "├", "┼", "┤"));
  for (const row of rows) {
    console.log("│" + cols.map((c) => ` ${cell(row[c]).padEnd(width[c])} `).join("│") + "│");
  }
  console.log(line("─", "└", "┴", "┘"));
  console.log(`${rows.length} fila(s)`);
}

const { db, file } = findDatabase();
console.log(`base: ${file}\n`);

const sql = process.argv[2];

if (!sql) {
  // Sin argumentos: panorama de qué hay cargado.
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf%' ORDER BY name")
    .all();
  printTable(
    tables.map((t) => ({
      tabla: t.name,
      filas: db.prepare(`SELECT COUNT(*) n FROM "${t.name}"`).get().n,
    })),
  );
  console.log('\nEjemplo: node scripts/db-query.mjs "SELECT email, name FROM users LIMIT 5"');
} else {
  if (!/^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql)) {
    console.error("Sólo lectura: usá SELECT, WITH, PRAGMA o EXPLAIN.");
    process.exit(1);
  }
  printTable(db.prepare(sql).all());
}

db.close();
