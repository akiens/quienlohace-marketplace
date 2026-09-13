"use client";

import { Fragment, useState } from "react";
import { Button, Icon } from "@/components/ui";
import { normalize } from "@/data/services";
import type { SearchOption } from "./search-select";

export const PROFILE_STEPS = [
  {
    id: "rubro",
    label: "Especialidades",
    icon: "category",
    feature: null,
    question: "¿A qué te dedicás?",
    help: "Elegí las especialidades que mejor describen tu trabajo.",
  },
  {
    id: "servicios",
    label: "Servicios",
    icon: "build",
    feature: null,
    question: "¿Qué servicios ofrecés?",
    help: "Agregá los trabajos que pueden contratarte.",
  },
  {
    id: "identidad",
    label: "Identidad",
    icon: "badge",
    feature: null,
    question: "¿Cómo querés presentarte?",
    help: "Así te reconocerán quienes busquen tus servicios.",
  },
  {
    id: "zonas",
    label: "Ubicación",
    icon: "location_on",
    feature: null,
    question: "¿Dónde y cómo trabajás?",
    help: "Contanos cómo atendés y qué zonas cubrís.",
  },
  {
    id: "contacto",
    label: "Contacto",
    icon: "call",
    feature: null,
    question: "¿Cómo pueden contactarte?",
    help: "Elegí qué datos mostrar en tu perfil.",
  },
  {
    id: "imagenes",
    label: "Imágenes",
    icon: "photo_camera",
    feature: null,
    question: "Mostrá quién sos y tu trabajo",
    help: "Las fotos son opcionales. Podés agregarlas después.",
  },
  {
    id: "redes",
    label: "Redes",
    icon: "share",
    feature: "social",
    question: "¿Dónde pueden ver más de tu trabajo?",
    help: "Completá sólo las redes que usás.",
  },
  {
    id: "pago",
    label: "Pago",
    icon: "credit_card",
    feature: "paid",
    question: "Revisá tu plan",
    help: "Este paso es provisional: todavía no se realiza un cobro.",
  },
] as const;

export type ProfileStep = (typeof PROFILE_STEPS)[number]["id"];
export const BASIC_STEPS: ProfileStep[] = [
  "rubro",
  "servicios",
  "identidad",
  "zonas",
  "contacto",
];

