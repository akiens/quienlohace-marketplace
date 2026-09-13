"use client";

import { useActionState, useState } from "react";

import { updatePassword, type FormState } from "@/app/actions/auth";
import { GoogleMark } from "@/components/google-mark";
import { Button, Icon, SECONDARY_SURFACE } from "@/components/ui";
import { fieldErrors, passwordUpdateSchema } from "@/lib/validation";

export function AccountSecurity({
  email,
  hasPassword,
  googleConnected,
  authStatus,
}: {
  email: string;
  hasPassword: boolean;
  googleConnected: boolean;
  authStatus?: string;
}) {
  const [editingPassword, setEditingPassword] = useState(!hasPassword);
  const [state, action, pending] = useActionState<FormState, FormData>(
    updatePassword,
    {},
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [staleServerFields, setStaleServerFields] = useState<Record<string, boolean>>({});

  function validate(formData: FormData): Record<string, string> {
    const parsed = passwordUpdateSchema.safeParse({
      currentPassword: formData.get("currentPassword") ?? "",
      newPassword: formData.get("newPassword"),
      passwordConfirm: formData.get("passwordConfirm"),
    });
    return parsed.success ? {} : fieldErrors(parsed.error);
  }

  function handleInput(event: React.FormEvent<HTMLFormElement>) {
    const field = (event.target as HTMLInputElement).name;
    if (!field) return;
    setClientErrors((current) =>
      current[field] ? { ...current, [field]: "" } : current,
    );
    setStaleServerFields((current) =>
      current[field] ? current : { ...current, [field]: true },
    );
    if (field === "newPassword") {
      setClientErrors((current) =>
        current.passwordConfirm ? { ...current, passwordConfirm: "" } : current,
      );
      setStaleServerFields((current) =>
        current.passwordConfirm
          ? current
          : { ...current, passwordConfirm: true },
      );
    }
  }

  function handleBlur(event: React.FocusEvent<HTMLFormElement>) {
    const field = event.target.name;
    if (!field) return;
    const found = validate(new FormData(event.currentTarget));
    setClientErrors((current) => ({ ...current, [field]: found[field] ?? "" }));
  }

  const errors = { ...(state.errors ?? {}) };
  for (const field of Object.keys(staleServerFields)) delete errors[field];
  Object.assign(errors, clientErrors);

  const googleMessage =
    authStatus === "google-linked"
      ? "Tu cuenta de Google quedó vinculada."
      : authStatus === "conflict"
        ? "Esa cuenta de Google ya está vinculada a otra cuenta profesional."
        : authStatus === "error"
          ? "No pudimos vincular Google. Intentá nuevamente."
          : "";

  return (
    <section className="flex w-full min-w-0 flex-col gap-5 rounded-card border border-line bg-white p-5 shadow-panel sm:p-6">
      <header className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-brand-100">
          <Icon name="shield_lock" className="text-[21px] text-brand-800" />
        </span>
        <div>
          <h2 className="text-[17px] font-bold text-ink">Acceso y seguridad</h2>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">
            Elegí Google, contraseña o ambos. Tu perfil y tus datos son los
            mismos con cualquiera de los dos métodos.
          </p>
        </div>
      </header>

      {googleMessage ? (
        <StatusMessage
          success={authStatus === "google-linked"}
          message={googleMessage}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AccessMethod
          icon={<GoogleMark className="h-5 w-5" />}
          title="Google"
          detail={
            googleConnected
              ? "Conectado a tu cuenta"
              : "Todavía no está conectado"
          }
          active={googleConnected}
        >
          {!googleConnected ? (
            <a
              href="/auth/google?account=provider&mode=link&returnTo=%2Fdashboard"
              className={`mt-3 flex h-10 items-center justify-center gap-2 rounded-input px-3 text-[13.5px] font-semibold ${SECONDARY_SURFACE}`}
            >
              <GoogleMark />
              Vincular Google
            </a>
          ) : null}
        </AccessMethod>

        <AccessMethod
          icon={<Icon name="password" className="text-[21px] text-brand-800" />}
          title="Correo y contraseña"
          detail={hasPassword ? email : `Sin contraseña para ${email}`}
          active={hasPassword}
        >
          {!editingPassword ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setEditingPassword(true)}
            >
              Cambiar contraseña
            </Button>
          ) : null}
        </AccessMethod>
      </div>

      {editingPassword ? (
        <form
          action={action}
          noValidate
          onInput={handleInput}
          onBlur={handleBlur}
          onSubmit={(event) => {
            const found = validate(new FormData(event.currentTarget));
            if (Object.keys(found).length === 0) return;
            event.preventDefault();
            setClientErrors(found);
          }}
          className="flex flex-col gap-4 border-t border-line-soft pt-5"
        >
          <div>
            <h3 className="text-[15px] font-bold text-ink">
              {hasPassword ? "Cambiar contraseña" : "Crear una contraseña"}
            </h3>
            <p className="mt-1 text-[13px] text-ink-soft">
              {hasPassword
                ? "Confirmá la actual antes de guardar una nueva."
                : "Es opcional. Al crearla también vas a poder entrar con tu correo."}
            </p>
          </div>

          {hasPassword ? (
            <PasswordField
              name="currentPassword"
              label="Contraseña actual"
              autoComplete="current-password"
              error={errors.currentPassword}
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              name="newPassword"
              label="Nueva contraseña"
              autoComplete="new-password"
              error={errors.newPassword}
              hint="Mínimo 8 caracteres."
            />
            <PasswordField
              name="passwordConfirm"
              label="Repetir contraseña"
              autoComplete="new-password"
              error={errors.passwordConfirm}
            />
          </div>

          {errors.form ? (
            <StatusMessage message={errors.form} success={false} />
          ) : null}
          {state.message ? (
            <StatusMessage message={state.message} success />
          ) : null}

          <div className="flex flex-wrap gap-2.5">
            <Button type="submit" size="sm" disabled={pending}>
              {pending
                ? "Guardando…"
                : hasPassword
                  ? "Guardar contraseña"
                  : "Crear contraseña"}
            </Button>
            {hasPassword ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditingPassword(false)}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

function AccessMethod({
  icon,
  title,
  detail,
  active,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  active: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-input border border-line p-4">
      <div className="flex items-center gap-2.5">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink">{title}</p>
          <p className="truncate text-[12.5px] text-ink-soft">{detail}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
            active
              ? "bg-[#E8F6EF] text-[#1E8C56]"
              : "bg-surface-sunken text-ink-faint"
          }`}
        >
          {active ? "Activo" : "Opcional"}
        </span>
      </div>
      {children}
    </div>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
  error,
  hint,
}: {
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const errorId = `${name}-account-error`;
  return (
    <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold text-ink">
      {label}
      <input
        name={name}
        type="password"
        required
        minLength={name === "currentPassword" ? undefined : 8}
        maxLength={200}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`h-11 rounded-input border bg-white px-3 text-[15px] font-normal text-ink outline-none transition-colors focus:border-brand-800 ${
          error ? "border-[#D92D20]" : "border-line-strong"
        }`}
      />
      {error ? (
        <span id={errorId} role="alert" className="text-[12.5px] font-medium text-[#B42318]">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[12px] font-normal text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

function StatusMessage({
  message,
  success,
}: {
  message: string;
  success: boolean;
}) {
  return (
    <p
      role={success ? "status" : "alert"}
      className={`flex items-center gap-2 rounded-input border p-3 text-[13px] font-medium ${
        success
          ? "border-[#D6EFE0] bg-[#F4FBF7] text-[#1E8C56]"
          : "border-[#FDA29B] bg-[#FFFBFA] text-[#B42318]"
      }`}
    >
      <Icon name={success ? "check_circle" : "error"} className="text-[17px]" />
      {message}
    </p>
  );
}
