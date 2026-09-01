import Link from "next/link";

import { Icon } from "@/components/ui";

/**
 * Marco compartido por `/entrar` y `/registro`.
 *
 * Las dos rutas muestran el mismo panel lateral; sólo cambia el formulario.
 * Tenerlo acá evita que las páginas se desincronicen cuando se edite el
 * copy de una sola.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell grid grid-cols-1 gap-8 py-12 lg:grid-cols-2 lg:gap-14 lg:py-16">
      {children}

      <aside className="order-first flex flex-col gap-5 lg:order-last">
        <div className="flex flex-col gap-3 rounded-card border border-line bg-white p-6">
          <h2 className="text-[18px] font-bold text-ink">
            Buscar no requiere cuenta
          </h2>
          <p className="text-[14.5px] leading-relaxed text-ink-soft">
            Podés buscar, comparar y contactar profesionales sin registrarte. La
            cuenta es sólo para quienes ofrecen un servicio, o para dejar una
            opinión.
          </p>
          <Link
            href="/buscar"
            className="flex items-center gap-1.5 text-[14px] font-semibold text-brand-800 hover:underline"
          >
            Ir al buscador
            <Icon name="arrow_forward" className="text-[17px]" />
          </Link>
        </div>

        <div className="flex flex-col gap-3 rounded-card bg-brand-gradient p-6">
          <h2 className="text-[18px] font-bold text-white">
            Con tu perfil profesional podés
          </h2>
          <ul className="flex flex-col gap-2.5">
            {[
              "Aparecer en búsquedas por rubro y zona",
              "Recibir contactos directos por WhatsApp",
              "Mostrar servicios, horarios y formas de pago",
              "Sumar opiniones de tus clientes",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-[14.5px] leading-relaxed text-[#C3CEE2]"
              >
                <Icon name="check_circle" filled className="mt-0.5 text-[18px] text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