export function WizardNavigation({
  steps,
  current,
  completion,
  visited,
  omitted,
  accessible,
  onSelect,
  summary,
  onSummary,
}: {
  steps: ReadonlyArray<(typeof PROFILE_STEPS)[number]>;
  current: ProfileStep;
  completion: Record<ProfileStep, boolean>;
  visited: Set<ProfileStep>;
  omitted: Set<ProfileStep>;
  accessible: (id: ProfileStep) => boolean;
  onSelect: (id: ProfileStep) => void;
  summary: boolean;
  onSummary: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const index = BASIC_STEPS.indexOf(current);
  return (
    <nav
      aria-label="Pasos para crear tu perfil"
      className="min-w-0 rounded-card border border-line bg-white px-3 py-2 lg:sticky lg:top-24 lg:self-start lg:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {summary
            ? "Revisá tu perfil"
            : index >= 0
              ? `Paso ${index + 1} de 5 · Datos básicos`
              : current === "pago"
                ? "Último requisito"
                : "Opcional"}
        </p>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex h-[38px] items-center gap-1 rounded-input px-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 lg:hidden"
        >
          {expanded ? "Ocultar pasos" : "Ver pasos"}
          <Icon
            name={expanded ? "expand_less" : "expand_more"}
            className="text-xl"
          />
        </button>
      </div>
      <div className="mb-1 mt-2 flex gap-1 lg:my-3" aria-hidden="true">
        {BASIC_STEPS.map((id) => (
          <span
            key={id}
            className={`h-1.5 flex-1 rounded-full ${completion[id] ? "bg-brand-800" : "bg-surface-sunken"}`}
          />
        ))}
      </div>
      <ol className={`${expanded ? "flex" : "hidden"} flex-col gap-1 lg:flex`}>
        {steps.map((item, i) => {
          const active = !summary && current === item.id;
          const status = active
            ? "En curso"
            : completion[item.id]
              ? "Completado"
              : omitted.has(item.id)
                ? "Omitido"
                : visited.has(item.id)
                  ? "Para revisar"
                  : "Pendiente";
          return (
            <Fragment key={item.id}>
              {i === 5 && (
                <>
                  <li>
                    <button
                      type="button"
                      disabled={!BASIC_STEPS.every((id) => completion[id])}
                      aria-current={summary ? "step" : undefined}
                      onClick={() => {
                        onSummary();
                        setExpanded(false);
                      }}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-input px-3 py-2 text-left disabled:opacity-50 ${summary ? "bg-brand-100 text-brand-800" : "text-ink hover:bg-surface-muted"}`}
                    >
                      <Icon name="fact_check" className="text-xl" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          Revisar y terminar
                        </span>
                        <span className="block text-xs text-ink-soft">
                          {summary
                            ? "En curso"
                            : BASIC_STEPS.every((id) => completion[id])
                              ? "Disponible"
                              : "Pendiente"}
                        </span>
                      </span>
                    </button>
                  </li>
                  <li aria-hidden="true">
                    <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-ink-soft">
                      Para completar tu perfil
                    </p>
                  </li>
                </>
              )}
              <li>
                <button
                  type="button"
                  disabled={!accessible(item.id)}
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    onSelect(item.id);
                    setExpanded(false);
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-input px-3 py-2 text-left disabled:opacity-50 ${active ? "bg-brand-100 text-brand-800" : "text-ink hover:bg-surface-muted"}`}
                >
                  <Icon
                    name={completion[item.id] ? "check_circle" : item.icon}
                    filled={completion[item.id]}
                    className={`text-xl ${completion[item.id] ? "text-success" : ""}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {item.label}
                    </span>
                    <span className="block text-xs text-ink-soft">
                      {status}
                    </span>
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/** Lista visible con controles nativos; las opciones conservan su contexto. */
export function ChoiceList({
  label,
  options,
  selected,
  onSelect,
  onRemove,
  onLimitReached,
  max,
  name,
  searchable = true,
  showSelected = true,
}: {
  label: string;
  options: SearchOption[];
  selected: SearchOption[];
  onSelect: (option: SearchOption) => void;
  onRemove: (id: string) => void;
  /** Permite explicar el cupo si se intenta marcar una opción adicional. */
  onLimitReached?: () => void;
  max?: number;
  name?: string;
  searchable?: boolean;
  /** Permite rendir las etiquetas antes de otro control del mismo campo. */
  showSelected?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((option) =>
    normalize(`${option.label} ${option.context ?? ""}`).includes(
      normalize(query),
    ),
  );
  const groups = new Map<string, SearchOption[]>();
  for (const option of filtered) {
    const group = option.context ?? label;
    groups.set(group, [...(groups.get(group) ?? []), option]);
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {name &&
        selected.map((option) => (
          <input
            key={option.value}
            type="hidden"
            name={name}
            value={option.value}
          />
        ))}
      {showSelected && (
        <SelectedChoices selected={selected} onRemove={onRemove} />
      )}
      {searchable && (
        <input
          aria-label={`Buscar ${label.toLowerCase()}`}
          placeholder={`Buscar ${label.toLowerCase()}…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-[38px] w-full rounded-input border border-line-strong px-3 text-base outline-none focus:border-brand-800"
        />
      )}
      {filtered.length === 0 && (
        <p className="text-sm text-ink-soft">
          No hay opciones disponibles con ese nombre.
        </p>
      )}
      {[...groups].map(([group, rows]) => (
        <details
          key={group}
          open={query || !searchable ? true : undefined}
          className="rounded-input border border-line"
        >
          <summary className="min-h-12 cursor-pointer px-3 py-3 text-sm font-semibold text-ink">
            {group}
          </summary>
          <div className="border-t border-line-soft">
            {rows.map((option) => {
              const checked = selected.some(
                (item) => item.value === option.value,
              );
              const atLimit =
                !checked && max !== undefined && selected.length >= max;
              return (
                <label
                  key={option.value}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-3 text-sm hover:bg-surface-muted ${atLimit ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={atLimit && !onLimitReached}
                    aria-disabled={atLimit || undefined}
                    onChange={() => {
                      if (atLimit) {
                        onLimitReached?.();
                        return;
                      }
                      if (checked) onRemove(option.value);
                      else onSelect(option);
                    }}
                    className="h-5 w-5 shrink-0 accent-brand-800"
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

/** Etiquetas removibles compartidas por todas las selecciones del asistente. */
export function SelectedChoices({
  selected,
  onRemove,
}: {
  selected: SearchOption[];
  onRemove: (id: string) => void;
}) {
  if (selected.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {selected.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onRemove(option.value)}
          aria-label={`Quitar ${option.label}${option.context ? `, ${option.context}` : ""}`}
          className="flex min-h-11 max-w-full items-center gap-2 rounded-input border border-brand-800/20 bg-brand-100 px-3 py-1.5 text-left text-brand-800"
        >
          <span className="min-w-0 break-words text-sm font-semibold">
            {option.label}
            {option.context ? (
              <span className="block text-xs font-normal">{option.context}</span>
            ) : null}
          </span>
          <Icon name="close" className="shrink-0 text-lg" />
        </button>
      ))}
    </div>
  );
}

export function WizardWelcome({
  resume,
  onStart,
}: {
  resume: boolean;
  onStart: () => void;
}) {
  return (
    <section className="rounded-card border border-line bg-white px-5 py-10 text-center shadow-panel sm:px-10 sm:py-14">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-800">
        <Icon name="storefront" className="text-3xl" />
      </span>
      <h2 className="text-2xl font-bold tracking-tight text-ink">
        {resume ? "Continuá creando tu perfil" : "Creá tu perfil paso a paso"}
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
        Contanos qué hacés, dónde trabajás y cómo pueden contactarte. Primero
        completás los datos básicos; las fotos y otros detalles podés agregarlos
        después.
      </p>

      <Button className="mt-4" type="button" onClick={onStart}>
        {resume ? "Retomar" : "Comenzar"}
        <Icon name="arrow_forward" className="text-lg" />
      </Button>
    </section>
  );
}
