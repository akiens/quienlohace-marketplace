import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { HeaderWithAuth } from "@/components/header-auth";
import { siteUrl } from "@/lib/site-url";
import { SiteFooter } from "@/components/site-footer";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "QuienLoHace · Profesionales y empresas de servicios en Uruguay",
    template: "%s · QuienLoHace",
  },
  description:
    "Encontrá profesionales y empresas de servicios en todo Uruguay. Buscá por rubro y zona, compará perfiles y contactá directo, sin intermediarios.",
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/brand/favicon-180.png",
  },
  openGraph: {
    type: "website",
    locale: "es_UY",
    siteName: "QuienLoHace",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-UY" className={inter.variable}>
      <head>
        {/* Los iconos se cargan acá porque next/font sólo maneja familias de
            texto, y un @import en el CSS lo elimina el bundler (las reglas
            @import deben ir antes que todo, y Tailwind inyecta las suyas primero).
            `display=optional` evita el destello del texto de la ligadura
            ("search", "star") antes de que cargue la fuente. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- va en el
            layout raíz: aplica a todo el sitio, no a una página suelta. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=optional"
        />
      </head>
      {/* Grid en vez de flex: un header sticky dentro de un contenedor flex
          queda limitado por su línea de flex y se despega al hacer scroll.
          Con grid-rows-[auto_1fr_auto] el sticky funciona y el footer sigue
          quedando abajo aunque la página sea corta. */}
      <body className="grid min-h-screen grid-rows-[auto_1fr_auto] font-sans">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-input focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-brand-800 focus:shadow-pop"
        >
          Saltar al contenido
        </a>
        <HeaderWithAuth />
        <main id="contenido">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
