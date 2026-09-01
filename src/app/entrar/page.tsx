import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthLayout } from "@/components/auth-layout";
import { getCurrentUser } from "@/lib/session";
import { LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Accedé a tu cuenta de profesional en QuienLoHace.",
  // El acceso a cuentas no aporta nada en buscadores (RF-073).
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

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");

  return (
    <AuthLayout>
      <LoginPanel mode="login" />
    </AuthLayout>
  );
}
