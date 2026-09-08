"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cuánto se espera sin teclas antes de marcar un campo en rojo, en ms.
 *
 * El error tiene que aparecer mientras se escribe (TR-039), pero validar en
 * cada tecla marcaría en rojo todo correo a medio tipear: `ana@gmail.co` está
 * mal hasta la última letra. Esperar una pausa corta resuelve las dos cosas —
 * escribiendo de corrido no molesta, y al detenerse con algo inválido el
 * error sale solo, sin tener que abandonar el campo.
 */
export const FIELD_ERROR_DELAY_MS = 600;

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
 * - `edit` se llama en cada tecla. Saca el error al instante si el valor pasó
 *   a ser válido, y lo pone tras la pausa si sigue mal.
 * - `blur` se llama al salir del campo. Muestra el error ya, sin esperar.
 * - `submitAll` se llama al enviar. Muestra todo lo que esté mal.
 */
export function useFieldErrors(
  validate: (field: string, value: unknown) => string,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Los campos cuyo error ya se puede mostrar. */
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  /*
   * Un temporizador por campo: dos campos escribiéndose no se pisan el turno,
   * y cada uno cancela sólo el suyo al recibir otra tecla.
   */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const cancel = useCallback((field: string) => {
    const timer = timers.current[field];
    if (timer !== undefined) {
      clearTimeout(timer);
      delete timers.current[field];
    }
  }, []);

  // Al desmontar no queda ningún temporizador escribiendo en un estado muerto.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer);
    };
  }, []);

  /** En cada tecla. */
  const edit = useCallback(
    (field: string, value: unknown) => {
      cancel(field);
      const message = validate(field, value);

      /*
       * Corregirlo se nota en el acto: dejar el rojo puesto mientras se piensa
       * si ya está bien es peor que ponerlo tarde.
       */
      if (message === "") {
        setErrors((current) =>
          current[field] ? { ...current, [field]: "" } : current,
        );
        return;
      }

      // Sigue mal: se anota, y se muestra si la pausa se cumple.
      setErrors((current) =>
        current[field] === message ? current : { ...current, [field]: message },
      );

      timers.current[field] = setTimeout(() => {
        delete timers.current[field];
        setRevealed((current) =>
          current[field] ? current : { ...current, [field]: true },
        );
      }, FIELD_ERROR_DELAY_MS);
    },
    [cancel, validate],
  );

  /** Al salir del campo: sin espera, ya se terminó de escribir. */
  const blur = useCallback(
    (field: string, value: unknown) => {
      cancel(field);
      setErrors((current) => ({ ...current, [field]: validate(field, value) }));
      setRevealed((current) => ({ ...current, [field]: true }));
    },
    [cancel, validate],
  );

  /**
   * Al enviar: se validan todos los campos dados y se muestran sus errores.
   * Devuelve los que fallaron, para poder cortar el envío.
   */
  const submitAll = useCallback(
    (values: Record<string, unknown>) => {
      const found: Record<string, string> = {};
      for (const [field, value] of Object.entries(values)) {
        cancel(field);
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
    [cancel, validate],
  );

  /** Los errores que se ven: los que tienen mensaje y ya se pueden mostrar. */
  const shown: Record<string, string> = {};
  for (const [field, message] of Object.entries(errors)) {
    if (message && revealed[field]) shown[field] = message;
  }

  return { shown, errors, revealed, edit, blur, submitAll, setRevealed };
}
