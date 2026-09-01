"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { logout } from "@/app/actions/auth";
import { CATEGORIES } from "@/data/categories";
import { Icon } from "@/components/ui";

const NAV_LINKS = [
  { label: "Destacados", href: "/destacados" },
  { label: "Cómo funciona", href: "/como-funciona" },
];

const MORE_LINKS = [
  { label: "Sobre nosotros", href: "/sobre-nosotros", icon: "info" },
  { label: "Contacto", href: "/contacto", icon: "mail" },
  { label: "Preguntas frecuentes", href: "/faq", icon: "quiz" },
];

/** Tintes rotativos para los iconos de categoría del mega-menú. */
const TINTS = [
  "bg-brand-100 text-brand-800",
  "bg-accent-soft text-[#B98A05]",
  "bg-[#EDF2F7] text-brand-700",
  "bg-[#FDF4E3] text-[#A97F0A]",
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  // Cambiar de página remonta el header, así los menús abiertos se cierran
  // solos: no hace falta un efecto que reinicie el estado tras navegar.
  return <Header key={pathname} signedIn={signedIn} />;
}

function Header({ signedIn }: { signedIn: boolean }) {
  const [megaOpen, setMegaOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(0);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Escape cierra cualquier capa abierta.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMegaOpen(false);
      setMoreOpen(false);
      setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Un clic fuera del header cierra los desplegables de escritorio.
  useEffect(() => {
    if (!megaOpen && !moreOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMegaOpen(false);
      setMoreOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [megaOpen, moreOpen]);

  // Bloquea el scroll del fondo mientras el drawer está abierto.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const activeCategory = CATEGORIES[hoveredCategory] ?? CATEGORIES[0]!;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-[#16294B] bg-header-gradient"
    >
      <div className="shell flex h-[68px] items-center gap-7 lg:h-[88px]">
        <Link href="/" className="flex flex-none items-center gap-3">
          <Image
            src="/brand/logo-mark.svg"
            alt=""
            width={50}
            height={50}
            priority
            className="h-10 w-auto lg:h-[50px]"
          />
          <span className="h-8 w-[1.5px] flex-none rounded-full bg-[#DDDEE1]/55 lg:h-[42px]" />
          <span className="flex flex-col items-center gap-[3px]">
            <Image
              src="/brand/logo-word.svg"
              alt="QuienLoHace"
              width={190}
              height={40}
              priority
              className="mt-0.5 h-8 w-auto lg:h-10"
            />
            <span className="whitespace-nowrap text-center text-[8px] tracking-[.2px] text-[#CBD6E8] lg:text-[9.5px]">
              Conectamos clientes y profesionales
            </span>
          </span>
        </Link>

        {/* Navegación de escritorio */}
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          <button
            type="button"
            onClick={() => {
              setMegaOpen((open) => !open);
              setMoreOpen(false);
            }}
            aria-expanded={megaOpen}
            className={`flex h-[38px] items-center gap-1.5 rounded-lg px-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-white/10 ${
              megaOpen ? "bg-white/[.14]" : ""
            }`}
          >
            Categorías
            <Icon name="expand_more" className="text-[18px] text-[#9FB1CE]" />
          </button>

          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex h-[38px] items-center whitespace-nowrap rounded-lg px-3 text-[14.5px] transition-colors hover:bg-white/10 ${
                pathname === link.href
                  ? "font-bold text-accent"
                  : "font-medium text-[#D9E1EF]"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMoreOpen((open) => !open);
                setMegaOpen(false);
              }}
              aria-expanded={moreOpen}
              className={`flex h-[38px] items-center gap-1 rounded-lg px-3 text-[14.5px] font-medium text-[#D9E1EF] transition-colors hover:bg-white/10 ${
                moreOpen ? "bg-white/[.14]" : ""
              }`}
            >
              Más
              <Icon name="expand_more" className="text-[18px] text-[#9FB1CE]" />
            </button>

            {moreOpen ? (
              <div className="absolute left-0 top-11 z-[70] min-w-[216px] rounded-xl border border-line bg-white p-1.5 shadow-mega">
                {MORE_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 whitespace-nowrap rounded-lg p-2.5 text-[14px] font-medium text-[#344054] hover:bg-surface-sunken"
                  >
                    <Icon name={link.icon} className="text-[19px] text-brand-800" />
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
          <Link
            href={signedIn ? "/dashboard" : "/entrar"}
            className="flex h-[38px] items-center rounded-[9px] border border-white/30 px-3.5 text-[14px] font-semibold text-white"
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

      {megaOpen ? (
        <MegaMenu
          activeIndex={hoveredCategory}
          onHover={setHoveredCategory}
          activeCategory={activeCategory}
          onClose={() => setMegaOpen(false)}
        />
      ) : null}

      {drawerOpen ? (
        <MobileDrawer signedIn={signedIn} onClose={() => setDrawerOpen(false)} />
      ) : null}
    </header>
  );
}

function MegaMenu({
  activeIndex,
  onHover,
  activeCategory,
  onClose,
}: {
  activeIndex: number;
  onHover: (index: number) => void;
  activeCategory: (typeof CATEGORIES)[number];
  onClose: () => void;
}) {
  return (
    <>
      <div className="absolute inset-x-0 top-full hidden border-b border-line bg-white shadow-mega lg:block">
        <div className="shell grid grid-cols-[340px_1fr] gap-6 pb-[22px] pt-[18px]">
          <div className="max-h-[430px] overflow-auto border-r border-line-soft pr-2">
            <div className="flex gap-2 px-1 pb-2.5">
              <Link
                href="/buscar"
                className="flex h-[34px] flex-1 items-center justify-center rounded-lg border border-line-strong bg-white text-[13.5px] font-semibold text-ink hover:bg-surface-muted"
              >
                Todas
              </Link>
              <Link
                href="/destacados"
                className="flex h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent bg-accent-soft text-[13.5px] font-semibold text-accent-ink hover:bg-[#FDF1CE]"
              >
                <Icon name="star" filled className="text-[16px] text-[#E0A800]" />
                Destacados
              </Link>
            </div>

            {CATEGORIES.map((category, index) => (
              <Link
                key={category.id}
                href={`/categorias/${category.slug}`}
                onMouseEnter={() => onHover(index)}
                onFocus={() => onHover(index)}
                className={`flex items-center gap-2.5 rounded-[9px] p-2.5 ${
                  index === activeIndex ? "bg-surface-sunken" : ""
                }`}
              >
                <span
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-[9px] ${
                    TINTS[index % TINTS.length]
                  }`}
                >
                  <Icon name={category.icon} className="text-[19px]" />
                </span>
                <span
                  className={`text-[14px] leading-tight text-ink ${
                    index === activeIndex ? "font-bold" : "font-medium"
                  }`}
                >
                  {category.short}
                </span>
                <Icon
                  name="chevron_right"
                  className="ml-auto text-[18px] text-ink-faint"
                />
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3.5 pt-0.5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-900">
                <Icon
                  name={activeCategory.icon}
                  className="text-[22px] text-accent"
                />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-[17px] font-bold tracking-[-.2px] text-ink">
                  {activeCategory.name}
                </p>
                <p className="text-[13px] text-ink-soft">
                  {activeCategory.providerCount} profesionales ·{" "}
                  {activeCategory.subcategories.length} subcategorías
                </p>
              </div>
              <Link
                href={`/categorias/${activeCategory.slug}`}
                className="ml-auto flex h-9 items-center rounded-[9px] bg-brand-100 px-3.5 text-[13.5px] font-semibold text-brand-800 hover:bg-[#E3E8F1]"
              >
                Ver categoría →
              </Link>
            </div>

            <div className="h-[330px] [column-fill:auto] [column-gap:24px] [column-width:220px]">
              {activeCategory.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/categorias/${activeCategory.slug}/${sub.slug}`}
                  className="block break-inside-avoid rounded-[7px] px-2 py-[7px] text-[14px] text-ink-muted hover:bg-surface-sunken hover:text-brand-800"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label="Cerrar menú de categorías"
        onClick={onClose}
        className="fixed inset-0 top-[88px] -z-10 hidden cursor-default bg-ink/[.28] lg:block"
      />
    </>
  );
}

type DrawerLevel = "root" | "categories" | "subcategories";

function MobileDrawer({
  signedIn,
  onClose,
}: {
  signedIn: boolean;
  onClose: () => void;
}) {
  const [level, setLevel] = useState<DrawerLevel>("root");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const category = CATEGORIES[categoryIndex] ?? CATEGORIES[0]!;

  const title =
    level === "root" ? "Menú" : level === "categories" ? "Categorías" : category.name;

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
          {level === "root" ? (
            <nav className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setLevel("categories")}
                className="flex items-center gap-2.5 rounded-[10px] p-3 text-left text-[15px] font-semibold text-ink hover:bg-surface-sunken"
              >
                <Icon name="category" className="text-[20px] text-brand-800" />
                Categorías
                <Icon
                  name="chevron_right"
                  className="ml-auto text-[20px] text-ink-faint"
                />
              </button>

              {[
                { label: "Destacados", href: "/destacados", icon: "star" },
                { label: "Cómo funciona", href: "/como-funciona", icon: "help_outline" },
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
          ) : null}

          {level === "categories" ? (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setLevel("root")}
                className="flex items-center gap-2 p-3 text-left text-[14px] font-semibold text-ink-soft"
              >
                <Icon name="arrow_back" className="text-[20px]" />
                Menú
              </button>
              {CATEGORIES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCategoryIndex(index);
                    setLevel("subcategories");
                  }}
                  className="flex items-center gap-2.5 rounded-[10px] p-3 text-left hover:bg-surface-sunken"
                >
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-[9px] ${
                      TINTS[index % TINTS.length]
                    }`}
                  >
                    <Icon name={item.icon} className="text-[19px]" />
                  </span>
                  <span className="text-[14.5px] font-semibold leading-tight text-ink">
                    {item.short}
                  </span>
                  <Icon
                    name="chevron_right"
                    className="ml-auto text-[20px] text-ink-faint"
                  />
                </button>
              ))}
            </div>
          ) : null}

          {level === "subcategories" ? (
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setLevel("categories")}
                className="flex items-center gap-2 p-3 text-left text-[14px] font-semibold text-ink-soft"
              >
                <Icon name="arrow_back" className="text-[20px]" />
                Categorías
              </button>
              <Link
                href={`/categorias/${category.slug}`}
                className="flex items-center gap-2.5 rounded-[10px] bg-surface-sunken p-3"
              >
                <Icon name={category.icon} className="text-[20px] text-brand-800" />
                <span className="text-[14.5px] font-bold text-ink">
                  Todas · {category.short}
                </span>
              </Link>
              {category.subcategories.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/categorias/${category.slug}/${sub.slug}`}
                  className="rounded-[10px] p-3 text-[14.5px] text-ink-muted hover:bg-surface-sunken"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
