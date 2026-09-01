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
    // `suppressHydrationWarning`: el script del <head> marca este mismo <html>
    // con `data-fonts-ready` antes de que React hidrate, así que servidor y
    // cliente difieren a propósito. Silencia sólo este elemento, no sus hijos.
    <html lang="es-UY" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Los iconos se cargan acá porque next/font sólo maneja familias de
            texto, y un @import en el CSS lo elimina el bundler (las reglas
            @import deben ir antes que todo, y Tailwind inyecta las suyas primero).

            `display=swap`, no `optional`: con `optional` el navegador descarta
            la fuente si no llegó a tiempo y no la usa en esa visita, así que en
            la primera carga no se veía ningún icono hasta recargar.

            El texto crudo de la ligadura ("search", "star") lo oculta el CSS
            mientras falte `data-fonts-ready`, que pone el script de abajo al
            terminar de cargar la fuente. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- va en el
            layout raíz: aplica a todo el sitio, no a una página suelta. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
        />
        {/*
          Marca el <html> cuando la fuente de iconos está lista.

          Escribe un atributo `data-` y no una clase: React compara en la
          hidratación los props que él renderizó, y `className` es uno de
          ellos. Tocarlo desde afuera provoca un error de hidratación. Un
          atributo que React nunca renderizó lo deja intacto.

          Va inline y antes del contenido para que corra cuanto antes. El
          `catch` y el `setTimeout` son la red de seguridad: si `document.fonts`
          no existe o la carga falla, igual se muestran los iconos —peor un
          instante de texto raro que un sitio sin ningún icono.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var r=function(){document.documentElement.setAttribute('data-fonts-ready','')};try{document.fonts.load('24px "Material Symbols Outlined"').then(r).catch(r);setTimeout(r,3000)}catch(e){r()}})()`,
          }}
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
