---
name: project-rules
description: Reglas vigentes de QuienLoHace y cómo consultarlas antes de escribir código. Usar SIEMPRE antes de implementar o modificar comportamiento del producto — perfiles, planes, opiniones, formularios, taxonomía, ubicaciones, imágenes, sesiones, estados, persistencia — y antes de dar por terminado un cambio, para verificar que no contradice una regla ya escrita. También al agregar una regla nueva.
---

# Reglas del proyecto

Este proyecto documenta sus reglas y las cita desde el código. Una regla
escrita gana sobre lo que parezca razonable en el momento: si el código y una
regla no coinciden, lo que está mal es el código, salvo que la regla se
cambie a propósito y por escrito.

**No implementes comportamiento del producto sin haber leído la regla que lo
gobierna.** Si no existe, decilo antes de inventarla.

## Dónde está cada cosa

| Documento | Qué manda | Identificadores |
|---|---|---|
| `docs/rules/business_rules.md` | Qué puede y qué no puede hacer el producto. | `BR-*` |
| `docs/rules/technical_rules.md` | Cómo se implementa y se valida. | `TR-*` |
| `docs/data/databases_and_relationships.md` | Esquema físico, constraints, índices. | — |
| `docs/data/planes.md` | Presentación comercial de los planes. | — |
| `docs/data/locations.md`, `rubros_especialidades_servicios.md`, `sugerencias_horarios.md` | Datos canónicos. No son reglas. | — |
| `docs/ui/*.md` | Comportamiento esperado de pantallas concretas. | — |

**Precedencia**, ya fijada por los propios documentos:

1. `business_rules.md` gana en lo funcional.
2. `technical_rules.md` gana en lo técnico.
3. Los documentos de datos y de esquema **aplican** reglas, no las redefinen.

Si dos documentos se contradicen, el cambio se detiene hasta resolverlo en
todos los afectados. No elijas uno por tu cuenta.

### Cuidado con `RF-*`

El código cita unos treinta identificadores `RF-*` (`RF-163`, `RF-053`,
`RF-128`…) que **no existen en ningún documento**: quedaron de una numeración
anterior. Son una pista de que ahí hay una regla, no una referencia que se
pueda seguir.

Si te cruzás con uno, buscá la regla vigente por tema. El caso más citado,
`RF-163`, es hoy TR-004 y TR-039. **No agregues citas `RF-*` nuevas**: un
identificador que no se puede buscar no sirve de nada.

## Antes de escribir código

1. **Buscá la regla por tema**, no de memoria:

   ```bash
   grep -rn "opinión\|calificación" docs/rules/
   grep -n "BR-003\|TR-016" docs/rules/*.md
   ```

2. **Buscá cómo la cita el código.** Los comentarios llevan el identificador,
   así que el precedente aparece solo:

   ```bash
   grep -rn "TR-039" src/
   ```

3. **Leé la regla entera**, no el título. Casi todas tienen una excepción
   escrita, y esa excepción suele ser exactamente el caso que tenés enfrente.

## Reglas que se olvidan seguido

Estas son las que más veces se rompen por escribir sin mirar:

- **TR-039 — Validación en las dos capas.** Todo formulario valida en cliente
  y servidor con **un solo schema de Zod** en `src/lib/validation.ts`. El
  servidor valida siempre, aunque el cliente ya lo haya hecho.
- **TR-040 — Aviso del resultado.** Todo envío termina con un aviso
  `success` / `warning` / `error` usando `FormAlert`. Nunca a mano con
  colores literales.
- **TR-041 — Los errores no revelan el detalle técnico.** Ninguna Server
  Action deja escapar una excepción: todo lo que toca la base va en un `try`,
  el error entero al log y de vuelta una frase genérica.
- **TR-004 — Entrada y autorización.** Se autentica y autoriza antes de leer
  o mutar; los errores no revelan credenciales ni cuentas ajenas.
- **TR-006 — Reglas derivadas.** Los requisitos y los cupos los evalúa el
  servidor; nunca se confía en un flag que mandó el cliente.
- **TR-001 — Nombres.** `snake_case` en inglés en la base; las etiquetas en
  español son de la UI. No se persisten valores derivados.

Para formularios, la guía completa está en la skill `form-validation`, que
desarrolla TR-039 y TR-040 con el detalle de cuándo mostrar y ocultar cada
error.

## Si la regla no existe

Puede pasar: hay comportamiento en el código que nunca se escribió como
regla. En ese caso **no la inventes en silencio**.

1. Decí explícitamente que no encontraste regla para ese punto.
2. Proponé cuál debería ser, y por qué.
3. Implementá bajo ese supuesto, dejándolo dicho.

## Si hay que agregar una regla

- Va **una sola vez**, en el documento que manda según la tabla de arriba, y
  recibe un identificador nuevo, correlativo al último usado.
- Los demás documentos la **referencian** por identificador; no la repiten ni
  la reformulan. Repetirla es lo que produce dos versiones que divergen.
- El código que la implementa la cita en un comentario con su identificador,
  que es lo que la hace encontrable después.

## Al terminar un cambio

- [ ] Busqué la regla del tema antes de escribir, no después.
- [ ] Lo implementado no contradice ninguna `BR-*` ni `TR-*`.
- [ ] Si toqué comportamiento regido por una regla, la cité en el código.
- [ ] Si agregué una regla, está en un solo documento y con identificador.
- [ ] Si encontré una contradicción entre documentos, la reporté en vez de
      elegir uno.
