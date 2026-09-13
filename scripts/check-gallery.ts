/** Integración de BR-032/033 con SQLite real y batches transaccionales como D1.
 * Ejecutar: npx tsx --conditions=react-server scripts/check-gallery.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  cleanupExpiredImages,
  commitImageSelection,
  listImagesForUser,
  putProfileImage,
  syncGalleryForUser,
} from "../src/infrastructure/d1-profile-images";

const sql = new DatabaseSync(":memory:");
type SQLInputValue = null | number | bigint | string | Uint8Array;
class Statement {
  constructor(readonly query: string, readonly args: SQLInputValue[] = []) {}
  bind(...args: SQLInputValue[]) { return new Statement(this.query, args); }
  async first() { return sql.prepare(this.query).get(...this.args) ?? null; }
  async all() { return { results: sql.prepare(this.query).all(...this.args) }; }
  async run() { return { meta: { changes: Number(sql.prepare(this.query).run(...this.args).changes) } }; }
}
const db = {
  prepare: (query: string) => new Statement(query),
  async batch(statements: Statement[]) {
    sql.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sql.exec("COMMIT");
      return results;
    } catch (error) {
      sql.exec("ROLLBACK");
      throw error;
    }
  },
};
const deleted: string[] = [];
let failDeletion = false;
Reflect.set(globalThis, Symbol.for("__cloudflare-context__"), {
  env: { DB: db, MEDIA: {
    put: async () => {},
    delete: async (key: string) => {
      if (failDeletion) throw new Error("Fallo R2 simulado");
      deleted.push(key);
    },
  } },
});

async function main() {
  // La cadena completa de migraciones debe seguir siendo aplicable.
  const schema = new DatabaseSync(":memory:");
  for (const name of readdirSync("migrations").filter(name => name.endsWith(".sql")).sort()) {
    schema.exec(readFileSync(`migrations/${name}`, "utf8"));
  }
  assert.ok(schema.prepare("SELECT name FROM sqlite_master WHERE name = 'profile_gallery_state'").get());
  schema.close();

  sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY);
    CREATE TABLE profiles(id TEXT PRIMARY KEY, user_id TEXT, plan_id TEXT,
      subscription_status TEXT DEFAULT 'active', downgrade_plan_id TEXT, plan_expires_at TEXT);
    CREATE TABLE plans(id TEXT PRIMARY KEY, max_gallery_images INTEGER);
    CREATE TABLE profile_images(id TEXT PRIMARY KEY, owner_user_id TEXT, profile_id TEXT,
      storage_key TEXT, alt TEXT DEFAULT '', kind TEXT DEFAULT 'gallery', sort_order INTEGER,
      is_active INTEGER DEFAULT 1, lifecycle TEXT DEFAULT 'confirmed', width INTEGER DEFAULT 10,
      height INTEGER DEFAULT 10, created_at TEXT DEFAULT '2026-01-01', updated_at TEXT, expires_at TEXT);
    CREATE TABLE service_card_images(storage_key TEXT);
    INSERT INTO users VALUES ('u'), ('other');
    INSERT INTO profiles(id, user_id, plan_id, downgrade_plan_id, plan_expires_at)
      VALUES ('p', 'u', 'platinum', NULL, NULL);
    INSERT INTO plans VALUES ('cobre', 0), ('gold', 5), ('platinum', 20);`);
  sql.exec(readFileSync("migrations/0015_image_visibility_reason.sql", "utf8"));
  sql.exec(readFileSync("migrations/0016_gallery_plan_state.sql", "utf8"));

  const pendingDuringSignup = await putProfileImage({
    userId: "other", profileId: null, galleryPlanLimit: 5, kind: "gallery",
    body: new ArrayBuffer(1), contentType: "image/webp", extension: "webp",
    width: 10, height: 10,
  });
  assert.equal(
    pendingDuringSignup.lifecycle,
    "pending",
    "Oro permite subir galería antes de que exista el perfil",
  );
  for (let i = 0; i < 8; i++) sql.prepare(`INSERT INTO profile_images
    (id, owner_user_id, profile_id, storage_key, sort_order) VALUES (?, 'u', 'p', ?, ?)`).run(`i${i}`, `key${i}`, i);

  let images = await listImagesForUser("u");
  const save = (overrides: Partial<Parameters<typeof commitImageSelection>[0]> = {}) => commitImageSelection({
    userId: "u", profileId: "p", kinds: ["gallery"],
    keepIds: images.map(image => image.id), activeIds: images.filter(image => image.isActive).map(image => image.id),
    galleryRevision: images[0]!.galleryRevision, ...overrides,
  });
  await save({ activeIds: images.filter(image => image.id !== "i1").map(image => image.id) });
  images = await listImagesForUser("u");
  assert.equal(images.at(-1)?.id, "i1", "ocultar pasa al final");
  assert.equal(images.find(image => image.id === "i1")?.galleryState, "available", "ocultar sigue ocupando cupo");

  sql.exec("UPDATE profiles SET downgrade_plan_id = 'gold', plan_expires_at = '2999-01-01'");
  await syncGalleryForUser("u");
  assert.equal((await listImagesForUser("u")).filter(image => image.galleryState === "available").length, 8);
  sql.exec("UPDATE profiles SET plan_expires_at = '2020-01-01'");
  images = await listImagesForUser("u");
  assert.equal(images.filter(image => image.galleryState === "available").length, 5);
  assert.equal(images.filter(image => image.galleryState === "semi").length, 3);
  assert.ok(images[0]?.gallerySelectionPending);
  const deadlineStart = images.find(image => image.galleryState === "semi")!.hiddenAt;
  await assert.rejects(save({ selectedIds: images.map(image => image.id) }), /cupo/);
  await assert.rejects(save({ selectedIds: ["foreign"] }), /cupo/);
  await assert.rejects(save({ activeIds: ["i1"] }), /congeladas/);

  const chosen = ["i1", "i2", "i3", "i4", "i7"];
  const oldRevision = images[0]!.galleryRevision;
  await save({ selectedIds: chosen });
  images = await listImagesForUser("u");
  assert.equal(images.filter(image => image.galleryState === "frozen").length, 3);
  assert.equal(images.find(image => image.id === "i1")?.isActive, false, "seleccionar no desoculta");
  assert.equal(images.find(image => image.galleryState === "frozen")?.hiddenAt, deadlineStart);
  await assert.rejects(save({ selectedIds: chosen }), /selección única/);
  await assert.rejects(save({ galleryRevision: oldRevision }), /cambió/);
  await assert.rejects(save({ galleryRevision: null }), /cambió/);
  await save(); // Guardar normalmente no vuelve a abrir la elección.
  images = await listImagesForUser("u");
  assert.equal(images[0]?.gallerySelectionPending, false);
  assert.equal(images.filter(image => image.galleryState === "available").length, 5);

  sql.exec("UPDATE profiles SET plan_id = 'cobre', downgrade_plan_id = NULL");
  images = await listImagesForUser("u");
  assert.ok(images.every(image => image.galleryState === "frozen" && !image.isActive));
  assert.equal(images[0]?.gallerySelectionPending, false);
  sql.exec("UPDATE profiles SET plan_id = 'gold'");
  images = await listImagesForUser("u");
  assert.equal(images.filter(image => image.galleryState === "semi").length, 3, "mejora parcial abre selección");
  sql.exec("UPDATE profiles SET plan_id = 'platinum'");
  images = await listImagesForUser("u");
  assert.ok(images.every(image => image.galleryState === "available" && image.hiddenAt === null));
  assert.equal(images.find(image => image.id === "i1")?.isActive, false);
  await save({ activeIds: images.map(image => image.id) });
  images = await listImagesForUser("u");
  assert.equal(images.at(-1)?.id, "i1", "habilitar pasa al final de habilitadas");

  sql.exec("UPDATE profiles SET plan_id = 'cobre'");
  images = await listImagesForUser("u");
  assert.equal((await cleanupExpiredImages()).removed, 0, "retención antes de 180 días");
  const old = new Date(Date.now() - 181 * 86400000).toISOString();
  sql.prepare("UPDATE profile_images SET hidden_at = ?").run(old);
  // Recuperación antes de purgar, aunque nadie haya abierto el panel.
  sql.exec("UPDATE profiles SET plan_id = 'platinum'");
  assert.equal((await cleanupExpiredImages()).removed, 0);
  sql.exec("UPDATE profiles SET plan_id = 'cobre'");
  await syncGalleryForUser("u");
  sql.prepare("UPDATE profile_images SET hidden_at = ?").run(old);
  assert.equal((await cleanupExpiredImages()).removed, 8);
  assert.equal(deleted.length, 8);
  assert.equal((await listImagesForUser("u")).length, 0);
  sql.exec("UPDATE profiles SET plan_id = 'gold'");
  await syncGalleryForUser("u");
  const upload = () => putProfileImage({
    userId: "u", profileId: "p", kind: "gallery", body: new ArrayBuffer(1),
    contentType: "image/webp", extension: "webp", width: 10, height: 10,
  });
  const uploads = await Promise.allSettled(Array.from({ length: 6 }, upload));
  assert.equal(uploads.filter(result => result.status === "fulfilled").length, 5, "subidas simultáneas respetan cupo");
  assert.equal(uploads.filter(result => result.status === "rejected").length, 1);
  images = await listImagesForUser("u");
  await save({ activeIds: [] });
  await assert.rejects(upload(), /cupo/, "ocultar no libera almacenamiento");
  images = await listImagesForUser("u");
  assert.equal(images.filter(image => image.isActive).length, 0);
  sql.prepare("UPDATE profile_images SET hidden_at = ?").run(old);
  assert.equal((await cleanupExpiredImages()).removed, 0, "ocultas disponibles no vencen");
  sql.exec("UPDATE profiles SET plan_id = 'cobre'");
  await syncGalleryForUser("u");
  sql.prepare("UPDATE profile_images SET hidden_at = ?").run(old);
  failDeletion = true;
  const originalError = console.error;
  console.error = () => {}; // Fallo esperado: se verifica la cola durable.
  const failedCleanup = await cleanupExpiredImages();
  console.error = originalError;
  assert.equal(failedCleanup.removed, 5);
  assert.equal(failedCleanup.failed, 5);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM media_deletion_queue").get() as { n: number }).n, 5);
  failDeletion = false;
  assert.equal((await cleanupExpiredImages()).failed, 0);
  assert.equal((sql.prepare("SELECT COUNT(*) AS n FROM media_deletion_queue").get() as { n: number }).n, 0);
  console.log("Galería: migraciones, visibilidad, cupos, selección única, pestaña obsoleta, recuperación y purga OK.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
