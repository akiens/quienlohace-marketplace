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

export default function SignupPage() {
  return (
    <AuthLayout>
      <LoginPanel mode="signup" />
    </AuthLayout>
  );
}
