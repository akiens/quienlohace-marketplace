# QuienLoHace — Marketplace

Marketplace de servicios de Uruguay: sitio público, perfiles, búsqueda y panel
del proveedor. Next.js full-stack sobre Cloudflare Workers, con D1 y R2.

## Puesta en marcha

```bash
npm install
npm run dev          # http://localhost:3000 — UI con datos de ejemplo
```

`npm run dev` usa el servidor de Next: alcanza para trabajar en la interfaz
pública, pero **no** tiene D1 ni sesiones. Para el panel del proveedor hace
falta el runtime de Workers:

```bash
npm run db:migrate:local   # crea el esquema en la D1 local
npm run seed:generate      # genera los datos de prueba
npm run db:seed:local      # los carga en la D1 local
npm run preview            # build + Workers en local, con D1 y R2 reales
```

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Next dev — sólo UI pública |
| `npm run preview` | Build + Workers local (D1, R2, sesiones) |
| `npm run deploy` | Build + deploy a Cloudflare |
| `npm run build` | Build de Next |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run check:data` | Integridad del dataset y de la búsqueda |
| `npm run check:backend` | Contraseñas y schemas de validación |
| `npm run cf-typegen` | Regenera los tipos de los bindings |
| `npm run db:migrate:local` / `:remote` | Aplica migraciones |
| `npm run seed:generate` | Genera los datos de prueba |
| `npm run db:seed:local` | Los carga en la D1 local |
| `npm run db:seed:remote` | Los carga en la D1 de producción ⚠️ |
| `npm run db:reset:remote` | Vacía la D1 de producción ⚠️ |

⚠️ Los dos últimos **borran** el contenido de las tablas. Ver
[Poblar la base remota](#poblar-la-base-remota).

### Datos de prueba

`npm run seed:generate` escribe dos archivos a partir de la taxonomía y del
Master Data geográfico reales:

```text
seeds/providers.json   los datos, legibles y reutilizables
seeds/dev-seed.sql     lo mismo, listo para D1 (derivado del JSON)
```

Son ~900 proveedores, entre 5 y 10 por subcategoría, con una mezcla de
empresas e independientes, algunos destacados, otros verificados, unos en
borrador y otros sin opiniones — para poder ver todos los estados de la UI.
Los nombres y teléfonos salen de Faker con locale español; el rubro y la
ubicación, del código, así toda referencia existe por construcción.

El generador es determinista (semilla fija): dos corridas producen archivos
idénticos. Los dos archivos están en `.gitignore` porque pesan varios MB y se
regeneran en un comando.

`db:seed:local` **borra** el contenido de las tablas antes de insertar, así
que cada corrida deja la base en un estado conocido.

### Poblar la base remota

Mientras el sitio esté en pruebas puede tener sentido cargar el seed en la
base de Cloudflare para verla con volumen real:

```bash
npm run seed:generate     # genera seeds/dev-seed.sql si no existe
npm run db:seed:remote    # lo carga en la D1 de producción
```

Verificar que entró:

```bash
npx wrangler d1 execute quienlohace --remote \
  --command "SELECT COUNT(*) AS total, SUM(status='active') AS publicados FROM providers"
```

Para volver a dejarla vacía:

```bash
npm run db:reset:remote   # ejecuta seeds/truncate.sql
```

**Antes de correr `db:seed:remote`, tener en cuenta:**

1. **Borra lo que haya.** El seed empieza con `DELETE FROM`, así que se lleva
   puestos usuarios, perfiles y opiniones reales. Si ya creaste tu cuenta en
   el sitio, la vas a perder.
2. **Son datos inventados.** ~910 perfiles con nombres de Faker y teléfonos
   que no existen. Aceptable mientras `robots.txt` bloquee la indexación en
   `*.workers.dev`; **hay que vaciar la base antes de apuntar al dominio
   definitivo**, o quedan perfiles falsos publicados y indexables.
3. **Consume cupo.** Son ~12.000 sentencias. El plan gratuito de D1 permite
   100.000 filas escritas por día: entra, pero no conviene repetirlo muchas
   veces en el mismo día.
4. **Se puede recuperar.** D1 guarda Time Travel (7 días en plan gratuito,
   30 en pago), así que un borrado accidental tiene vuelta atrás:
   `npx wrangler d1 time-travel restore quienlohace --timestamp=<ISO>`.

Para desarrollo normal no hace falta nada de esto: `npm run preview` levanta
el sitio con la base local y los mismos datos.

## Despliegue

En producción:

```text
https://quienlohace-marketplace.akiens-dev.workers.dev
```

```bash
npm run deploy    # opennextjs-cloudflare build && … deploy
```

El build **no** es `next build`: Workers no ejecuta la salida de Node.
`opennextjs-cloudflare build` corre `next build` por dentro y arma
`.open-next/worker.js`, que es lo que apunta `main` en wrangler.jsonc.

Si se configura desde el panel (Workers Builds):

| Campo | Valor |
| --- | --- |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Output directory | *(vacío: lo resuelve wrangler.jsonc)* |

La URL pública sale de `APP_URL` en [wrangler.jsonc](wrangler.jsonc): pasar al
dominio definitivo es cambiar esa línea. Mientras el sitio corra en
`*.workers.dev`, `robots.txt` bloquea la indexación para no competir con el
dominio final por el mismo contenido.

### Recursos ya creados

```text
D1   quienlohace          be93c0ea-e93a-45a8-95cb-08ff9933ed28
R2   quienlohace-media
```

El esquema ya está aplicado en la base de producción
(`npm run db:migrate:remote`). El seed de prueba **nunca** va a producción:
`db:seed:local` empieza con `DELETE FROM` y apunta sólo a la base local.

## Arquitectura

```text
Navegador
    │
