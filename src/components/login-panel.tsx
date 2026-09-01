"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, signup, type FormState } from "@/app/actions/auth";
import { Button, Icon } from "@/components/ui";

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
  const errors = state.errors ?? {};

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
        {errors.form ? (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-input border border-[#FDA29B] bg-[#FFFBFA] p-3 text-[13.5px] font-medium text-[#B42318]"
          >
            <Icon name="error" className="text-[17px]" />
            {errors.form}
          </p>
        ) : null}

        {/* `key` reinicia el formulario al alternar entre entrar y registrarse. */}
        <form key={mode} action={action} className="flex flex-col gap-4">
          {isSignup ? (
            <Field label="Nombre" htmlFor="name" error={errors.name}>
              <input
                id="name"
                name="name"
                required
                maxLength={80}
                autoComplete="name"
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
              className={inputClass(errors.password)}
            />
            {isSignup ? (
              <p className="text-[12.5px] text-ink-soft">Mínimo 8 caracteres.</p>
            ) : null}
          </Field>

          <Button type="submit" disabled={pending}>
            {pending
              ? "Un momento…"
              : isSignup
                ? "Crear mi cuenta"
                : "Entrar"}
          </Button>
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
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#D92D20]">
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
