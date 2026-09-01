# QuienLoHace — Marketplace

Marketplace de servicios de Uruguay: sitio público, perfiles, búsqueda y panel
del proveedor. Next.js full-stack sobre Cloudflare Workers, con D1 y R2.

## Puesta en marcha

```bash
npm install

npm run db:migrate:local   # crea el esquema en la D1 local
npm run seed:generate      # genera los datos de prueba
npm run db:seed:local      # los carga en la D1 local

npm run dev                # http://localhost:3000
```

Con eso ya se puede entrar al panel: cualquier cuenta del seed sirve, con la
contraseña `admin.123` (ver [Datos de prueba](#datos-de-prueba)).

### Cómo correr el sitio en local

Hay dos formas y sirven para cosas distintas.

**`npm run dev` — para el día a día.**

Servidor de Next con recarga en caliente. Gracias a
`initOpenNextCloudflareForDev()` en `next.config.mjs`, tiene acceso a la D1 y
la R2 locales, así que el login, el panel y las opiniones funcionan.

**`npm run preview` — antes de desplegar.**

Compila y corre el bundle real sobre `workerd`, el mismo runtime que usa
producción. No tiene recarga en caliente y la compilación tarda varios
minutos, pero es la única forma de detectar lo que **sólo falla en Workers**.
No es teórico: el login estuvo roto en producción porque el runtime limita
PBKDF2 a 100.000 iteraciones, algo que `next dev` nunca reproduce porque Node
no tiene ese tope.

| Situación | Comando |
| --- | --- |
| Desarrollo normal, UI, formularios | `npm run dev` |
| Verificar antes de un deploy | `npm run preview` |
| Algo falla en producción pero no en local | `npm run preview` |
| Ver o consultar datos | `npm run db:query` |

La regla corta: **`dev` para construir, `preview` para confirmar.**

> **No corras los dos a la vez.** En Windows el proceso mantiene bloqueado el
> archivo SQLite de la D1 local, y el segundo falla al compilar o al leer.
> Si pasa, cerrá el que sobre; si queda un `workerd` colgado,
> `Get-Process workerd | Stop-Process -Force`.

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Next dev con D1 y R2 locales |
| `npm run preview` | Build + Workers local: el runtime real |
| `npm run deploy` | Build + deploy a Cloudflare |
| `npm run build` | Build de Next |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run check:data` | Integridad del dataset y de la búsqueda |
| `npm run check:backend` | Contraseñas y schemas de validación |
| `npm run cf-typegen` | Regenera los tipos de los bindings |
| `npm run db:migrate:local` / `:remote` | Aplica migraciones |
| `npm run db:query` | Consulta la D1 local en formato tabla (sólo lectura) |
| `npm run seed:generate` | Genera los datos de prueba |
| `npm run db:seed:local` | Los carga en la D1 local |
| `npm run db:password:local` / `:remote` | Repone la contraseña de prueba |
| `npm run db:seed:remote` | Los carga en la D1 de producción ⚠️ |
| `npm run db:reset:remote` | Vacía la D1 de producción ⚠️ |

⚠️ Los dos últimos **borran** el contenido de las tablas. Ver
[Poblar la base remota](#poblar-la-base-remota).

### Datos de prueba

`npm run seed:generate` escribe dos archivos a partir de la taxonomía y del
Master Data geográfico reales:

```text
seeds/providers.json        los datos, legibles y reutilizables
seeds/dev-seed.sql          lo mismo, listo para D1 (derivado del JSON)
seeds/set-dev-password.sql  sólo la contraseña, para una base ya cargada
```

Son ~900 proveedores, entre 5 y 10 por subcategoría, con una mezcla de
empresas e independientes, algunos destacados, otros verificados, unos en
borrador y otros sin opiniones — para poder ver todos los estados de la UI.
Los nombres y teléfonos salen de Faker con locale español; el rubro y la
ubicación, del código, así toda referencia existe por construcción.

Los perfiles se reparten entre los tres planes (≈60% Cobre, 28% Gold, 12%
Platinum), cada uno dentro de sus propios límites, para poder probar el
comportamiento de los topes y del upsell.

**Todas las cuentas usan la contraseña `admin.123`.** Es sólo para pruebas:
está en el repositorio y estos usuarios no deben existir en producción.

El generador es determinista (semilla fija): dos corridas producen archivos
idénticos. Los archivos están en `.gitignore` porque pesan varios MB y se
regeneran en un comando.

`db:seed:local` **borra** el contenido de las tablas antes de insertar, así
que cada corrida deja la base en un estado conocido.

### Dónde vive la base local

La D1 local es un SQLite que administra Miniflare:

```text
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
```

Es un directorio **generado**: está fuera de git y se pierde al resetear el
estado. No guardes ahí nada que quieras conservar; para reconstruirlo,
`npm run db:migrate:local && npm run db:seed:local`.

Para inspeccionarla hay tres caminos:

```bash
npm run db:query                                    # resumen de tablas y filas
npm run db:query -- "SELECT email, name FROM users LIMIT 5"
```

`db:query` lee el archivo directamente, así que no necesita que haya un
servidor levantado, y **sólo acepta lecturas** (`SELECT`, `WITH`, `PRAGMA`,
`EXPLAIN`) para no borrar datos por accidente.

Con un servidor corriendo, `wrangler` trae un explorador web en
`/cdn-cgi/local/explorer` que permite navegar tablas y correr SQL. Y para una
app de escritorio, cualquier cliente SQLite abre ese archivo — pero cerrá
antes `dev` o `preview`, porque en Windows el archivo queda bloqueado.

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

### Login con Google (opiniones)

Para publicar una opinión hace falta identidad (RF-148). El flujo está
implementado; sólo faltan las credenciales, que son secretos y no viven en el
repositorio.

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   creá un **OAuth 2.0 Client ID** de tipo *Web application*.
2. Agregá como *Authorized redirect URI*:

   ```text
   https://quienlohace-marketplace.akiens-dev.workers.dev/auth/google/callback
   ```

   Para probar en local, sumá también `http://localhost:8787/auth/google/callback`.
3. Cargá las credenciales como secretos del Worker:

   ```bash
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

Sin estas variables el sitio funciona igual: el botón de Google no se muestra
y las opiniones quedan en modo lectura. Nada más se degrada.

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
│   ├── actions/            auth.ts · profile.ts · reviews.ts
│   ├── dashboard/          panel del proveedor
│   ├── planes/             comparación pública de planes
│   ├── auth/google/        login de clientes (inicio y callback)
│   ├── api/session/        estado de sesión para el header
│   ├── api/review-context/ identidad para el formulario de opinión
│   ├── media/[...key]/     sirve imágenes desde R2
│   └── …                   público: inicio, buscar, categorías, perfiles
├── application/          Casos de uso
├── domain/               Puertos (interfaces) y reglas de planes
├── infrastructure/       Adapters D1/R2 — único lugar con bindings
├── components/           UI
├── data/                 Master Data: ubicaciones, taxonomía, FAQ
├── lib/                  Sesión, contraseñas, validación, búsqueda, OAuth
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
perfil por etapas, publicar/despublicar, búsqueda, filtros, categorías,
perfiles públicos, planes con sus límites, y opiniones con alta, edición y
borrado.

Pendiente:

- **Credenciales de Google** — el flujo de login de clientes está completo,
  pero sin `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` el botón no se muestra
  y las opiniones quedan de sólo lectura. Ver
  [Login con Google](#login-con-google-opiniones).
- **Campos con schema pero sin UI** — horarios por día, integrantes del
  equipo, redes sociales y subcategorías múltiples tienen tablas y tipos
  (migración `0002`), falta el formulario que los edite.
- **Subida de imágenes desde el panel** — el backend está
  (`addProviderImage`, R2, `/media/...`), falta el control en el formulario.
- **Cobro de suscripciones** — los planes y sus límites se aplican, pero no
  hay pasarela de pago: el plan se asigna en la base.
- **Turnstile y rate limiting** en formularios sensibles (RF-155 a RF-162).
- **Tracking de eventos propio** (RF-130 a RF-142).
- **App de administración** (`admin.quienlohace.uy`) — es una aplicación
  aparte, según `arquitectura-actualizada.md`.
- Verificación de email y recuperación de contraseña.

## Marca

Assets en `public/brand/`; el set completo en `template-quienlohace/brand/`.
Los tokens visuales están en [tailwind.config.ts](tailwind.config.ts).
