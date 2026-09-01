import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ButtonLink, Icon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description:
    "Cómo buscar un profesional en QuienLoHace y cómo publicar tu perfil si ofrecés un servicio.",
};

const CLIENT_STEPS = [
  {
    icon: "search",
    title: "Buscá por rubro y zona",
    body: "Escribí qué necesitás o navegá las 20 categorías. Podés filtrar por departamento, localidad y barrio.",
  },
  {
    icon: "compare_arrows",
    title: "Compará perfiles",
    body: "Cada perfil muestra servicios, opiniones, zonas donde trabaja, horarios y formas de pago.",
  },
  {
    icon: "chat",
    title: "Contactá sin intermediarios",
    body: "Escribís por WhatsApp o llamás directo. QuienLoHace no cobra comisión por el trabajo.",
  },
];

const PRO_STEPS = [
  {
    icon: "person_add",
    title: "Creá tu cuenta",
    body: "Con Google o con tu email. No hace falta tarjeta ni datos de facturación.",
  },
  {
    icon: "tune",
    title: "Configurá tu perfil",
    body: "Elegí hasta cinco subcategorías, cargá tus servicios y marcá las zonas donde trabajás.",
  },
  {
    icon: "trending_up",
    title: "Recibí contactos",
    body: "Tu perfil aparece en búsquedas y páginas de categoría. Los contactos te llegan directo.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="shell flex flex-col gap-10 py-8">
      <Breadcrumbs
        items={[{ label: "Inicio", href: "/" }, { label: "Cómo funciona" }]}
      />

      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[32px]">
          Cómo funciona QuienLoHace
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Conectamos a quien necesita un servicio con quien lo hace. Sin
          intermediarios, sin comisiones y sin obligar a nadie a crear una cuenta
          para contactar.
        </p>
      </header>

      <StepSection
        title="Si buscás un servicio"
        subtitle="Gratis y sin registro."
        steps={CLIENT_STEPS}
      />

      <StepSection
        title="Si ofrecés un servicio"
        subtitle="El perfil básico es gratuito."
        steps={PRO_STEPS}
        action={
          <ButtonLink href="/registro" variant="accent">
            Publicar mi perfil
            <Icon name="arrow_forward" className="text-[18px]" />
          </ButtonLink>
        }
      />
    </div>
  );
}

function StepSection({
  title,
  subtitle,
  steps,
  action,
}: {
  title: string;
  subtitle: string;
  steps: { icon: string; title: string; body: string }[];
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-card border border-line bg-white p-6 lg:p-9">
      <div className="flex flex-col gap-1">
        <h2 className="text-[21px] font-bold tracking-[-.3px] text-ink">
          {title}
        </h2>
        <p className="text-[14.5px] text-ink-soft">{subtitle}</p>
      </div>

      <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-900">
              <Icon name={step.icon} className="text-[22px] text-accent" />
            </span>
            <h3 className="text-[16px] font-bold text-ink">
              {index + 1}. {step.title}
            </h3>
            <p className="text-[14px] leading-relaxed text-ink-soft">{step.body}</p>
          </li>
        ))}
      </ol>

      {action ? <div className="flex">{action}</div> : null}
    </section>
  );
}
