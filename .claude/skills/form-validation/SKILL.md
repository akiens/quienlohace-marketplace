---
name: form-validation
description: Patrón de formularios de QuienLoHace: schemas Zod compartidos entre cliente y servidor (TR-039), cuándo mostrar y ocultar cada error, el aviso de resultado success/warning/error con FormAlert (TR-040), los campos de imagen con subida temporal y confirmación al guardar (TR-042, TR-043) y accesibilidad. Usar al crear o modificar cualquier formulario con entradas de la persona usuaria — registro, acceso, contacto, opiniones, perfil — al revisar validación existente, al mostrar el resultado de un envío, o al agregar un campo de subida de imágenes.
---

# Validación de formularios

Un formulario válido en este proyecto cumple tres cosas: **valida en el
servidor siempre**, **usa el mismo schema en los dos lados** y **muestra los
errores cuando ayudan, no mientras se escribe**.

La referencia viva es `src/components/login-panel.tsx` junto con
`src/app/actions/auth.ts`. Cuando algo de acá quede ambiguo, mirá ese par.

## 1. El schema vive en `src/lib/validation.ts`

Nunca escribas reglas de validación dentro del componente. Un schema de Zod,
exportado desde `src/lib/validation.ts`, y lo importan **tanto la Server
Action como el componente**. Si las reglas están en dos lados terminan
diciendo cosas distintas.

```ts
// src/lib/validation.ts
export const contactSchema = z.object({
  nombre: nameSchema,
  email: emailSchema,
  mensaje: z.string().trim().min(10, "Contanos un poco más."),
});
```

Reutilizá las piezas que ya existen (`nameSchema`, `emailSchema`,
`passwordSchema`) en vez de redefinir la regla.

## 2. El servidor valida siempre (TR-004, TR-039)

La validación del cliente es comodidad, no seguridad: se puede desactivar
JavaScript o mandar el `FormData` a mano. La Server Action **vuelve a validar
con el mismo schema** antes de tocar la base.

```ts
const parsed = signupSchema.safeParse({ ... });
if (!parsed.success) return { errors: fieldErrors(parsed.error) };
```

`fieldErrors()` traduce el `ZodError` al shape `Record<string, string>` que
usan los formularios. Los errores sin campo caen en la clave `form`.

## 3. Cuándo se muestra y cuándo se oculta un error

Esta es la parte que es fácil equivocar. El error aparece **mientras se
escribe**, no recién al salir del campo: quien tipea algo inválido tiene que
enterarse ahí mismo.

Validar en cada tecla, sin más, marcaría en rojo todo dato a medio tipear
(`ana@gmail.co` está mal hasta la última letra). Por eso al escribir se espera
una pausa corta sin teclas —`FIELD_ERROR_DELAY_MS`, 600 ms— antes de mostrar
el error. Cada tecla reinicia la espera.

| Momento | Qué hace |
|---|---|
| Al escribir, ya válido | **Quita** el error en el acto, sin esperar. |
| Al escribir, sigue inválido | **Muestra** el error tras la pausa. |
| `onBlur` | **Muestra** el error ya: se terminó de escribir. |
| `onSubmit` | Valida todo, muestra todos los errores y corta el envío. |

La asimetría es deliberada: corregir se nota siempre al instante, equivocarse
tras la pausa. Dejar el rojo puesto mientras se piensa si ya está bien es peor
que ponerlo tarde.

No lo implementes a mano: `useFieldErrors` (`src/lib/use-field-errors.ts`)
tiene los temporizadores por campo y los tres momentos resueltos.

```tsx
const fieldErrors = useFieldErrors(validateField);

<input
  onChange={(e) => fieldErrors.edit("email", e.target.value)}
  onBlur={(e) => fieldErrors.blur("email", e.target.value)}
  aria-invalid={fieldErrors.shown.email ? true : undefined}
/>
```

`shown` son los errores que ya se pueden mostrar; un campo intacto no aparece
en rojo antes de escribir nada.

