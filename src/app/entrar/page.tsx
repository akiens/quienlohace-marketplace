import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth-layout";
import { LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Accedé a tu cuenta de profesional en QuienLoHace.",
  // El acceso a cuentas no aporta nada en buscadores (RF-073).
  robots: { index: false, follow: true },
};

/**
 * El panel lateral adelanta los precios de los planes, que salen de la base y
 * pueden cambiar sin desplegar (RF-096). Sin esto la página se congelaría con
 * los precios del build.
 */
export const revalidate = 3600;

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginPanel mode="login" />
    </AuthLayout>
  );
}