Next.js (Server Component / Server Action / Route Handler)
    │
Caso de uso  ......................  src/application/
    │
Puerto (interfaz)  ................  src/domain/ports.ts
    │
Adapter D1 / R2  ..................  src/infrastructure/
    │
Cloudflare D1 · R2
```

La lógica de negocio depende de las interfaces de `src/domain/ports.ts`, nunca
de `env.DB`. Cambiar D1 por Postgres es escribir otro adapter.

```text
src/
├── app/                  Rutas y Server Actions
│   ├── actions/            auth.ts · profile.ts
│   ├── dashboard/          panel del proveedor
│   ├── api/session/        estado de sesión para el header
│   ├── media/[...key]/     sirve imágenes desde R2
│   └── …                   público: inicio, buscar, categorías, perfiles
├── application/          Casos de uso
├── domain/               Puertos (interfaces)
├── infrastructure/       Adapters D1/R2 — único lugar con bindings
├── components/           UI
├── data/                 Master Data: ubicaciones, taxonomía, FAQ
├── lib/                  Sesión, contraseñas, validación, búsqueda
└── types/                Contratos de dominio
migrations/               Esquema (se aplica con wrangler)
seeds/                    Datos de prueba — nunca en producción
```

## Decisiones

**La base guarda referencias, no copias.** Un proveedor referencia su
`location_id` y su `subcategory_id`; la geografía y la taxonomía viven en el
código como Master Data y no tienen CRUD.

**La calificación está desnormalizada.** `rating_sum` y `review_count` se
actualizan junto con la opinión, en un mismo `batch()`. Evita un `AVG` por
cada card del listado.

**Las imágenes van a R2, nunca a D1.** La base guarda la clave del objeto;
`/media/...` las sirve con caché inmutable.

**Autorización siempre en el servidor.** Cada Server Action verifica la sesión
y la propiedad del recurso. Que el botón no se muestre no es autorización.

**Contraseñas con PBKDF2-SHA256** (210k iteraciones, WebCrypto). En Workers no
hay `node:crypto`, scrypt ni argon2. En la tabla `sessions` se guarda el
SHA-256 del token, no el token.

**Las páginas públicas siguen siendo estáticas.** El estado de sesión se
consulta desde el cliente a `/api/session`. Leer la cookie en el layout raíz
volvería dinámico todo el sitio y las páginas de SEO dejarían de pregenerarse.

**Los perfiles se revalidan, no se congelan.** Se generan bajo demanda con
`revalidate = 3600`, y al guardar cambios se llama a `revalidatePath`.

## Estado

Funciona de punta a punta contra D1: registro, login, alta y edición del
perfil, publicar/despublicar, búsqueda, filtros, categorías, perfiles públicos
y opiniones.

Pendiente:

- **Subida de imágenes desde el panel** — el backend está
  (`addProviderImage`, R2, `/media/...`), falta el control en el formulario.
- **Login con Google** para consumidores, y publicación de opiniones desde la
  web (hoy las opiniones se leen; el alta existe en el repositorio).
- **Turnstile y rate limiting** en formularios sensibles.
- **App de administración** (`admin.quienlohace.uy`) — es una aplicación
  aparte, según `arquitectura-actualizada.md`.
- Verificación de email y recuperación de contraseña.

## Marca

Assets en `public/brand/`; el set completo en `template-quienlohace/brand/`.
Los tokens visuales están en [tailwind.config.ts](tailwind.config.ts).
