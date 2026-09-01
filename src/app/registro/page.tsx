import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth-layout";
import { LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = {
  title: "Publicá tu perfil",
  description:
    "Creá tu cuenta de profesional o empresa en QuienLoHace. El perfil básico es gratis.",
  // Los formularios de cuenta no se indexan, igual que `/entrar` (RF-073).
  robots: { index: false, follow: true },
};

/**
 * El panel lateral adelanta los precios de los planes, que salen de la base y
 * pueden cambiar sin desplegar (RF-096). Sin esto la página se congelaría con
 * los precios del build.
 */
export const revalidate = 3600;

export default function SignupPage() {
  return (
    <AuthLayout>
      <LoginPanel mode="signup" />
    </AuthLayout>
  );
}