## 4. Cuándo se habilita el botón de envío (TR-039)

El botón está encendido **sólo si** se cumplen las tres a la vez:

1. Hay algo que enviar: en edición, algún control cambió respecto de lo
   guardado (`dirty`); en un alta, están los obligatorios.
2. Ningún campo tiene un valor inválido según su schema.
3. No hay un envío en curso (`pending`).

```tsx
const canSave = canSubmit && invalidFields.length === 0 && (!editing || dirty);
```

Un botón encendido que al apretarlo no hace nada se lee como roto; uno
apagado que dice qué falta, no. La contracara: un cambio válido **enciende el
botón solo**, sin apretar nada más.

Tras un envío exitoso el formulario vuelve a esperar: lo recién guardado pasa
a ser el punto de partida y el botón se apaga hasta el próximo cambio.

La referencia es `profile-form.tsx`, que ya lo hace entero.

## 5. Los errores del servidor caducan al editar

Si el servidor respondió "El correo entrado ya está en uso." y la persona
escribe otro correo, ese mensaje ya no habla del valor que está en pantalla.
Marcá el campo como *stale* al primer `onInput` y volvé a considerar los
errores del servidor recién en el próximo envío.

La excepción es el error general (clave `form`): "Correo o contraseña
incorrectos." se queda hasta reenviar, porque sólo un envío nuevo puede
saber si las credenciales nuevas sirven.

## 6. Dónde va cada error

- **De un campo** → debajo de su input, con el borde del input en rojo.
- **General** (clave `form`) → depende del formulario:
  - En **acceso y registro**, debajo del botón de envío. Es una excepción
    deliberada (TR-040): esos formularios son cortos y un aviso arriba
    desplazaba todo el contenido al aparecer.
  - En el **resto**, como banda pegada al encabezado, con `FormAlert` (§7).

## 7. El aviso del resultado (TR-040)

Todo envío termina diciendo cómo salió. No escribas el aviso a mano con
colores literales: es `FormAlert`, que envuelve el `Banner` del sitio, se
pega al encabezado, dura 15 s y trae la cruz para cerrarlo antes.

```tsx
<FormAlert
  message={
    state.message ??
    state.errors?.form ??
    (state.errors ? "Revisá los campos marcados." : undefined)
  }
  tone={state.tone ?? (state.errors ? "error" : "success")}
  // El objeto de estado, que `useActionState` devuelve nuevo en cada
  // respuesta: sin esto dos envíos de igual texto no darían señal.
  resetKey={state}
/>
```

Los tres tonos:

| Tono | Cuándo |
|---|---|
| `success` | Salió como se pedía. |
| `warning` | Salió, pero con una consecuencia que hay que saber. |
| `error` | No salió. |

El tono se deduce solo —`message` es éxito, `errors` es error—, así que
`warning` es el único que hay que pedir a mano, desde el servidor:

```ts
return {
  tone: "warning",
  message: "Guardamos los cambios, pero tu perfil dejó de estar publicado.",
};
```

Dos cosas que es fácil equivocar:

- Un rechazo por validación vuelve con los errores **por campo** y sin
  `form`. Sin un mensaje de respaldo el aviso queda mudo justo cuando hay
  algo que decir.
- Un formulario que **se reemplaza** por una confirmación final (opiniones,
  contacto) no usa `FormAlert`: ese mensaje no debe desaparecer solo.

## 8. Accesibilidad

Cada error necesita las tres cosas:

```tsx
<input
  aria-invalid={errors.email ? true : undefined}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
...
<p id="email-error" role="alert">{errors.email}</p>
```

`role="alert"` hace que se anuncie al aparecer; `aria-describedby` lo asocia
al campo. El `id` tiene que coincidir con el `aria-describedby`.

El `<form>` lleva `noValidate`: los mensajes nativos del navegador están en
otro idioma, no se pueden traducir y contradicen a los del servidor. Los
atributos (`required`, `minLength`) se dejan igual porque siguen describiendo
el campo.

## 9. Mensajes

