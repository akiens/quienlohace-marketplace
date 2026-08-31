import { ButtonLink, Icon } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="shell flex flex-col items-center gap-5 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
        <Icon name="search_off" className="text-[28px] text-brand-800" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink">
          No encontramos esta página
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
          Puede que el enlace esté desactualizado o que el perfil ya no esté
          publicado. Probá buscando el servicio que necesitás.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <ButtonLink href="/buscar">Buscar profesionales</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          Ir al inicio
        </ButtonLink>
      </div>
    </div>
  );
}
