"use client";

import { useState } from "react";

import { Button, Icon } from "@/components/ui";

type Fields = {
  nombre: string;
  email: string;
  motivo: string;
  mensaje: string;
};

type Errors = Partial<Record<keyof Fields, string>>;

const MOTIVOS = [
  { value: "consulta", label: "Consulta general" },
  { value: "perfil", label: "Ayuda con mi perfil" },
  { value: "publicidad", label: "Publicidad y patrocinios" },
  { value: "reporte", label: "Reportar un problema" },
];

const EMPTY: Fields = {
  nombre: "",
  email: "",
  motivo: "consulta",
  mensaje: "",
};

/**
 * En el prototipo el envío se simula. La validación es la misma que se
 * necesitaría con backend, y en producción debe repetirse del lado servidor:
 * nunca se confía sólo en el frontend.
 */
function validate(fields: Fields): Errors {
  const errors: Errors = {};

  if (fields.nombre.trim().length < 2) {
    errors.nombre = "Escribí tu nombre.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = "Revisá el correo: no parece una dirección válida.";
  }
  if (fields.mensaje.trim().length < 10) {
    errors.mensaje = "Contanos un poco más (al menos 10 caracteres).";
  }

  return errors;
}

export function ContactForm() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    // Limpia el error del campo apenas se corrige.
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSent(true);
    setFields(EMPTY);
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
        error={errors.nombre}
        required
      >
        <input
          id="nombre"
          type="text"
          value={fields.nombre}
          onChange={(event) => update("nombre", event.target.value)}
          aria-invalid={Boolean(errors.nombre)}
          aria-describedby={errors.nombre ? "nombre-error" : undefined}
          className={inputClass(Boolean(errors.nombre))}
        />
      </Field>

      <Field label="Correo" htmlFor="email" error={errors.email} required>
        <input
          id="email"
          type="email"
          value={fields.email}
          onChange={(event) => update("email", event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={inputClass(Boolean(errors.email))}
        />
      </Field>

      <Field label="Motivo" htmlFor="motivo">
        <select
          id="motivo"
          value={fields.motivo}
          onChange={(event) => update("motivo", event.target.value)}
          className={inputClass(false)}
        >
          {MOTIVOS.map((motivo) => (
            <option key={motivo.value} value={motivo.value}>
              {motivo.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Mensaje" htmlFor="mensaje" error={errors.mensaje} required>
        <textarea
          id="mensaje"
          rows={5}
          value={fields.mensaje}
          onChange={(event) => update("mensaje", event.target.value)}
          aria-invalid={Boolean(errors.mensaje)}
          aria-describedby={errors.mensaje ? "mensaje-error" : undefined}
          className={`${inputClass(Boolean(errors.mensaje))} h-auto resize-y py-2.5`}
        />
      </Field>

      <Button type="submit" className="self-start">
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
