import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ContactForm } from "@/components/contact-form";
import { Icon } from "@/components/ui";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escribinos: consultas, soporte, publicidad o reportes.",
};

const CHANNELS = [
  { icon: "mail", label: "Correo", value: "hola@quienlohace.uy", href: "mailto:hola@quienlohace.uy" },
  { icon: "call", label: "Teléfono", value: "+598 2600 0000", href: "tel:+59826000000" },
  { icon: "chat", label: "WhatsApp", value: "+598 99 000 000", href: "https://wa.me/59899000000" },
];

export default function ContactPage() {
  return (
    <div className="shell flex flex-col gap-7 py-8">
      <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Contacto" }]} />

      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-[26px] font-bold tracking-[-.5px] text-ink sm:text-[30px]">
          Contacto
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          ¿Tenés una consulta, querés anunciar con nosotros o encontraste algo
          que no funciona? Escribinos y te respondemos.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <ContactForm />

        <aside className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
          <h2 className="text-[16px] font-bold text-ink">Otras vías</h2>
          {CHANNELS.map((channel) => (
            <a
              key={channel.label}
              href={channel.href}
              className="flex items-start gap-3 rounded-input p-2 transition-colors hover:bg-surface-muted"
            >
              <Icon name={channel.icon} className="mt-0.5 text-[20px] text-brand-800" />
              <span className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-[.5px] text-ink-faint">
                  {channel.label}
                </span>
                <span className="text-[14.5px] text-ink-muted">{channel.value}</span>
              </span>
            </a>
          ))}

          <p className="border-t border-line-soft pt-4 text-[13.5px] leading-relaxed text-ink-soft">
            Para consultas sobre un servicio puntual, contactá directo al
            profesional desde su perfil: es la vía más rápida.
          </p>
        </aside>
      </div>
    </div>
  );
}
