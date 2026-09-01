"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { login, signup, type FormState } from "@/app/actions/auth";
import { Button, Icon } from "@/components/ui";
import { credentialsSchema, fieldErrors, signupSchema } from "@/lib/validation";

/**
 * Acceso de proveedores. Envía a Server Actions: la validación y la
 * verificación de credenciales ocurren en el servidor.
 *
 * El modo lo fija la ruta que renderiza el panel: `/entrar` o `/registro`.
 * Antes vivía en un query param (`?perfil=1`) que el componente leía al
 * montar, así que navegar entre los dos modos desde el header no cambiaba el
 * formulario. Con una ruta por intención, cada página monta su propio panel y
 * el problema no puede volver.
 */
export function LoginPanel({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState<FormState, FormData>(
    isSignup ? signup : login,
    {},
  );

  /**
   * Errores detectados en el cliente, con los mismos schemas que usa la
   * acción. Es sólo para no esperar al servidor por algo que ya se sabe: el
   * servidor vuelve a validar siempre (RF-163).
   */
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  /**
   * Un campo sólo muestra su error después de que la persona lo dejó o de
   * un envío fallido. Validar mientras se escribe marcaría en rojo un correo
   * a medio tipear.
   */
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * Campos cuyo error del servidor ya no corresponde porque el valor cambió
   * después de recibirlo. Sin esto, "El correo entrado ya está en uso."
   * seguiría en pantalla mientras se escribe otro correo distinto.
   */
  const [staleServerFields, setStaleServerFields] = useState<
    Record<string, boolean>
  >({});

  const schema = isSignup ? signupSchema : credentialsSchema;

  /** Valida el formulario entero y devuelve los errores por campo. */
  function validate(formData: FormData): Record<string, string> {
    const values = {
      email: formData.get("email"),
      password: formData.get("password"),
      ...(isSignup ? { name: formData.get("name") } : {}),
    };
    const parsed = schema.safeParse(values);
    return parsed.success ? {} : fieldErrors(parsed.error);
  }

  /** Revalida un campo al salir de él, para corregir sin reenviar. */
  function handleBlur(event: React.FocusEvent<HTMLFormElement>) {
    const field = event.target.name;
    if (!field) return;
    setTouched((prev) => ({ ...prev, [field]: true }));
    const found = validate(new FormData(event.currentTarget));
    setClientErrors((prev) => ({ ...prev, [field]: found[field] ?? "" }));
  }

  /**
   * Mientras se escribe sólo se quitan errores, nunca se agregan: apenas el
   * valor pasa a ser válido el aviso desaparece, así se ve que el campo va
   * bien antes de salir de él. Marcar un error acá pintaría de rojo un
   * correo a medio tipear, que es justo lo que no se quiere.
   */
  function handleInput(event: React.FormEvent<HTMLFormElement>) {
    const field = (event.target as HTMLInputElement).name;
    if (!field) return;

    // El error del servidor se refería al valor anterior, que ya cambió.
    setStaleServerFields((prev) =>
      prev[field] ? prev : { ...prev, [field]: true },
    );

    const found = validate(new FormData(event.currentTarget));
    if (!found[field]) {
      setClientErrors((prev) =>
        prev[field] ? { ...prev, [field]: "" } : prev,
      );
    }
  }

  /**
   * Corta el envío si ya hay errores visibles. `requestSubmit` en el propio
   * form dispararía de nuevo esto, así que la acción se llama directamente.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const found = validate(formData);

    if (Object.keys(found).length > 0) {
      event.preventDefault();
      setClientErrors(found);
      setTouched({ name: true, email: true, password: true });
      return;
    }

    // Se envía: la respuesta que venga es sobre estos valores, así que los
    // errores del servidor vuelven a ser vigentes.
    setStaleServerFields({});
  }

  // El servidor manda, salvo en los campos que se editaron desde entonces:
  // ese error hablaba de un valor que ya no está escrito.
  const serverErrors = state.errors ?? {};
  const errors: Record<string, string> = {};
  for (const [field, message] of Object.entries(serverErrors)) {
    if (!staleServerFields[field]) errors[field] = message;
  }
  for (const [field, message] of Object.entries(clientErrors)) {
    if (message && touched[field] && !errors[field]) errors[field] = message;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
          {isSignup ? "Publicá tu perfil" : "Entrar a tu cuenta"}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          {isSignup
            ? "Creá tu cuenta de profesional o empresa. El perfil básico es gratis."
            : "Accedé para administrar tu perfil, tus servicios y tus zonas de trabajo."}
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
        {/*
          `key` reinicia el formulario al alternar entre entrar y registrarse.

          `noValidate` desactiva los mensajes nativos del navegador: dicen
          otra cosa que los del servidor y no se pueden traducir. Los
          atributos (`required`, `minLength`) se mantienen porque siguen
          describiendo el campo para la accesibilidad.
        */}
        <form
          key={mode}
          action={action}
          noValidate
          onBlur={handleBlur}
          onInput={handleInput}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {isSignup ? (
            <Field label="Nombre" htmlFor="name" error={errors.name}>
              <input
                id="name"
                name="name"
                required
                maxLength={80}
                autoComplete="name"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={inputClass(errors.name)}
              />
            </Field>
          ) : null}

          <Field label="Correo" htmlFor="email" error={errors.email}>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={inputClass(errors.email)}
            />
          </Field>

          <Field label="Contraseña" htmlFor="password" error={errors.password}>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignup ? "new-password" : "current-password"}
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password
                  ? "password-error"
                  : isSignup
                    ? "password-hint"
                    : undefined
              }
              className={inputClass(errors.password)}
            />
            {isSignup && !errors.password ? (
              <p id="password-hint" className="text-[12.5px] text-ink-soft">
                Mínimo 8 caracteres.
              </p>
            ) : null}
          </Field>

          <Button type="submit" disabled={pending}>
            {pending
              ? "Un momento…"
              : isSignup
                ? "Crear mi cuenta"
                : "Entrar"}
          </Button>

          {/*
            Los errores que no son de un campo van debajo del botón: es donde
            queda la vista después de enviar, y no desplazan el formulario al
            aparecer, como sí hacía el aviso que estaba arriba de todo.
          */}
          {errors.form ? (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-input border border-[#FDA29B] bg-[#FFFBFA] p-3 text-[13.5px] font-medium text-[#B42318]"
            >
              <Icon name="error" className="text-[17px]" />
              {errors.form}
            </p>
          ) : null}
        </form>

        <p className="border-t border-line-soft pt-4 text-[14px] text-ink-soft">
          {isSignup ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"}{" "}
          {/* Un enlace real y no un botón: cambiar de modo ahora es cambiar
              de página, así que tiene que poder abrirse en otra pestaña y
              quedar en el historial. */}
          <Link
            href={isSignup ? "/entrar" : "/registro"}
            className="font-semibold text-brand-800 underline underline-offset-2"
          >
            {isSignup ? "Entrar" : "Publicá tu perfil"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        // `id` para que el input lo referencie y el lector lo lea junto al
        // campo; `role="alert"` para que se anuncie al aparecer.
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#D92D20]"
        >
          <Icon name="error" className="text-[15px]" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputClass(error?: string): string {
  return [
    "h-11 w-full rounded-input border bg-white px-3 text-[15px] text-ink outline-none",
    "transition-colors focus:border-brand-800",
    error ? "border-[#D92D20]" : "border-line-strong",
  ].join(" ");
}
