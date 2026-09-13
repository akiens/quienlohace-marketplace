"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { changePlan } from "@/app/actions/plan";
import type { FormState } from "@/app/actions/auth";
import { PlanRibbonName } from "@/components/plan-ribbon-name";
import { Icon } from "@/components/ui";
import { FormAlert } from "@/components/form-alert";
import {
  PLAN_BADGES,
  PLAN_RIBBONS,
  PLAN_TIERS,
  formatPrice,
  isUpgrade,
} from "@/domain/plans";
import type { PlanId, PlanLimits } from "@/types";

/** Una sola idea por plan; la comparación detallada sigue viviendo en `/planes`. */
const PLAN_OPTION_SUMMARIES: Record<PlanId, string> = {
  cobre: "Lo esencial para publicar tu perfil y empezar a recibir contactos.",
  gold: "Más servicios, cartas, galería y redes sociales para hacer crecer tu perfil.",
  platinum:
    "La propuesta completa, con máxima capacidad y todas las herramientas disponibles.",
};

/**
 * Bloque del plan contratado, con el mismo lenguaje visual que `/planes`:
 * el degradado del metal, la insignia y la etiqueta de nivel.
 *
 * El cambio de plan abre un diálogo en la misma página. Navegar a `/planes`
 * y volver haría perder lo que se estuviera escribiendo en el formulario.
 */
