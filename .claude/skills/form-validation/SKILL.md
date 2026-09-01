---
name: form-validation
description: Patrón de validación de formularios de QuienLoHace: schemas Zod compartidos entre cliente y servidor, cuándo mostrar y ocultar cada error, y accesibilidad. Usar al crear o modificar cualquier formulario con entradas de la persona usuaria — registro, acceso, contacto, opiniones, perfil — o al revisar validación existente.
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

## 2. El servidor valida siempre (RF-163)

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

Esta es la parte que es fácil equivocar. La regla es **asimétrica**:

| Momento | Qué hace |
|---|---|
| `onBlur` | Valida el campo y **muestra** su error si lo hay. |
| `onInput` | **Sólo quita** el error si el valor pasó a ser válido. Nunca agrega. |
| `onSubmit` | Valida todo, muestra todos los errores y corta el envío. |

Escribir no puede *agregar* un error: marcaría en rojo un correo a medio
tipear (`ana@`), que es exactamente lo que la persona está por completar.
Escribir sí puede *sacarlo*, y eso es lo que deja ver que el campo ya va bien
antes de salir de él.

Un campo sólo muestra error si fue tocado (`touched`) o si hubo un envío
fallido; si no, el formulario aparecería en rojo antes de escribir nada.

## 4. Los errores del servidor caducan al editar

Si el servidor respondió "El correo entrado ya está en uso." y la persona
escribe otro correo, ese mensaje ya no habla del valor que está en pantalla.
Marcá el campo como *stale* al primer `onInput` y volvé a considerar los
errores del servidor recién en el próximo envío.

La excepción es el error general (clave `form`): "Correo o contraseña
incorrectos." se queda hasta reenviar, porque sólo un envío nuevo puede
saber si las credenciales nuevas sirven.

## 5. Dónde va cada error

- **De un campo** → debajo de su input, con el borde del input en rojo.
- **General** (clave `form`) → **debajo del botón de envío**, que es donde
  queda la vista después de enviar. Arriba del formulario empuja todo el
  contenido hacia abajo al aparecer.

## 6. Accesibilidad

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

## 7. Mensajes

En español rioplatense, en el mismo tono que el resto del sitio, y diciendo
qué hacer. El mensaje vive en el schema, no en el componente, así el cliente
y el servidor dicen lo mismo.

- Falta el dato → `Debe entrar un nombre.`
- El dato no sirve → `El nombre entrado no es válido.`
- Regla incumplida → `La contraseña no cumple con el mínimo de caracteres requeridos.`
- Falla de infraestructura → `No fue posible el registro, por favor intente más tarde.`

Nunca muestres el error real de una excepción: registralo con `console.error`
y devolvé un mensaje genérico. El detalle no le sirve a quien usa el sitio y
puede filtrar información de la infraestructura.

## Al terminar

- [ ] El schema está en `src/lib/validation.ts` y lo usan los dos lados.
- [ ] La Server Action valida antes de tocar la base.
- [ ] `onInput` sólo limpia; `onBlur` y `onSubmit` muestran.
- [ ] Los errores del servidor caducan al editar el campo.
- [ ] El error general va debajo del botón.
- [ ] `aria-invalid`, `aria-describedby`, `role="alert"` e `id` puestos.
- [ ] `noValidate` en el `<form>`.
