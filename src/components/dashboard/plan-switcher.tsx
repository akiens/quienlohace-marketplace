"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";

import { changePlan } from "@/app/actions/plan";
import type { FormState } from "@/app/actions/auth";
import { Icon } from "@/components/ui";
import {
  PLAN_BADGES,
  PLAN_RIBBONS,
  PLAN_TIERS,
  formatPrice,
} from "@/domain/plans";
import type { PlanLimits } from "@/types";

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
   * El diálogo se cierra al elegir un plan, en el mismo gesto que lo envía.
   *
   * Antes se derivaba de `state.message`, y como ese mensaje queda puesto
   * después de un cambio, el diálogo no volvía a abrirse nunca: el botón
   * marcaba "abrir" y el mensaje viejo lo cerraba en el mismo render.
   */



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
      <div
        style={{ backgroundImage: PLAN_RIBBONS[plan.id].face }}
        className="relative flex h-9 items-center gap-x-5 rounded-card py-[3px] pr-[3px]"
      >
        <span className="flex items-center gap-3">
          {/*
           * La franja mide 36px y la insignia 64px: se sale por arriba y por
           * abajo, así se lee como algo apoyado encima. Va corrida a la
           * derecha, y el texto detrás de ella para que no quede tapado.
           */}
          <Image
            src={PLAN_BADGES[plan.id]}
            alt=""
            width={96}
            height={96}
            className="pointer-events-none -my-3 ml-[15px] h-16 w-16 shrink-0 object-contain drop-shadow-[0_3px_8px_rgba(16,24,40,.35)]"
          />
          <span className="text-[15px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            Plan {plan.name}
          </span>
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
            {PLAN_TIERS[plan.id]}
          </span>
          <span className="text-[13px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,.5)]">
            {formatPrice(plan)}
          </span>
        </span>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto flex h-[30px] items-center gap-1.5 rounded-input bg-white/95 px-3 text-[13px] font-semibold text-ink transition-colors hover:bg-white"
        >
          <Icon name="swap_horiz" className="text-[16px]" />
          Cambiar mi plan
        </button>
      </div>

      {state.errors?.form ? (
        <p role="alert" className="text-[13.5px] font-medium text-[#B42318]">
          {state.errors.form}
        </p>
      ) : null}

      {open ? (
        <PlanDialog
          plans={plans}
          current={plan}
          persist={persist}
          pending={pending}
          action={action}
          onChoose={(planId) => {
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
      aria-label="Cambiar de plan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      // Cerrar tocando fuera: el clic dentro del panel no burbujea hasta acá.
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-card bg-white p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-bold text-ink">Cambiar de plan</h2>
            <p className="text-[14px] text-ink-soft">
              Si bajás de plan no perdés nada: lo que no entre queda guardado y
              vuelve si recontratás.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-input p-1.5 text-ink-soft hover:bg-surface-muted"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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
  const card = {
    style: { borderColor: PLAN_RIBBONS[option.id].edge },
    className: `relative flex flex-col gap-3 rounded-card border-2 bg-white p-4 pt-8 ${
      current ? "" : "border-opacity-40"
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

      <Image
        src={PLAN_BADGES[option.id]}
        alt=""
        width={80}
        height={80}
        className="pointer-events-none absolute -right-2 -top-4 h-14 w-14 object-contain drop-shadow-[0_3px_8px_rgba(16,24,40,.22)]"
      />

      <div className="flex flex-col gap-0.5 pr-12">
        <span className="text-[16px] font-bold text-ink">{option.name}</span>
        <span className="text-[19px] font-bold tracking-[-.4px] text-ink">
          {formatPrice(option)}
        </span>
      </div>

      <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-ink-muted">
        <li>{option.maxServices} servicios</li>
        <li>{option.maxSubcategories} subcategorías</li>
        <li>{option.maxServiceAreas} zonas</li>
        <li>
          {option.maxGalleryImages > 0
            ? `${option.maxGalleryImages} imágenes`
            : "Sin galería"}
        </li>
        <li>
          {option.maxTeamMembers > 0
            ? `${option.maxTeamMembers} integrantes`
            : "Sin equipo"}
        </li>
      </ul>

      {current ? (
        <span className="mt-auto flex h-10 items-center justify-center gap-1.5 rounded-input bg-surface-muted text-[13.5px] font-semibold text-ink-soft">
          <Icon name="check_circle" filled className="text-[17px]" />
          Tu plan actual
        </span>
      ) : (
        <button
          type={persist ? "submit" : "button"}
          disabled={persist && pending}
          onClick={persist ? undefined : () => onChoose?.(option.id)}
          className="mt-auto flex h-10 items-center justify-center rounded-input bg-brand-800 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-900 disabled:opacity-60"
        >
          {persist && pending ? "Un momento…" : `Cambiar a ${option.name}`}
        </button>
      )}
    </Card>
  );
}