export function PlanSwitcher({
  plan,
  plans,
  persist,
  onPlanChange,
}: {
  plan: PlanLimits;
  plans: PlanLimits[];
  /**
   * Si el plan hay que guardarlo en el servidor. Sin perfil no hay fila que
   * actualizar: el cambio vive en el navegador y se manda al crear el perfil,
   * así que el diálogo no envía nada y la página no se vuelve a pedir.
   */
  persist: boolean;
  /**
   * Se llama al confirmar el cambio. Sin perfil todavía no hay nada que
   * recargar desde el servidor, así que el panel avisa acá y el formulario
   * se reordena sin salir de la página.
   */
  onPlanChange?: (planId: PlanLimits["id"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    changePlan,
    {},
  );

  /*
   * Al subir de plan se sigue en el asistente: el plan nuevo habilita pasos
   * que hay que completar y el pago que hay que resolver. Bajar no navega —
   * se agenda y se responde en la misma pantalla, que es donde se lee el
   * aviso.
   */
  const router = useRouter();
  const [upgraded, setUpgraded] = useState(false);

  useEffect(() => {
    // Se espera la confirmación del servidor: navegar antes dejaría el
    // asistente mostrando el plan viejo.
    if (upgraded && state.message && !state.errors) {
      router.push("/dashboard/crear");
    }
  }, [upgraded, state.message, state.errors, router]);

  // Escape cierra, como cualquier diálogo.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/*
       * La franja es la misma en el teléfono que en escritorio: 36px de alto,
       * la insignia de 64px saliéndose por arriba y por abajo, y el nombre, el
       * nivel y el precio en una línea.
       *
       * Lo único propio del teléfono es que va de borde a borde, sin margen
       * lateral ni esquinas redondeadas — y es lo que hace posible el resto:
       * los 12px que tenía a cada lado eran justo los que le faltaban al
       * contenido para entrar en una sola línea, y por eso antes el nombre y
       * el precio se apilaban y la franja medía 52px.
       *
       * El nivel ("Básico", "Premium") se ve sólo desde `sm`: repite lo que ya
       * dice el nombre del plan, y en el ancho que hay es lo primero que sobra.
       */}
      <div
        style={{ backgroundImage: PLAN_RIBBONS[plan.id].face }}
        className="relative flex h-9 items-center gap-x-5 py-[3px] pr-[3px] sm:rounded-card"
      >
        <span className="flex min-w-0 items-center gap-3">
          {/*
           * La insignia se sale de la franja por arriba y por abajo, así se
           * lee como algo apoyado encima. Va corrida a la derecha, y el texto
           * detrás de ella para que no quede tapado.
           */}
          <Image
            src={PLAN_BADGES[plan.id]}
            alt=""
            width={96}
            height={96}
            className="pointer-events-none -my-3.5 ml-[15px] h-16 w-16 shrink-0 object-contain drop-shadow-[0_3px_8px_rgba(16,24,40,.35)]"
          />
          <span className="flex min-w-0 items-center gap-3 leading-tight">
            <span className="truncate text-[15px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
              Plan {plan.name}
            </span>
            <span className="hidden rounded-full bg-black/25 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white sm:inline">
              {PLAN_TIERS[plan.id]}
            </span>
          </span>
        </span>

        {/*
         * El botón lleva su texto también en el teléfono. Antes ahí era sólo
         * el icono porque no entraba: lo que ocupaba ese ancho era el precio,
         * y sin él sobra para la etiqueta completa.
         */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto mr-1 flex h-[30px] flex-none items-center gap-1.5 rounded-input bg-white/95 px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-white sm:mr-0"
        >
          <Icon name="swap_horiz" className="text-[16px]" />
          Cambiar mi plan
        </button>
      </div>

      {/*
        Un cambio de plan rechazado. El éxito no se avisa acá: subir de plan
        navega al asistente y bajar se responde en el diálogo, así que lo
        único que queda por contar en esta pantalla es que no se pudo.
      */}
      <FormAlert
        message={state.errors?.form}
        tone="error"
        resetKey={state}
      />

      {open ? (
        <PlanDialog
          plans={plans}
          current={plan}
          persist={persist}
          pending={pending}
          action={action}
          onChoose={(planId) => {
            const target = plans.find((p) => p.id === planId);
            // Sólo las subidas siguen al asistente; las bajas se resuelven acá.
            if (persist && target && isUpgrade(plan, target)) setUpgraded(true);
            onPlanChange?.(planId);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function PlanDialog({
  plans,
  current,
  persist,
  pending,
  action,
  onChoose,
  onClose,
}: {
  plans: PlanLimits[];
  current: PlanLimits;
  persist: boolean;
  pending: boolean;
  action: (formData: FormData) => void;
  onChoose?: (planId: PlanLimits["id"]) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-dialog-title"
      /*
       * En el teléfono se apoya abajo y ocupa todo el ancho: un recuadro
       * centrado con margen deja las tres tarjetas de plan en una columna
       * angosta y obliga a estirar el pulgar hasta arriba para cerrarlo.
       */
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
      // Cerrar tocando fuera: el clic dentro del panel no burbujea hasta acá.
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[94dvh] w-full max-w-4xl overflow-y-auto rounded-t-[20px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop sm:max-h-[88vh] sm:rounded-[20px] sm:px-6 sm:pb-6"
      >
        <header className="relative -mx-4 overflow-hidden rounded-t-[20px] bg-brand-gradient px-5 pb-10 pt-3 sm:-mx-6 sm:px-7 sm:pb-12 sm:pt-6">
          <div className="pointer-events-none absolute inset-0 bg-hatch" />
          <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full border border-white/10 bg-white/[.04]" />
          <div className="pointer-events-none absolute -right-4 -top-8 h-28 w-28 rounded-full border border-white/10" />

          <span
            aria-hidden="true"
            className="relative mx-auto mb-3 block h-1 w-10 rounded-full bg-white/35 sm:hidden"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-accent">
                Tu perfil, a tu medida
              </p>
              <h2
                id="plan-dialog-title"
                className="text-[22px] font-extrabold tracking-[-.4px] text-white sm:text-[26px]"
              >
                Elegí tu plan
              </h2>
              <p className="max-w-xl text-[13.5px] leading-relaxed text-[#D5DEEC] sm:text-[14px]">
                Podés cambiarlo cuando quieras. Elegí el que mejor acompaña tu
                trabajo hoy.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:mr-0"
            >
              <Icon name="close" className="text-[21px]" />
            </button>
          </div>
        </header>

        <div className="relative -mt-7 grid gap-5 px-3 pt-8 md:grid-cols-3 md:gap-5">
          {plans.map((option) => (
            <PlanOption
              key={option.id}
              option={option}
              current={option.id === current.id}
              persist={persist}
              pending={pending}
              action={action}
              onChoose={onChoose}
            />
          ))}
        </div>

        {/*
          La advertencia cambia según haya o no un perfil persistido. Va al
          final para no competir con la decisión principal ni cargar cada card.
        */}
        <div className="mt-5 flex items-start gap-2.5 rounded-input bg-surface-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft sm:mx-3 sm:text-[13px]">
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-100 text-brand-800">
            <Icon name="info" className="text-[15px]" />
          </span>
          <p className="pt-0.5">
            {persist
              ? "Si bajás de plan, seguís con el actual hasta que venza. Después, lo que exceda el nuevo plan deja de mostrarse, pero no se borra."
              : "Si bajás de plan, lo que no entre en el nuevo se quita. Te avisamos antes de aplicar el cambio."}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanOption({
  option,
  current,
  persist,
  pending,
  action,
  onChoose,
}: {
  option: PlanLimits;
  current: boolean;
  persist: boolean;
  pending: boolean;
  action: (formData: FormData) => void;
  onChoose?: (planId: PlanLimits["id"]) => void;
}) {
  const ribbon = PLAN_RIBBONS[option.id];
  const card = {
    style: {
      backgroundImage: `linear-gradient(180deg,${ribbon.edge}12 0%,#FFFFFF 42%)`,
      ...(current
        ? {
            borderColor: ribbon.edge,
            boxShadow: `0 0 0 2px ${ribbon.edge}24, 0 16px 34px -20px rgba(23,32,51,.42)`,
          }
        : {}),
    },
    className: `relative flex min-h-[238px] flex-col gap-4 rounded-card border bg-white p-5 pt-[72px] shadow-panel transition-[transform,box-shadow,border-color] ${
      current
        ? ""
        : "border-line hover:-translate-y-1 hover:border-[#C6CEDC] hover:shadow-card-hover"
    }`,
  };

  /*
   * Sin perfil el plan sólo se recuerda en el navegador, así que la tarjeta no
   * es un formulario: enviarlo pediría la página entera de vuelta para no
   * guardar nada. Con perfil sí hay que escribir en la base y el envío manda.
   */
  const Card = persist ? "form" : "div";

  return (
    <Card
      {...card}
      {...(persist
        ? {
            action,
            // El aviso sale del envío mismo: el formulario ya sabe qué plan es.
            onSubmit: () => onChoose?.(option.id),
          }
        : {})}
    >
      {persist ? <input type="hidden" name="planId" value={option.id} /> : null}

      <PlanRibbonName plan={option} headingLevel="h3" />

      <Image
        src={PLAN_BADGES[option.id]}
        alt=""
        width={96}
        height={96}
        className={`pointer-events-none absolute -top-5 z-20 h-20 w-20 object-contain drop-shadow-[0_4px_10px_rgba(16,24,40,.22)] ${
          option.id === "cobre" ? "-right-3" : "-right-2"
        }`}
      />

      <div className="flex items-end gap-2 pr-16">
        <span className="text-[24px] font-extrabold tracking-[-.6px] text-ink">
          {formatPrice(option)}
        </span>
      </div>

      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-white shadow-sm"
          style={{ background: ribbon.face }}
        >
          <Icon name="auto_awesome" className="text-[15px]" />
        </span>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          {PLAN_OPTION_SUMMARIES[option.id]}
        </p>
      </div>

      {current ? (
        <span className="mt-auto flex h-10 items-center justify-center gap-1.5 rounded-input border border-success-line bg-success-soft text-[13.5px] font-semibold text-success-ink">
          <Icon name="check_circle" filled className="text-[18px]" />
          Tu plan actual
        </span>
      ) : (
        <button
          type={persist ? "submit" : "button"}
          disabled={persist && pending}
          onClick={persist ? undefined : () => onChoose?.(option.id)}
          className="group mt-auto flex h-10 items-center justify-center gap-1.5 rounded-input bg-brand-800 px-3 text-[13.5px] font-semibold text-white shadow-[0_4px_12px_-6px_rgba(32,55,95,.65)] transition-colors hover:bg-brand-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 disabled:opacity-60"
        >
          {persist && pending ? "Un momento…" : `Cambiar a ${option.name}`}
          {!persist || !pending ? (
            <Icon
              name="arrow_forward"
              className="text-[16px] transition-transform group-hover:translate-x-0.5"
            />
          ) : null}
        </button>
      )}
    </Card>
  );
}
