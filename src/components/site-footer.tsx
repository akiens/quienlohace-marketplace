import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui";

const COLUMNS = [
  {
    title: "Explorar",
    items: [
      { label: "Todas las categorías", href: "/buscar" },
      { label: "Destacados", href: "/destacados" },
      { label: "Hogar y mantenimiento", href: "/categorias/hogar-y-mantenimiento" },
      { label: "Salud", href: "/categorias/salud" },
      { label: "Tecnología", href: "/categorias/tecnologia" },
    ],
  },
  {
    title: "Información",
    items: [
      { label: "Cómo funciona", href: "/como-funciona" },
      { label: "Sobre nosotros", href: "/sobre-nosotros" },
      { label: "Preguntas frecuentes", href: "/faq" },
      { label: "Contacto", href: "/contacto" },
    ],
  },
  {
    title: "Profesionales",
    items: [
      { label: "Entrar", href: "/entrar" },
      { label: "Crear mi perfil", href: "/entrar?perfil=1" },
      { label: "Planes (pronto)", href: "/faq" },
    ],
  },
];

const SOCIALS = [
  { icon: "public", label: "Sitio web" },
  { icon: "photo_camera", label: "Instagram" },
  { icon: "chat", label: "WhatsApp" },
];

export function SiteFooter() {
  return (
    <footer className="bg-footer text-white">
      <div className="shell grid grid-cols-2 gap-x-7 gap-y-9 py-9 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] lg:py-12">
        <div className="col-span-2 flex max-w-[320px] flex-col gap-3.5 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/logo-mark.svg"
              alt=""
              width={52}
              height={52}
              className="h-[52px] w-auto flex-none"
            />
            <span className="h-[42px] w-[1.5px] flex-none rounded-full bg-[#DDDEE1]/30" />
            <span className="flex flex-col items-center gap-1.5">
              <Image
                src="/brand/logo-word.svg"
                alt="QuienLoHace"
                width={210}
                height={44}
                className="h-11 w-auto"
              />
              <span className="whitespace-nowrap text-center text-[10.5px] tracking-[.2px] text-footer-text">
                Conectamos clientes y profesionales
              </span>
            </span>
          </div>

          <p className="text-[14px] leading-relaxed text-footer-text">
            Conectamos personas y profesionales. El directorio de servicios de
            Uruguay: buscá, compará y contactá directo, sin intermediarios.
          </p>

          <div className="flex gap-2">
            {SOCIALS.map((social) => (
              <button
                key={social.icon}
                type="button"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-[#3A322D] transition-colors hover:border-[#4A413B] hover:bg-[#2A2320]"
              >
                <Icon name={social.icon} className="text-[19px] text-footer-text" />
              </button>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} className="flex flex-col gap-3">
            <h2 className="text-[12px] font-bold uppercase tracking-[.8px] text-accent">
              {column.title}
            </h2>
            {column.items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-[14px] text-[#D6D0CB] transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ))}

        <div className="flex flex-col gap-3">
          <h2 className="text-[12px] font-bold uppercase tracking-[.8px] text-accent">
            Contacto
          </h2>
          <a
            href="mailto:hola@quienlohace.uy"
            className="text-[14px] text-[#D6D0CB] transition-colors hover:text-white"
          >
            hola@quienlohace.uy
          </a>
          <a
            href="tel:+59826000000"
            className="text-[14px] text-[#D6D0CB] transition-colors hover:text-white"
          >
            +598 2600 0000
          </a>
          <Link
            href="/contacto"
            className="text-[14px] text-[#D6D0CB] transition-colors hover:text-white"
          >
            WhatsApp
          </Link>
        </div>
      </div>

      <div className="border-t border-footer-line">
        <div className="shell flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 py-4">
          <p className="text-[13px] text-[#8E8681]">
            © {new Date().getFullYear()} QuienLoHace · Hecho en Uruguay
          </p>
          <div className="flex gap-5">
            <Link
              href="/faq"
              className="text-[13px] text-footer-text transition-colors hover:text-white"
            >
              Privacidad
            </Link>
            <Link
              href="/faq"
              className="text-[13px] text-footer-text transition-colors hover:text-white"
            >
              Términos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
