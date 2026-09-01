import type { Metadata } from "next";

import { AuthLayout } from "@/components/auth-layout";
import { LoginPanel } from "@/components/login-panel";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Accedé a tu cuenta de profesional en QuienLoHace.",
  // El acceso a cuentas no aporta nada en buscadores (RF-073).
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginPanel mode="login" />
    </AuthLayout>
  );
}
