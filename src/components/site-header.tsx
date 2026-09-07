"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { logout } from "@/app/actions/auth";
import { Icon } from "@/components/ui";

/**
 * Lo que se usa seguido, siempre a la vista y con su icono.
 *
 * Son tres porque son las tres cosas que alguien viene a hacer: volver al
 * principio, buscar un profesional o escribirnos. Lo demás es material de
 * consulta y vive en "Más".
 */
const NAV_LINKS = [
  { label: "Inicio", href: "/", icon: "home" },
  { label: "Buscar", href: "/buscar", icon: "search" },
  { label: "Contacto", href: "/contacto", icon: "mail" },
];

/**
 * Lo que se lee una vez y no se vuelve a abrir: se agrupa tras "Más" para no
 * gastar el ancho del encabezado en enlaces que casi nadie toca dos veces.
 */
const MORE_LINKS = [
  { label: "Cómo funciona", href: "/como-funciona", icon: "help" },
  { label: "Sobre nosotros", href: "/sobre-nosotros", icon: "info" },
  { label: "Preguntas frecuentes", href: "/faq", icon: "quiz" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  // Cambiar de página remonta el header, así los menús abiertos se cierran
  // solos: no hace falta un efecto que reinicie el estado tras navegar.
  return <Header key={pathname} signedIn={signedIn} />;
}

function Header({ signedIn }: { signedIn: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Escape cierra cualquier capa abierta.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      setMoreOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Un clic fuera del encabezado cierra el desplegable "Más".
  useEffect(() => {
    if (!moreOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMoreOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [moreOpen]);

  // Bloquea el scroll del fondo mientras el drawer está abierto.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-[#16294B] bg-header-gradient"
    >
      <div className="shell flex h-[60px] items-center gap-7">
        <Link href="/" className="flex flex-none items-center gap-3">
          {/*
            El logo es la palabra y su bajada, en todos los tamaños. Antes
            llevaba además la marca "QH" y una línea separadora, que se veían
            sólo desde `lg`: la palabra sola ya identifica al sitio, y sin la
            marca el encabezado es igual en el teléfono que en escritorio.
          */}
          <span className="flex flex-col items-center gap-[3px]">
            <Image
              src="/brand/logo-word.svg"
              alt="QuienLoHace"
              width={190}
              height={40}
              priority
              className="mt-0.5 h-8 w-auto lg:h-10"
            />
            {/*
              El subtítulo sube contra la palabra: el alto de línea del SVG
              deja un hueco que lo despegaba del logo en vez de leerse como
              parte de él.
            */}
            <span className="-mt-[7px] whitespace-nowrap text-center text-[8px] tracking-[.2px] text-[#CBD6E8] lg:text-[9.5px]">
              Conectando clientes y profesionales
            </span>
          </span>
        </Link>

        {/* Navegación de escritorio */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => {
            /*
             * "Inicio" sólo está activo en la portada; el resto también con sus
             * subrutas. Sin esa distinción `/` marcaría activo en todo el
             * sitio, porque toda dirección empieza con la barra.
             */
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                /*
                 * Seleccionado se ve como el hover —el mismo fondo claro—, más
                 * el texto en blanco pleno. Antes el activo sólo cambiaba de
                 * color de letra y se perdía contra el degradado del encabezado.
                 */
                className={`flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[14.5px] transition-colors hover:bg-white/10 ${
                  active
                    ? "bg-white/10 font-semibold text-white"
                    : "font-medium text-[#D9E1EF]"
                }`}
              >
                <Icon
                  name={link.icon}
                  className={`text-[18px] ${active ? "text-accent" : "text-[#9FB1CE]"}`}
                />
                {link.label}
              </Link>
            );
          })}

          {/*
            "Más" agrupa lo institucional. Se marca activo cuando la página
            abierta es una de las suyas: si no, estando en "Cómo funciona" el
            encabezado no señalaría nada y parecería que no se navegó.
          */}
          <div className="relative">
            {(() => {
              const moreActive = MORE_LINKS.some(
                (link) =>
                  pathname === link.href || pathname.startsWith(`${link.href}/`),
              );

              return (
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-expanded={moreOpen}
                  className={`flex h-[38px] items-center gap-1.5 rounded-lg px-3 text-[14.5px] transition-colors hover:bg-white/10 ${
                    moreOpen || moreActive
                      ? "bg-white/10 font-semibold text-white"
                      : "font-medium text-[#D9E1EF]"
                  }`}
                >
                  <Icon
                    name="more_horiz"
                    className={`text-[18px] ${moreActive ? "text-accent" : "text-[#9FB1CE]"}`}
                  />
                  Más
                  <Icon
                    name="expand_more"
                    className="text-[18px] text-[#9FB1CE]"
                  />
                </button>
              );
            })()}

            {moreOpen ? (
              <div className="absolute left-0 top-11 z-[70] min-w-[232px] rounded-xl border border-line bg-white p-1.5 shadow-mega">
                {MORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={pathname === link.href ? "page" : undefined}
                    className={`flex items-center gap-2.5 whitespace-nowrap rounded-lg p-2.5 text-[14px] font-medium hover:bg-surface-sunken ${
                      pathname === link.href
                        ? "bg-surface-sunken text-brand-800"
                        : "text-[#344054]"
                    }`}
                  >
                    <Icon
                      name={link.icon}
                      className="text-[19px] text-brand-800"
                    />
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="hidden flex-none items-center gap-2.5 lg:flex">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="flex h-10 items-center gap-2 rounded-input bg-accent px-4 text-[14.5px] font-bold text-ink transition-colors hover:bg-accent-hover"
            >
              <Icon name="account_circle" className="text-[18px]" />
              Mi perfil
            </Link>
          ) : null}

          {signedIn ? (
            // La sesión se cierra en el servidor: un form contra la Server
            // Action, que borra la cookie y la fila de `sessions`.
            <form action={logout}>
              <button
                type="submit"
                className="flex h-10 items-center gap-1.5 rounded-input border border-white/30 px-3.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Icon name="logout" className="text-[18px]" />
                Salir
              </button>
            </form>
          ) : (
            <>
              <Link
                href="/entrar"
                className="flex h-10 items-center rounded-input border border-white/30 px-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-white/10"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="flex h-10 items-center rounded-input bg-accent px-4 text-[14.5px] font-bold text-ink transition-colors hover:bg-accent-hover"
              >
                Publicar mi perfil
              </Link>
            </>
          )}
        </div>

        {/* Acciones mobile */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {/*
            Con sesión, "Mi perfil" es el amarillo de la marca igual que en
            escritorio: es la acción propia de quien ya entró, y verla de un
            color acá y de otro allá hacía dudar de que fuera el mismo botón.
            Sin sesión, "Entrar" queda delineado — el que pesa es "Publicar mi
            perfil", que vive en el drawer.
          */}
          <Link
            href={signedIn ? "/dashboard" : "/entrar"}
            className={`flex h-[38px] items-center rounded-[9px] px-3.5 text-[14px] ${
              signedIn
                ? "bg-accent font-bold text-ink transition-colors hover:bg-accent-hover"
                : "border border-white/30 font-semibold text-white"
            }`}
          >
            {signedIn ? "Mi perfil" : "Entrar"}
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="flex h-10 w-10 items-center justify-center rounded-[9px] border border-white/30"
          >
            <Icon name="menu" className="text-[22px] text-white" />
          </button>
        </div>
      </div>

      {drawerOpen ? (
        <MobileDrawer signedIn={signedIn} onClose={() => setDrawerOpen(false)} />
      ) : null}
    </header>
  );
}

function MobileDrawer({
  signedIn,
  onClose,
}: {
  signedIn: boolean;
  onClose: () => void;
}) {
  /*
   * Un solo nivel: el menú ya no navega el catálogo de rubros. Eso se explora
   * desde el buscador, que está en todas las pantallas.
   */
  const title = "Menú";

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Cerrar menú"
        onClick={onClose}
        className="fixed inset-0 z-[90] cursor-default bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-[91] flex w-[min(360px,88vw)] flex-col bg-white"
      >
        <div className="flex h-[60px] items-center justify-between border-b border-line px-4">
          <p className="text-[15px] font-bold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F2F4F7]"
          >
            <Icon name="close" className="text-[20px] text-ink" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 pb-6">
          <nav className="flex flex-col gap-0.5">
              {/*
                Las mismas entradas que en escritorio, para que el menú no
                dependa del tamaño de la pantalla, más la del panel propio.
              */}
              {[
                ...NAV_LINKS,
                /*
                 * En el teléfono no hay desplegable "Más": el menú ya es una
                 * lista vertical con lugar de sobra, y esconder tres enlaces
                 * tras otro toque no ahorraría nada.
                 */
                ...MORE_LINKS,
                signedIn
                  ? { label: "Mi perfil", href: "/dashboard", icon: "account_circle" }
                  : { label: "Publicar mi perfil", href: "/registro", icon: "add_business" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 rounded-[10px] p-3 text-[15px] font-semibold text-ink hover:bg-surface-sunken"
                >
                  <Icon name={link.icon} className="text-[20px] text-brand-800" />
                  {link.label}
                </Link>
              ))}

              {signedIn ? (
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2.5 rounded-[10px] p-3 text-left text-[15px] font-semibold text-ink hover:bg-surface-sunken"
                  >
                    <Icon name="logout" className="text-[20px] text-brand-800" />
                    Cerrar sesión
                  </button>
                </form>
              ) : null}
          </nav>
        </div>
      </div>
    </div>
  );
}
