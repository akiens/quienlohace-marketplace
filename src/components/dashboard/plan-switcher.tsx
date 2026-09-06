"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { changePlan } from "@/app/actions/plan";
import type { FormState } from "@/app/actions/auth";
import { Icon } from "@/components/ui";
import {
  PLAN_BADGES,
  PLAN_RIBBONS,
  PLAN_TIERS,
  formatPrice,
  isUpgrade,
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

      {state.errors?.form ? (
        <p role="alert" className="px-4 text-[13.5px] font-medium text-[#B42318] sm:px-0">
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

/** Un tope del plan en palabras. `null` es "sin límite" (TR-002). */
function cap(limit: number | null, plural: string): string {
  return limit === null ? `${plural} sin límite` : `${limit} ${plural}`;
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
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-card bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-h-[85vh] sm:rounded-card sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-bold text-ink sm:text-[20px]">
              Cambiar de plan
            </h2>
            {/*
              Bajar de plan no significa lo mismo en los dos caminos, y decir
              lo mismo en ambos es mentirle a uno de los dos.

              Con perfil creado la baja se agenda: el período pago corre hasta
              su vencimiento y recién ahí lo que excede se esconde, sin
              borrarse (BR-009). Creando el perfil por primera vez no hay
              período pago ni perfil que conservar, y lo que no entra se quita
              — el aviso previo lo confirma antes de que pase.
            */}
            <p className="text-[13.5px] text-ink-soft sm:text-[14px]">
              {persist
                ? "Si bajás de plan no perdés nada: seguís con el plan actual hasta que venza, y después lo que no entre deja de mostrarse."
                : "Si bajás de plan, lo que no entre en el nuevo se quita. Te avisamos antes de hacerlo."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex h-10 w-10 flex-none items-center justify-center rounded-input text-ink-soft hover:bg-surface-muted sm:mr-0 sm:h-auto sm:w-auto sm:p-1.5"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
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

      {/*
        Un tope en `null` es "sin límite" y no un número (TR-002): se dice con
        palabras, porque mostrarlo vacío o como 0 diría lo contrario.
      */}
      <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-ink-muted">
        <li>{cap(option.maxServiceSectors, "rubros")}</li>
        <li>{cap(option.maxSpecialties, "especialidades")}</li>
        <li>{cap(option.maxServices, "servicios")}</li>
        <li>{cap(option.maxLocations, "ubicaciones")}</li>
        <li>
          {option.maxGalleryImages === 0
            ? "Sin galería"
            : cap(option.maxGalleryImages, "imágenes")}
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
