"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Icon } from "@/components/ui";
import { CONTACT_REASONS, contactSchema } from "@/lib/validation";
import { FIELD_ERROR_DELAY_MS } from "@/lib/use-field-errors";

type Fields = {
  nombre: string;
  email: string;
  motivo: (typeof CONTACT_REASONS)[number];
  mensaje: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

/*
 * La etiqueta en español de cada motivo. Los valores son los de
 * `CONTACT_REASONS`, en el schema: el tipo del índice obliga a que esta lista
 * y la regla no puedan separarse.
 */
const MOTIVO_LABELS: Record<(typeof CONTACT_REASONS)[number], string> = {
  consulta: "Consulta general",
  perfil: "Ayuda con mi perfil",
  publicidad: "Publicidad y patrocinios",
  reporte: "Reportar un problema",
};

const EMPTY: Fields = {
  nombre: "",
  email: "",
  motivo: "consulta",
  mensaje: "",
};

/**
 * Valida un campo contra su regla del schema. Devuelve el error, o "".
 *
 * Las reglas salen de `contactSchema` (TR-039), el mismo del que tendría que
 * validar el servidor cuando este formulario deje de ser una simulación: un
 * solo lugar donde dice qué correo es válido.
 */
function validateField<K extends keyof Fields>(field: K, value: string): string {
  const parsed = contactSchema.shape[field].safeParse(value);
  return parsed.success ? "" : (parsed.error.issues[0]?.message ?? "");
}

export function ContactForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  /** Los campos que ya se dejaron: recién ahí se muestra su error. */
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>(
    {},
  );
  const [sent, setSent] = useState(false);

  /*
   * Un temporizador por campo para la pausa: cada tecla cancela el suyo, y
   * dos campos escribiéndose no se pisan el turno.
   */
  const revealTimers = useRef<
    Partial<Record<keyof Fields, ReturnType<typeof setTimeout>>>
  >({});

  useEffect(() => {
    const pending = revealTimers.current;
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer);
    };
  }, []);

  /*
   * Mientras se escribe (TR-039).
   *
   * Corregirlo se nota en el acto; si sigue mal, el error aparece recién tras
   * una pausa sin teclas. Escribiendo de corrido no marca en rojo un correo a
   * medio tipear (`ana@`), y al detenerse avisa sin tener que salir del campo.
   */
  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));

    const message = validateField(key, value);
    setErrors((current) => ({ ...current, [key]: message || undefined }));

    clearTimeout(revealTimers.current[key]);
    if (message) {
      revealTimers.current[key] = setTimeout(() => {
        delete revealTimers.current[key];
        setTouched((current) =>
          current[key] ? current : { ...current, [key]: true },
        );
      }, FIELD_ERROR_DELAY_MS);
    }
  }

  /** Al salir del campo: el error se muestra ya, sin esperar la pausa. */
  function blur<K extends keyof Fields>(key: K) {
    clearTimeout(revealTimers.current[key]);
    delete revealTimers.current[key];
    setTouched((current) => ({ ...current, [key]: true }));
    const message = validateField(key, fields[key]);
    setErrors((current) => ({ ...current, [key]: message || undefined }));
  }

  const parsed = contactSchema.safeParse(fields);

  /*
   * El botón se enciende sólo con todo válido (TR-039): uno encendido que al
   * apretarlo no hace nada se lee como roto.
   */
  const canSubmit = parsed.success;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!parsed.success) {
      // Enviar es pedir que se revise todo: se muestran todos los errores.
      const found: Errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof Fields | undefined;
        if (field && !found[field]) found[field] = issue.message;
      }
      setErrors(found);
      setTouched({ nombre: true, email: true, motivo: true, mensaje: true });
      return;
    }

    setSent(true);
    setFields(EMPTY);
    setErrors({});
    setTouched({});
  }

  /** Un error sólo se muestra si el campo ya se dejó o si se intentó enviar. */
  function shownError<K extends keyof Fields>(key: K): string | undefined {
    return touched[key] ? errors[key] : undefined;
  }

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-card border border-[#D6EFE0] bg-[#F4FBF7] p-6"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-whatsapp/10">
          <Icon name="check_circle" filled className="text-[24px] text-whatsapp" />
        </span>
        <h2 className="text-[18px] font-bold text-ink">Mensaje enviado</h2>
        <p className="text-[14.5px] leading-relaxed text-ink-muted">
          Gracias por escribirnos. Respondemos dentro de las próximas 48 horas
          hábiles al correo que nos dejaste.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setSent(false)}>
          Enviar otro mensaje
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-card border border-line bg-white p-6"
    >
      <Field
        label="Nombre"
        htmlFor="nombre"
        error={shownError("nombre")}
        required
      >
        <input
          id="nombre"
          type="text"
          value={fields.nombre}
          onChange={(event) => update("nombre", event.target.value)}
          onBlur={() => blur("nombre")}
          aria-invalid={Boolean(shownError("nombre"))}
          aria-describedby={shownError("nombre") ? "nombre-error" : undefined}
          className={inputClass(Boolean(shownError("nombre")))}
        />
      </Field>

      <Field label="Correo" htmlFor="email" error={shownError("email")} required>
        <input
          id="email"
          type="email"
          value={fields.email}
          onChange={(event) => update("email", event.target.value)}
          onBlur={() => blur("email")}
          aria-invalid={Boolean(shownError("email"))}
          aria-describedby={shownError("email") ? "email-error" : undefined}
          className={inputClass(Boolean(shownError("email")))}
        />
      </Field>

      <Field label="Motivo" htmlFor="motivo">
        <select
          id="motivo"
          value={fields.motivo}
          onChange={(event) =>
            update("motivo", event.target.value as Fields["motivo"])
          }
          className={inputClass(false)}
        >
          {CONTACT_REASONS.map((motivo) => (
            <option key={motivo} value={motivo}>
              {MOTIVO_LABELS[motivo]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Mensaje" htmlFor="mensaje" error={shownError("mensaje")} required>
        <textarea
          id="mensaje"
          rows={5}
          value={fields.mensaje}
          onChange={(event) => update("mensaje", event.target.value)}
          onBlur={() => blur("mensaje")}
          aria-invalid={Boolean(shownError("mensaje"))}
          aria-describedby={shownError("mensaje") ? "mensaje-error" : undefined}
          className={`${inputClass(Boolean(shownError("mensaje")))} h-auto resize-y py-2.5`}
        />
      </Field>

      <Button type="submit" className="self-start" disabled={!canSubmit}>
        Enviar mensaje
      </Button>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "h-11 w-full rounded-input border bg-white px-3 text-[15px] text-ink outline-none transition-colors",
    "placeholder:text-ink-faint focus:border-brand-800",
    hasError ? "border-[#D92D20]" : "border-line-strong",
  ].join(" ");
}

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-ink">
        {label}
        {required ? <span className="text-[#D92D20]"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#D92D20]"
        >
          <Icon name="error" className="text-[15px]" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