En español rioplatense, en el mismo tono que el resto del sitio, y diciendo
qué hacer. El mensaje vive en el schema, no en el componente, así el cliente
y el servidor dicen lo mismo.

- Falta el dato → `Debe entrar un nombre.`
- El dato no sirve → `El nombre entrado no es válido.`
- Regla incumplida → `La contraseña no cumple con el mínimo de caracteres requeridos.`
- Falla de infraestructura → `No fue posible el registro, por favor intente más tarde.`

## 10. Campos de imagen (TR-042, TR-043)

Las imágenes no viajan en el envío del formulario: se suben apenas se eligen y
quedan **pendientes** hasta que el guardado las confirme. Lo que sí viaja es
la selección — qué imágenes quedan y en qué orden.

No lo implementes de nuevo. El campo es reusable:

```tsx
<ImageField
  field="avatar"          // de acá salen todos los límites
  shape="circle"          // "circle" | "wide" | "grid"
  label="Foto de perfil"
  initial={images.filter((i) => i.kind === "avatar")}
  onChange={onImageChange("avatar")}
/>
```

Para un campo **nuevo** alcanza con declararlo en `src/domain/image-policy.ts`
—cuántas, cuánto pesan, qué formatos, qué dimensiones, qué proporción— y
montarlo. Nada más se toca.

El formulario tiene que hacer tres cosas:

1. Guardar lo que `onChange` le pasa, por campo.
2. Apagar el botón de guardar mientras algún campo esté `busy`.
3. Mandar los `keepIds` como campos ocultos, y llamar a
   `commitImageSelection` en la acción **después** de guardar el resto.

Lo que resuelven el hook y el campo, y por lo que no conviene reimplementarlos:
estado por imagen, reintento que no arrastra a las demás, validación local
antes de gastar red, reducción en el navegador, `objectURL` revocados, y la
diferencia entre quitar una pendiente (se borra) y una confirmada (se marca, y
la aplica el guardado).

## 11. El error real nunca sale al navegador (TR-041)

Toda operación que pueda fallar por infraestructura —base, hash, red,
almacenamiento— va dentro de un `try`. **Una Server Action no puede dejar
escapar una excepción**: sin `catch`, el error sube al renderer y termina en
la pantalla, con su mensaje real a la vista.

```ts
try {
  saved = await profiles.update(existing.id, fitted, limits);
} catch (error) {
  console.error("saveProfile failed", error);
  return { errors: { form: SAVE_FAILED } };
}
```

El error entero va al log; de vuelta va una frase genérica y estable, definida
como constante. Nunca el `message` de la excepción, el stack, el SQL ni el
nombre de una tabla, una columna o un constraint.

Un error de base que **sí** corresponde a una regla del producto se traduce al
mensaje de esa regla antes de salir: el choque del índice único de
`users.email` se responde con `El correo entrado ya está en uso.`, nunca con
el texto del constraint.

## Al terminar

- [ ] El schema está en `src/lib/validation.ts` y lo usan los dos lados.
- [ ] La Server Action valida antes de tocar la base.
- [ ] El error aparece escribiendo, tras la pausa; se va al instante al
      corregir. `onBlur` y `onSubmit` lo muestran sin esperar.
- [ ] Los errores del servidor caducan al editar el campo.
- [ ] El error general va donde corresponde: banda con `FormAlert`, o
      debajo del botón en acceso y registro.
- [ ] El envío termina con un aviso de resultado, con el tono correcto.
- [ ] El rechazo por validación no deja el aviso mudo.
- [ ] El botón se enciende sólo con cambios y todo válido.
- [ ] Ninguna operación que toque la base quedó fuera de un `try`.
- [ ] Ningún mensaje al navegador lleva el error real.
- [ ] Los campos de imagen usan `ImageField`, con su política declarada.
- [ ] El botón de guardar espera a que ninguna imagen esté en curso.
- [ ] `aria-invalid`, `aria-describedby`, `role="alert"` e `id` puestos.
- [ ] `noValidate` en el `<form>`.
