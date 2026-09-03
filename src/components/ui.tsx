import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Primitivas visuales compartidas. Sin estado: se pueden renderizar en el servidor. */

type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
};

/**
 * Icono de Material Symbols. Es decorativo por defecto: el texto que lo
 * acompaña es el que comunica: si un icono va solo, quien lo usa debe poner
 * un `aria-label` en el control que lo contiene.
 */
export function Icon({ name, className = "", filled = false }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`icon ${filled ? "icon-filled" : ""} ${className}`}
    >
      {name}
    </span>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((step) => (
        <Icon
          key={step}
          name={rating >= step ? "star" : rating >= step - 0.5 ? "star_half" : "star"}
          filled={rating >= step - 0.5}
          className={`text-[16px] ${
            rating >= step - 0.5 ? "text-accent" : "text-line-strong"
          }`}
        />
      ))}
    </span>
  );
}

/** Calificación + cantidad de opiniones, con el caso "sin opiniones" resuelto. */
export function RatingLine({
  rating,
  reviewCount,
  className = "",
}: {
  rating: number | null;
  reviewCount: number;
  className?: string;
}) {
  if (rating === null || reviewCount === 0) {
    return (
      <span className={`text-[13.5px] text-ink-soft ${className}`}>
        Sin opiniones aún
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-2 text-[13.5px] ${className}`}>
      <span className="flex items-center gap-1 font-semibold text-ink">
        <Icon name="star" filled className="text-[16px] text-accent" />
        {rating.toFixed(1)}
      </span>
      <span className="text-ink-soft">
        · {reviewCount} {reviewCount === 1 ? "opinión" : "opiniones"}
      </span>
    </span>
  );
}

export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold tracking-[.2px] text-ink">
      <Icon name="star" filled className="text-[14px]" />
      Destacado
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#D6EFE0] bg-white px-2.5 py-1 text-[11px] font-bold text-[#1E8C56]">
      <Icon name="verified" filled className="text-[14px] text-whatsapp" />
      Verificado
    </span>
  );
}

/**
 * Grilla de cards de proveedor, en un solo lugar para que todas las páginas
 * usen el mismo ritmo: 1 columna en teléfono, 2 en tablet, 3 en portátiles y
 * 4 en pantallas anchas.
 */
export const PROVIDER_GRID =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#ECEEF2] bg-surface-sunken px-2.5 py-1 text-[12.5px] text-ink-muted ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-bold tracking-[-.3px] text-ink sm:text-[25px]">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[14.5px] text-ink-soft">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

type ButtonBase = {
  variant?: "primary" | "secondary" | "accent" | "ghost";
  size?: "md" | "sm";
};

/*
 * El secundario no es blanco.
 *
 * Los campos de texto son borde `line-strong` sobre blanco, con la misma
 * altura y el mismo radio: un botón blanco al lado de un input era el mismo
 * rectángulo, y en un formulario —donde lo que abunda es justamente casillas
 * para llenar— se leía como una más, vacía. Nada decía "esto se toca".
 *
 * La distinción es de superficie, no de borde: el botón se apoya sobre un
 * relleno de marca (`brand-100`) con el texto en `brand-800`. Ese tinte no
 * aparece nunca en un campo editable, así que la diferencia se nota sin
 * mirar el contenido; el gris queda para lo que se escribe y el azul para lo
 * que se acciona. La sombra mínima lo despega del fondo —los inputs no la
 * tienen, van hundidos— y al apoyarse se apaga, que es el gesto de hundirse.
 *
 * Sigue siendo secundario: el peso fuerte es del primario, que es sólido y
 * de mucho más contraste. Acá el color es apenas un tinte.
 */
/**
 * La superficie del secundario, aparte para que la usen también los botones
 * que no pasan por `Button` —los que tienen otra altura o otro tipo de
 * texto—. Sin esto cada uno repetiría los colores y se irían separando.
 *
 * Es sólo el fondo, el borde y el texto: quien la use pone su propio tamaño.
 */
export const SECONDARY_SURFACE =
  "border border-[#DAE0EC] bg-brand-100 text-brand-800 shadow-[0_1px_0_rgba(23,32,51,.04)] transition-colors hover:border-[#C6CEDC] hover:bg-[#E4E9F2] active:shadow-none";

const BUTTON_STYLES: Record<NonNullable<ButtonBase["variant"]>, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-900",
  secondary: SECONDARY_SURFACE,
  accent: "bg-accent text-ink hover:bg-accent-hover font-bold",
  ghost: "text-brand-800 hover:bg-brand-100",
};

const SIZE_STYLES: Record<NonNullable<ButtonBase["size"]>, string> = {
  md: "h-11 px-5 text-[15px]",
  sm: "h-9 px-4 text-[13.5px]",
};

function buttonClass({ variant = "primary", size = "md" }: ButtonBase): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-input font-semibold",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    BUTTON_STYLES[variant],
    SIZE_STYLES[size],
  ].join(" ");
}

export function Button({
  variant,
  size,
  className = "",
  ...props
}: ButtonBase & ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${buttonClass({ variant, size })} ${className}`}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className = "",
  ...props
}: ButtonBase & ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`${buttonClass({ variant, size })} ${className}`} />
  );
}

export function EmptyState({
  icon = "search_off",
  title,
  children,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-white px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken">
        <Icon name={icon} className="text-[24px] text-ink-faint" />
      </span>
      <p className="text-[17px] font-bold text-ink">{title}</p>
      <div className="max-w-md text-[14.5px] leading-relaxed text-ink-soft">
        {children}
      </div>
    </div>
  );
}

/** Bloque publicitario nativo: siempre rotulado, nunca disfrazado de resultado. */
export function AdSlot({ label = "Espacio publicitario" }: { label?: string }) {
  return (
    <aside className="flex flex-col gap-2 rounded-card border border-line bg-white p-5">
      <span className="text-[10.5px] font-bold uppercase tracking-[.7px] text-ink-faint">
        Publicidad
      </span>
      <div className="flex min-h-[92px] items-center justify-center rounded-input bg-surface-sunken text-[13.5px] text-ink-faint">
        {label}
      </div>
    </aside>
  );
}
