import { PlanTeaser } from "@/components/plan-teaser";
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

          <PlanTeaser />
        </div>
      </aside>
    </div>
  );
}
