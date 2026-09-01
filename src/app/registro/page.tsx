import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/auth-layout";
import { getCurrentUser } from "@/lib/session";
import { PLAN_IDS } from "@/domain/plans";
import type { PlanId } from "@/types";
import { LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = {
  title: "Publicá tu perfil",
  description:
    "Creá tu cuenta de profesional o empresa en QuienLoHace. El perfil básico es gratis.",
  // Los formularios de cuenta no se indexan, igual que `/entrar` (RF-073).
  robots: { index: false, follow: true },
};

/**
 * Quien ya inició sesión no tiene nada que hacer acá: se lo manda al panel,
 * que es donde crea o edita su perfil.
 *
 * `force-dynamic` porque la decisión depende de la sesión; sin esto la
 * página se serviría desde el cache estático y el redirect no correría.
 */
export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");

  // Cobre por defecto: es el plan gratuito y el que menos compromete.
  const requested = (await searchParams).plan;
  const selectedPlan: PlanId = PLAN_IDS.includes(requested as PlanId)
    ? (requested as PlanId)
    : "cobre";

  return (
    <AuthLayout selectable selectedPlan={selectedPlan}>
      <LoginPanel mode="signup" planId={selectedPlan} />
    </AuthLayout>
  );
}
