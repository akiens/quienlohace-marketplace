import { ButtonLink, Icon, PROVIDER_GRID } from "@/components/ui";
import { ProviderCard } from "@/components/provider-card";
import type { Provider } from "@/types";

/**
 * Página de "no encontramos esto", reutilizable.
 *
 * Un 404 seco deja a la persona sin nada que hacer. Cuando se puede, se
 * ofrecen perfiles publicados con nombre parecido: en general el enlace está
 * viejo o el nombre venía mal escrito, y lo buscado está a un clic.
 *
 * También cubre el caso de un perfil que existe pero no es público. Ahí la
 * respuesta es deliberadamente la misma que ante un nombre inventado: decir
 * "existe pero está despublicado" filtraría información que su dueño no
 * eligió mostrar.
 */
export function NotFoundPage({
  title,
  message,
  suggestions = [],
  suggestionsTitle = "Quizás buscabas a alguno de estos",
}: {
  title: string;
  message: string;
  suggestions?: Provider[];
  suggestionsTitle?: string;
}) {
  return (
    <div className="shell flex flex-col gap-10 py-16">
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
          <Icon name="search_off" className="text-[28px] text-brand-800" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink">
            {title}
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-ink-soft">
            {message}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <ButtonLink href="/buscar">Buscar profesionales</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Ir al inicio
          </ButtonLink>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-[19px] font-bold tracking-[-.3px] text-ink">
            {suggestionsTitle}
          </h2>
          <div className={PROVIDER_GRID}>
            {suggestions.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
