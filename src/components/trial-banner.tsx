import { ButtonLink, Icon } from "@/components/ui";

/**
 * El relleno del espacio publicitario mientras no haya un anuncio que poner.
 *
 * Un hueco rotulado "Espacio publicitario" no le sirve a nadie: no deja plata
 * y le dice a quien entra que el sitio está a medio hacer. Ese lugar lo ocupa
 * entonces la oferta de prueba, que es lo que el sitio quiere pedirle a un
 * proveedor que todavía no publicó.
 *
 * No va rotulado como publicidad —no lo es— ni imita el formato de un anuncio:
 * es una promoción propia y se ve como parte del sitio.
 */
export function TrialBanner() {
  return (
    <section className="overflow-hidden rounded-card border border-[#E4D9A8] bg-[linear-gradient(115deg,#FFFBEC_0%,#FFF6DC_55%,#FDEFC6_100%)]">
      <div className="relative flex flex-col items-start gap-4 p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:p-8">
        {/*
          El icono grande de fondo, recortado por el borde de la tarjeta. Es
          decoración —`Icon` ya lo marca `aria-hidden`—, y `pointer-events-none`
          evita que le robe el clic al botón que tiene encima.
        */}
        <Icon
          name="rocket_launch"
          className="pointer-events-none absolute -right-3 -top-6 select-none text-[150px] leading-none text-[#E8B93B]/[.16] lg:right-6 lg:text-[172px]"
        />

        <div className="relative flex flex-col gap-2.5">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[.6px] text-ink">
            <Icon name="card_giftcard" className="text-[15px]" />
            Beneficio de lanzamiento
          </span>

          <h2 className="max-w-xl text-[21px] font-extrabold leading-tight tracking-[-.4px] text-ink lg:text-[25px]">
            Creá tu perfil y activá 3 meses gratis de cualquier plan pago
          </h2>

          <p className="max-w-xl text-[14.5px] leading-relaxed text-ink-soft">
            Publicá tu primer perfil y elegí el plan que quieras: lo usás tres
            meses sin pagar nada, con todo lo que incluye. Sin tarjeta y sin
            permanencia.
          </p>
        </div>

        <ButtonLink href="/registro" variant="accent" className="relative shrink-0">
          Activar beneficio
          <Icon name="arrow_forward" className="text-[18px]" />
        </ButtonLink>
      </div>
    </section>
  );
}
