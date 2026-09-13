"use client";

import { useCallback, useState } from "react";

/**
 * Los errores por campo de un formulario, con el momento correcto para cada
 * uno (TR-039).
 *
 * Quien la usa pone la regla: `validate` recibe campo y valor y devuelve el
 * mensaje, o `""` si está bien. De dónde sale esa regla —un schema de Zod
 * compartido con el servidor— es cosa del formulario.
 *
 * El reparto de responsabilidades:
 *
 * - `edit` se llama al cambiar el valor, pero no lo valida: sólo retira el
 *   error anterior porque ya correspondía a otro valor.
 * - `blur` se llama al salir del campo. Muestra el error ya, sin esperar.
 * - `submitAll` se llama al enviar. Muestra todo lo que esté mal.
 */
export function useFieldErrors(
  validate: (field: string, value: unknown) => string,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Los campos cuyo error ya se puede mostrar. */
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  /** Al editar: descarta el resultado viejo sin ejecutar el schema. */
  const edit = useCallback(
    (field: string, value: unknown) => {
      void value;
      setErrors((current) =>
        current[field] ? { ...current, [field]: "" } : current,
      );
      setRevealed((current) =>
        current[field] ? { ...current, [field]: false } : current,
      );
    },
    [],
  );

  /** Al salir del campo: sin espera, ya se terminó de escribir. */
  const blur = useCallback(
    (field: string, value: unknown) => {
      setErrors((current) => ({ ...current, [field]: validate(field, value) }));
      setRevealed((current) => ({ ...current, [field]: true }));
    },
    [validate],
  );

  /**
   * Al enviar: se validan todos los campos dados y se muestran sus errores.
   * Devuelve los que fallaron, para poder cortar el envío.
   */
  const submitAll = useCallback(
    (values: Record<string, unknown>) => {
      const found: Record<string, string> = {};
      for (const [field, value] of Object.entries(values)) {
        const message = validate(field, value);
        if (message) found[field] = message;
      }

      setErrors((current) => ({ ...current, ...found }));
      setRevealed((current) => {
        const next = { ...current };
        for (const field of Object.keys(values)) next[field] = true;
        return next;
      });

      return found;
    },
    [validate],
  );

  /** Los errores que se ven: los que tienen mensaje y ya se pueden mostrar. */
  const shown: Record<string, string> = {};
  for (const [field, message] of Object.entries(errors)) {
    if (message && revealed[field]) shown[field] = message;
  }

  return { shown, errors, revealed, edit, blur, submitAll, setRevealed };
}
