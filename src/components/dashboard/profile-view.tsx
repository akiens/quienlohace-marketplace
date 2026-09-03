"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ProfileForm } from "@/components/dashboard/profile-form";
import { PublishToggle } from "@/components/dashboard/publish-toggle";
import { Icon } from "@/components/ui";
import { CATEGORIES } from "@/data/categories";
import { locationLabelById } from "@/data/locations";
import { allowsFeature } from "@/domain/plans";
import {
  SERVICE_MODE_LABELS,
  type PlanLimits,
  type Provider,
  type ProviderImage,
} from "@/types";

/**
 * El perfil ya creado: se mira, se publica y se edita.
 *
 * Separado del asistente a propósito. El alta es un recorrido de una vez; a
 * partir de ahí lo que se quiere es ver cómo quedó el perfil y corregir algo
 * puntual, no volver a caminar ocho pasos para llegar a un campo.
 *
 * Leer y editar son la misma página y no dos rutas: el cambio es de modo, no
 * de lugar, y navegar perdería el punto de la pantalla en el que se estaba.
 */
export function ProfileView({
  provider,
  plan,
  images,
}: {
  provider: Provider;
  plan: PlanLimits;
  images: ProviderImage[];
}) {
  /*
   * El modo edición vive en la URL (`?editar=1`) y no en un estado local.
   *
   * «Mi perfil» del encabezado apunta a `/dashboard`: con el modo en estado
   * local, tocarlo navegaba a la misma dirección, React no desmontaba nada y
   * el formulario seguía abierto — el botón parecía no hacer nada. Con el
   * modo en la URL, esa navegación deja la dirección sin el parámetro y el
   * perfil vuelve solo a lectura.
   *
   * De paso, el modo sobrevive a una recarga y se puede volver atrás con el
   * botón del navegador, que es lo que se espera de algo que cambia lo que
   * se ve en pantalla.
   */
  const router = useRouter();
  const params = useSearchParams();
  const editing = params.get("editar") === "1";

  const setEditing = (on: boolean) => {
    // `replace` y no `push`: entrar y salir de edición no son pasos del
    // historial que valga la pena recorrer con el botón de atrás.
    router.replace(on ? "/dashboard?editar=1" : "/dashboard");
  };

  const avatar = images.find((image) => image.kind === "avatar") ?? null;
  const cover = images.find((image) => image.kind === "cover") ?? null;
  const gallery = images.filter((image) => image.kind === "gallery");

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <p className="flex items-center gap-2.5 rounded-card border border-accent bg-accent-soft px-4 py-3 text-[14px] font-medium text-accent-ink">
          <Icon name="edit" className="text-[18px]" />
          Estás editando tu perfil. Los cambios se guardan al confirmar.
        </p>

        {/*
          El mismo formulario del alta, abierto de una vez. Comparten campos,
          validación y acción: una sola definición de qué es un perfil válido,
          en vez de dos que se desincronizan.
        */}
        <ProfileForm
          provider={provider}
          plan={plan}
          images={images}
          mode="edicion"
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const published = provider.status === "active";

  return (
    <div className="flex flex-col gap-5">
      {/* Estado y acciones: publicar, editar y ver cómo se ve por fuera. */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-white p-4">
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${
            published
              ? "bg-[#E8F6EF] text-[#1E8C56]"
              : "bg-surface-sunken text-ink-soft"
          }`}
        >
          <Icon
            name={published ? "visibility" : "visibility_off"}
            filled
            className="text-[16px]"
          />
          {published ? "Publicado" : "Sin publicar"}
        </span>

        <span className="text-[13.5px] text-ink-soft">
          {published
            ? "Tu perfil aparece en las búsquedas."
            : "Sólo vos podés verlo."}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <Link
            href={`/profesionales/${provider.slug}`}
            className="flex h-10 items-center gap-1.5 rounded-input border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink hover:bg-surface-muted"
          >
            <Icon name="open_in_new" className="text-[17px] text-brand-800" />
            Ver perfil
          </Link>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-10 items-center gap-1.5 rounded-input border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink hover:bg-surface-muted"
          >
            <Icon name="edit" className="text-[17px] text-brand-800" />
            Editar
          </button>

          <PublishToggle status={provider.status ?? "draft"} />
        </div>
      </div>

      {/* Lo cargado, para revisarlo de un vistazo sin entrar a editar. */}
      <div className="flex flex-col rounded-card border border-line bg-white">
        <Section title="Imágenes">
          <div className="flex flex-wrap items-center gap-4">
            <Thumb image={avatar} label="Foto de perfil" round />
            <Thumb image={cover} label="Portada" />
            {allowsFeature(plan, "gallery") ? (
              <span className="text-[13.5px] text-ink-soft">
                Galería: {gallery.length} imagen
                {gallery.length === 1 ? "" : "es"}
              </span>
            ) : null}
          </div>
        </Section>

        <Section title="Identidad">
          <Row label="Nombre">{provider.name}</Row>
          <Row label="Tipo">
            {provider.kind === "business"
              ? "Empresa / equipo"
              : "Profesional independiente"}
          </Row>
          <Row label="Descripción">{provider.description}</Row>
        </Section>

        <Section title="Rubro">
          <Row label="Subcategoría">
            {subcategoryLabel(provider.subcategoryId)}
          </Row>
          <Row label="Servicios">
            {provider.services.length > 0 ? (
              <Chips values={provider.services} />
            ) : (
              <Empty />
            )}
          </Row>
        </Section>

        <Section title="Ubicación">
          <Row label="Dónde estás">
            {locationLabelById(provider.locationId)}
          </Row>
          <Row label="Dónde trabajás">
            {provider.serviceAreaIds.length > 0 ? (
              <Chips values={provider.serviceAreaIds.map(locationLabelById)} />
            ) : (
              <Empty />
            )}
          </Row>
          {provider.serviceMode ? (
            <Row label="Modalidad">
              {SERVICE_MODE_LABELS[provider.serviceMode]}
            </Row>
          ) : null}
        </Section>

        <Section title="Contacto">
          <Row label="Teléfono">{provider.phone || <Empty />}</Row>
          <Row label="WhatsApp">
            {provider.whatsappEnabled ? "Sí, este número recibe WhatsApp" : "No"}
          </Row>
          <Row label="Horarios">{provider.schedule || <Empty />}</Row>
          <Row label="Formas de pago">
            {provider.paymentMethods.length > 0 ? (
              <Chips values={provider.paymentMethods} />
            ) : (
              <Empty />
            )}
          </Row>
        </Section>

        {allowsFeature(plan, "social") ? (
          <Section title="Redes">
            {provider.socialLinks && provider.socialLinks.length > 0 ? (
              provider.socialLinks.map((link) => (
                <Row key={link.platform} label={link.platform}>
                  {link.url}
                </Row>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        ) : null}

        {allowsFeature(plan, "team") ? (
          <Section title="Equipo">
            {provider.teamMembers && provider.teamMembers.length > 0 ? (
              provider.teamMembers.map((member, index) => (
                <Row key={index} label={member.name}>
                  {member.role || <Empty />}
                </Row>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

/** Nombre legible de una subcategoría; su id si no se encuentra. */
function subcategoryLabel(id: string): string {
  for (const category of CATEGORIES) {
    const found = category.subcategories.find((sub) => sub.id === id);
    if (found) return found.name;
  }
  return id;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-line-soft p-5 last:border-b-0">
      <h2 className="text-[15px] font-bold tracking-[-.2px] text-ink">
        {title}
      </h2>
      <dl className="flex flex-col gap-2.5">{children}</dl>
    </section>
  );
}

/** Etiqueta y valor, en dos columnas en pantallas anchas. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-[13.5px] font-semibold text-ink-muted">{label}</dt>
      <dd className="text-[14.5px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

function Chips({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full bg-brand-100 px-3 py-1 text-[13px] font-semibold text-brand-800"
        >
          {value}
        </span>
      ))}
    </span>
  );
}

/** Lo que todavía no se cargó: se dice, no se deja el hueco en blanco. */
function Empty() {
  return <span className="text-[14px] text-ink-faint">Sin completar</span>;
}

function Thumb({
  image,
  label,
  round = false,
}: {
  image: ProviderImage | null;
  label: string;
  round?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex h-14 w-14 items-center justify-center overflow-hidden border border-line bg-surface-muted ${
          round ? "rounded-full" : "rounded-card"
        }`}
      >
        {image ? (
          // La sirve `/media` desde R2: no pasa por el optimizador.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="image" className="text-[20px] text-ink-faint" />
        )}
      </span>
      <span className="text-[13.5px] text-ink-soft">{label}</span>
    </span>
  );
}
