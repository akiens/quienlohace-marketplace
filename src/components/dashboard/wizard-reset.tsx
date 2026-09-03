"use client";

import { useEffect } from "react";

import { claimSelectedPlan } from "@/lib/selected-plan";

/**
 * Descarta lo que dejó en el navegador quien usó el alta antes.
 *
 * `localStorage` es del navegador, no de la sesión. En una máquina compartida
 * —o con una segunda cuenta propia— el alta se abría con el borrador y el
 * plan de la persona anterior ya cargados: datos de otro perfil apareciendo
 * como propios.
 *
 * El borrador se defiende solo: lleva anotada la cuenta que lo escribió y no
 * se lee desde ninguna otra. El plan no puede, porque se elige en `/planes`
 * antes de que la cuenta exista; acá se le pone dueño al entrar al alta, y si
 * ya era de otra cuenta se descarta.
 *
 * Corre una sola vez por cuenta y no en cada render: cambiar de plan dentro
 * del alta es una elección deliberada, y volver a limpiarla la desharía.
 */
export function WizardReset({ userId }: { userId: string }) {
  useEffect(() => {
    claimSelectedPlan(userId);
  }, [userId]);

  return null;
}
